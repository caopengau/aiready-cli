/**
 * Scan command - Run comprehensive AI-readiness analysis using the tool registry
 */

import chalk from 'chalk';
import { writeFileSync, readFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import {
  loadMergedConfig,
  handleJSONOutput,
  handleCLIError,
  getElapsedTime,
  resolveOutputPath,
  formatScore,
  formatToolScore,
  calculateTokenBudget,
  estimateCostFromBudget,
  getModelPreset,
  getRating,
  getRatingDisplay,
  getRepoMetadata,
  Severity,
  IssueType,
  ToolName,
  ToolRegistry,
  emitIssuesAsAnnotations,
} from '@aiready/core';
import { analyzeUnified, scoreUnified, type ScoringResult } from '../index';
import {
  getReportTimestamp,
  warnIfGraphCapExceeded,
  truncateArray,
} from '../utils/helpers';
import { uploadAction } from './upload';

interface ScanOptions {
  tools?: string;
  profile?: string;
  compareTo?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
  noScore?: boolean;
  weights?: string;
  threshold?: string;
  ci?: boolean;
  failOn?: string;
  model?: string;
  apiKey?: string;
  upload?: boolean;
  server?: string;
}

export async function scanAction(directory: string, options: ScanOptions) {
  console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

  const startTime = Date.now();
  const resolvedDir = resolvePath(process.cwd(), directory || '.');
  const repoMetadata = getRepoMetadata(resolvedDir);

  try {
    // Define defaults using canonical IDs
    const defaults = {
      tools: [
        'pattern-detect',
        'context-analyzer',
        'naming-consistency',
        'ai-signal-clarity',
        'agent-grounding',
        'testability-index',
        'doc-drift',
        'dependency-health',
        'change-amplification',
      ],
      include: undefined,
      exclude: undefined,
      output: {
        format: 'console',
        file: undefined,
      },
    };

    // Map profile to tool IDs
    let profileTools: string[] | undefined = options.tools
      ? options.tools.split(',').map((t) => t.trim())
      : undefined;
    if (options.profile) {
      switch (options.profile.toLowerCase()) {
        case 'agentic':
          profileTools = [
            ToolName.AiSignalClarity,
            ToolName.AgentGrounding,
            ToolName.TestabilityIndex,
          ];
          break;
        case 'cost':
          profileTools = [ToolName.PatternDetect, ToolName.ContextAnalyzer];
          break;
        case 'logic':
          profileTools = [
            ToolName.TestabilityIndex,
            ToolName.NamingConsistency,
            ToolName.ContextAnalyzer,
            ToolName.PatternDetect,
            ToolName.ChangeAmplification,
          ];
          break;
        case 'ui':
          profileTools = [
            ToolName.NamingConsistency,
            ToolName.ContextAnalyzer,
            ToolName.PatternDetect,
            ToolName.DocDrift,
            ToolName.AiSignalClarity,
          ];
          break;
        case 'security':
          profileTools = [
            ToolName.NamingConsistency,
            ToolName.TestabilityIndex,
          ];
          break;
        case 'onboarding':
          profileTools = [
            ToolName.ContextAnalyzer,
            ToolName.NamingConsistency,
            ToolName.AgentGrounding,
          ];
          break;
        default:
          console.log(
            chalk.yellow(
              `\n⚠️  Unknown profile '${options.profile}'. Using defaults.`
            )
          );
      }
    }

    const cliOverrides: any = {
      include: options.include?.split(','),
      exclude: options.exclude?.split(','),
    };
    if (profileTools) cliOverrides.tools = profileTools;

    const baseOptions = (await loadMergedConfig(
      resolvedDir,
      defaults,
      cliOverrides
    )) as any;

    // Apply smart defaults for pattern detection if requested
    let finalOptions = { ...baseOptions };
    if (
      baseOptions.tools.includes(ToolName.PatternDetect) ||
      baseOptions.tools.includes('patterns')
    ) {
      const { getSmartDefaults } = await import('@aiready/pattern-detect');
      const patternSmartDefaults = await getSmartDefaults(
        resolvedDir,
        finalOptions.toolConfigs?.[ToolName.PatternDetect] || {}
      );

      // Merge smart defaults into toolConfigs instead of root level
      if (!finalOptions.toolConfigs) finalOptions.toolConfigs = {};
      finalOptions.toolConfigs[ToolName.PatternDetect] = {
        ...patternSmartDefaults,
        ...finalOptions.toolConfigs[ToolName.PatternDetect],
      };
    }

    console.log(chalk.cyan('\n=== AIReady Run Preview ==='));
    console.log(
      chalk.white('Tools to run:'),
      (finalOptions.tools || []).join(', ')
    );

    // Dynamic progress callback
    const progressCallback = (event: any) => {
      // Handle progress messages
      if (event.message) {
        process.stdout.write(`\r\x1b[K   [${event.tool}] ${event.message}`);
        return;
      }

      // Handle tool completion
      process.stdout.write('\r\x1b[K'); // Clear the progress line
      console.log(chalk.cyan(`--- ${event.tool.toUpperCase()} RESULTS ---`));
      const res = event.data;
      if (res && res.summary) {
        if (res.summary.totalIssues !== undefined)
          console.log(`  Issues found: ${chalk.bold(res.summary.totalIssues)}`);
        if (res.summary.score !== undefined)
          console.log(`  Tool Score: ${chalk.bold(res.summary.score)}/100`);
        if (res.summary.totalFiles !== undefined)
          console.log(
            `  Files analyzed: ${chalk.bold(res.summary.totalFiles)}`
          );
      }
    };

    // Determine scoring profile for project-type-aware weighting
    const scoringProfile =
      options.profile || baseOptions.scoring?.profile || 'default';

    const results = await analyzeUnified({
      ...finalOptions,
      progressCallback,
      onProgress: () => {},
      suppressToolConfig: true,
    });

    console.log(chalk.cyan('\n=== AIReady Run Summary ==='));
    console.log(
      `  Total issues (all tools): ${chalk.bold(String(results.summary.totalIssues || 0))}`
    );
    console.log(
      `  Execution time: ${chalk.bold(((Date.now() - startTime) / 1000).toFixed(2) + 's')}`
    );

    let scoringResult: ScoringResult | undefined;
    if (options.score || finalOptions.scoring?.showBreakdown) {
      // Pass the profile to scoreUnified
      scoringResult = await scoreUnified(results, {
        ...finalOptions,
        scoring: {
          ...finalOptions.scoring,
          profile: scoringProfile,
        },
      });

      console.log(chalk.bold('\n📊 AI Readiness Overall Score'));
      console.log(`  ${formatScore(scoringResult)}`);
      console.log(chalk.dim(`  (Scoring Profile: ${scoringProfile})`));

      // Trend comparison logic
      if (options.compareTo) {
        try {
          const prevReport = JSON.parse(
            readFileSync(resolvePath(process.cwd(), options.compareTo), 'utf8')
          );
          const prevScore =
            prevReport.scoring?.overall || prevReport.scoring?.score;
          if (typeof prevScore === 'number') {
            const diff = scoringResult.overall - prevScore;
            const diffStr = diff > 0 ? `+${diff}` : String(diff);
            if (diff > 0)
              console.log(
                chalk.green(
                  `  📈 Trend: ${diffStr} compared to ${options.compareTo} (${prevScore} → ${scoringResult.overall})`
                )
              );
            else if (diff < 0)
              console.log(
                chalk.red(
                  `  📉 Trend: ${diffStr} compared to ${options.compareTo} (${prevScore} → ${scoringResult.overall})`
                )
              );
            else
              console.log(
                chalk.blue(
                  `  ➖ Trend: No change (${prevScore} → ${scoringResult.overall})`
                )
              );
          }
        } catch (e) {
          void e;
        }
      }

      // Token Budget & Cost Logic
      const totalWastedDuplication = (scoringResult.breakdown || []).reduce(
        (sum, s) =>
          sum + (s.tokenBudget?.wastedTokens.bySource.duplication || 0),
        0
      );
      const totalWastedFragmentation = (scoringResult.breakdown || []).reduce(
        (sum, s) =>
          sum + (s.tokenBudget?.wastedTokens.bySource.fragmentation || 0),
        0
      );
      const totalContext = Math.max(
        ...(scoringResult.breakdown || []).map(
          (s) => s.tokenBudget?.totalContextTokens || 0
        ),
        0
      );

      if (totalContext > 0) {
        const unifiedBudget = calculateTokenBudget({
          totalContextTokens: totalContext,
          wastedTokens: {
            duplication: totalWastedDuplication,
            fragmentation: totalWastedFragmentation,
            chattiness: totalContext * 0.1, // Default chattiness
          },
        });

        const allIssues: any[] = [];
        for (const toolId of results.summary.toolsRun) {
          if (results[toolId]?.results) {
            results[toolId].results.forEach((fileRes: any) => {
              if (fileRes.issues) {
                allIssues.push(...fileRes.issues);
              }
            });
          }
        }

        const modelId = options.model || 'claude-3-5-sonnet';
        const roi = (await import('@aiready/core')).calculateBusinessROI({
          tokenWaste: unifiedBudget.wastedTokens.total,
          issues: allIssues,
          modelId: modelId,
        });

        console.log(chalk.bold('\n💰 Business Impact Analysis (Monthly)'));
        console.log(
          `  Potential Savings: ${chalk.green(chalk.bold('$' + roi.monthlySavings.toLocaleString()))}`
        );
        console.log(
          `  Productivity Gain: ${chalk.cyan(chalk.bold(roi.productivityGainHours + 'h'))} (est. dev time)`
        );
        console.log(
          `  Context Efficiency: ${chalk.yellow((unifiedBudget.efficiencyRatio * 100).toFixed(0) + '%')}`
        );
        console.log(
          `  Annual Value: ${chalk.bold('$' + roi.annualValue.toLocaleString())} (ROI Prediction)`
        );

        (results.summary as any).businessImpact = {
          estimatedMonthlyWaste: roi.monthlySavings,
          potentialSavings: roi.monthlySavings,
          productivityHours: roi.productivityGainHours,
        };

        (scoringResult as any).tokenBudget = unifiedBudget;
        (scoringResult as any).businessROI = roi;
      }

      if (scoringResult.breakdown) {
        console.log(chalk.bold('\nTool breakdown:'));
        scoringResult.breakdown.forEach((tool) => {
          const rating = getRating(tool.score);
          const emoji = getRatingDisplay(rating).emoji;
          console.log(
            `  - ${tool.toolName}: ${tool.score}/100 (${rating}) ${emoji}`
          );
        });

        // Top Actionable Recommendations
        const allRecs = scoringResult.breakdown
          .flatMap((t) =>
            (t.recommendations || []).map((r) => ({ ...r, tool: t.toolName }))
          )
          .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
          .slice(0, 3);

        if (allRecs.length > 0) {
          console.log(chalk.bold('\n🎯 Top Actionable Recommendations:'));
          allRecs.forEach((rec, i) => {
            const priorityIcon =
              rec.priority === 'high'
                ? '🔴'
                : rec.priority === 'medium'
                  ? '🟡'
                  : '🔵';
            console.log(
              `  ${i + 1}. ${priorityIcon} ${chalk.bold(rec.action)}`
            );
            console.log(
              `     Impact: ${chalk.green(`+${rec.estimatedImpact} points`)} to ${rec.tool}`
            );
          });
        }
      }
    }

    console.log(
      chalk.dim(
        '\n──────────────────────────────────────────────────────────────────'
      )
    );
    console.log(chalk.dim('💬 Found a bug or have a metric idea?'));
    console.log(chalk.dim('👉 Copy/paste this to your AI agent:'));
    console.log(
      chalk.cyan(
        `   "Help me report an issue to AIReady. Use 'aiready bug' to prepare a draft."`
      )
    );
    console.log(
      chalk.dim(
        '──────────────────────────────────────────────────────────────────'
      )
    );

    // Normalized report mapping
    const mapToUnifiedReport = (
      res: any,
      scoring: ScoringResult | undefined
    ) => {
      const allResults: any[] = [];
      const totalFilesSet = new Set<string>();
      let criticalCount = 0;
      let majorCount = 0;

      res.summary.toolsRun.forEach((toolId: string) => {
        const spokeRes = res[toolId];
        if (!spokeRes || !spokeRes.results) return;

        spokeRes.results.forEach((r: any) => {
          totalFilesSet.add(r.fileName);
          allResults.push(r);
          r.issues?.forEach((i: any) => {
            if (i.severity === Severity.Critical) criticalCount++;
            if (i.severity === Severity.Major) majorCount++;
          });
        });
      });

      return {
        ...res,
        results: allResults,
        summary: {
          ...res.summary,
          totalFiles: totalFilesSet.size,
          criticalIssues: criticalCount,
          majorIssues: majorCount,
        },
        scoring,
      };
    };

    const outputData = {
      ...mapToUnifiedReport(results, scoringResult),
      repository: repoMetadata,
    };

    // Output persistence
    const outputFormat =
      options.output || finalOptions.output?.format || 'console';
    const outputPath = resolveOutputPath(
      options.outputFile || finalOptions.output?.file,
      `aiready-report-${getReportTimestamp()}.json`,
      resolvedDir
    );

    if (outputFormat === 'json') {
      handleJSONOutput(
        outputData,
        outputPath,
        `✅ Report saved to ${outputPath}`
      );
    } else {
      try {
        writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        console.log(chalk.dim(`✅ Report auto-persisted to ${outputPath}`));
      } catch (err) {
        void err;
      }
    }

    if (options.upload) {
      await uploadAction(outputPath, {
        apiKey: options.apiKey,
        server: options.server,
      });
    }
    await warnIfGraphCapExceeded(outputData, resolvedDir);

    // CI/CD Gatekeeper logic
    const isCI = options.ci || process.env.CI === 'true';
    if (isCI && scoringResult) {
      const threshold = options.threshold
        ? parseInt(options.threshold)
        : undefined;
      const failOnLevel = options.failOn || 'critical';

      let shouldFail = false;
      let failReason = '';

      // Emit annotations for all issues found
      const report = mapToUnifiedReport(results, scoringResult);
      if (report.results && report.results.length > 0) {
        console.log(
          chalk.cyan(
            `\n📝 Emitting GitHub Action annotations for ${report.results.length} issues...`
          )
        );
        emitIssuesAsAnnotations(report.results);
      }

      if (threshold && scoringResult.overall < threshold) {
        shouldFail = true;
        failReason = `Score ${scoringResult.overall} < threshold ${threshold}`;
      }
      if (failOnLevel !== 'none') {
        if (failOnLevel === 'critical' && report.summary.criticalIssues > 0) {
          shouldFail = true;
          failReason = `Found ${report.summary.criticalIssues} critical issues`;
        } else if (
          failOnLevel === 'major' &&
          report.summary.criticalIssues + report.summary.majorIssues > 0
        ) {
          shouldFail = true;
          failReason = `Found ${report.summary.criticalIssues} critical and ${report.summary.majorIssues} major issues`;
        }
      }

      if (shouldFail) {
        console.log(chalk.red(`\n🚫 PR BLOCKED: ${failReason}`));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ PR PASSED'));
      }
    }
  } catch (error) {
    handleCLIError(error, 'Analysis');
  }
}

export const scanHelpText = `...`;
