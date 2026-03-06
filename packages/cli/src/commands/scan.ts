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
        baseOptions
      );
      finalOptions = {
        ...patternSmartDefaults,
        ...finalOptions,
        ...baseOptions,
      };
    }

    console.log(chalk.cyan('\n=== AIReady Run Preview ==='));
    console.log(
      chalk.white('Tools to run:'),
      (finalOptions.tools || []).join(', ')
    );

    // Dynamic progress callback
    const progressCallback = (event: { tool: string; data: any }) => {
      console.log(chalk.cyan(`\n--- ${event.tool.toUpperCase()} RESULTS ---`));
      const res = event.data;
      if (res.summary) {
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

    const results = await analyzeUnified({
      ...finalOptions,
      progressCallback,
      onProgress: (processed: number, total: number, message: string) => {
        process.stdout.write(
          `\r\x1b[K   [${processed}/${total}] ${message}...`
        );
        if (processed === total) process.stdout.write('\n');
      },
      suppressToolConfig: true,
    });

    console.log(chalk.cyan('\n=== AIReady Run Summary ==='));
    console.log(
      `  Total issues (all tools): ${chalk.bold(String(results.summary.totalIssues || 0))}`
    );

    let scoringResult: ScoringResult | undefined;
    if (options.score || finalOptions.scoring?.showBreakdown) {
      scoringResult = await scoreUnified(results, finalOptions);

      console.log(chalk.bold('\n📊 AI Readiness Overall Score'));
      console.log(`  ${formatScore(scoringResult)}`);

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
            chattiness: 0,
          },
        });
        const modelPreset = getModelPreset(options.model || 'claude-4.6');
        const costEstimate = estimateCostFromBudget(unifiedBudget, modelPreset);

        console.log(chalk.bold('\n📊 AI Token Budget Analysis'));
        console.log(
          `  Efficiency: ${(unifiedBudget.efficiencyRatio * 100).toFixed(0)}%`
        );
        console.log(
          `  Wasted Tokens: ${chalk.red(unifiedBudget.wastedTokens.total.toLocaleString())}`
        );
        console.log(
          `  Est. Monthly Cost (${modelPreset.name}): ${chalk.bold('$' + costEstimate.total)}`
        );

        (scoringResult as any).tokenBudget = unifiedBudget;
        (scoringResult as any).costEstimate = {
          model: modelPreset.name,
          ...costEstimate,
        };
      }

      if (scoringResult.breakdown) {
        console.log(chalk.bold('\nTool breakdown:'));
        scoringResult.breakdown.forEach((tool) => {
          const rating = getRating(tool.score);
          console.log(`  - ${tool.toolName}: ${tool.score}/100 (${rating})`);
        });
      }
    }

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

      if (threshold && scoringResult.overall < threshold) {
        shouldFail = true;
        failReason = `Score ${scoringResult.overall} < threshold ${threshold}`;
      }

      const report = mapToUnifiedReport(results, scoringResult);
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
