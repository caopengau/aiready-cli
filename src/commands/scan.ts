/**
 * Scan command - Run comprehensive AI-readiness analysis (patterns + context + consistency)
 */

import chalk from 'chalk';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { resolve as resolvePath } from 'path';
import {
  loadMergedConfig,
  handleJSONOutput,
  handleCLIError,
  getElapsedTime,
  resolveOutputPath,
  calculateOverallScore,
  formatScore,
  formatToolScore,
  getRating,
  getRatingDisplay,
  parseWeightString,
  type ToolScoringOutput,
} from '@aiready/core';
import { analyzeUnified } from '../index';
import { getReportTimestamp, warnIfGraphCapExceeded, truncateArray } from '../utils/helpers';

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
}

export async function scanAction(directory: string, options: ScanOptions) {
  console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

  const startTime = Date.now();
  // Resolve directory to absolute path to ensure .aiready/ is created in the right location
  const resolvedDir = resolvePath(process.cwd(), directory || '.');

  try {
    // Define defaults
    const defaults = {
      tools: ['patterns', 'context', 'consistency', 'hallucination', 'grounding', 'testability', 'doc-drift', 'deps-health'],
      include: undefined,
      exclude: undefined,
      output: {
        format: 'json',
        file: undefined,
      },
    };

    let profileTools = options.tools ? options.tools.split(',').map((t: string) => t.trim()) : undefined;
    if (options.profile) {
      switch (options.profile.toLowerCase()) {
        case 'agentic':
          profileTools = ['hallucination', 'grounding', 'testability'];
          break;
        case 'cost':
          profileTools = ['patterns', 'context'];
          break;
        case 'security':
          profileTools = ['consistency', 'testability'];
          break;
        case 'onboarding':
          profileTools = ['context', 'consistency', 'grounding'];
          break;
        default:
          console.log(chalk.yellow(`\n⚠️  Unknown profile '${options.profile}'. Using specified tools or defaults.`));
      }
    }

    // Load and merge config with CLI options
    const baseOptions = await loadMergedConfig(resolvedDir, defaults, {
      tools: profileTools as any,
      include: options.include?.split(','),
      exclude: options.exclude?.split(','),
    }) as any;


    // Apply smart defaults for pattern detection if patterns tool is enabled
    let finalOptions = { ...baseOptions };
    if (baseOptions.tools.includes('patterns')) {
      const { getSmartDefaults } = await import('@aiready/pattern-detect');
      const patternSmartDefaults = await getSmartDefaults(resolvedDir, baseOptions);
      // Merge deeply to preserve nested config
      finalOptions = { ...patternSmartDefaults, ...finalOptions, ...baseOptions };
    }

    // Print pre-run summary with expanded settings (truncate long arrays)
    console.log(chalk.cyan('\n=== AIReady Run Preview ==='));
    console.log(chalk.white('Tools to run:'), (finalOptions.tools || ['patterns', 'context', 'consistency']).join(', '));
    console.log(chalk.white('Will use settings from config and defaults.'));

    // Common top-level settings
    console.log(chalk.white('\nGeneral settings:'));
    if (finalOptions.rootDir) console.log(`  rootDir: ${chalk.bold(String(finalOptions.rootDir))}`);
    if (finalOptions.include) console.log(`  include: ${chalk.bold(truncateArray(finalOptions.include, 6))}`);
    if (finalOptions.exclude) console.log(`  exclude: ${chalk.bold(truncateArray(finalOptions.exclude, 6))}`);

    if (finalOptions['pattern-detect'] || finalOptions.minSimilarity) {
      const patternDetectConfig = finalOptions['pattern-detect'] || {
        minSimilarity: finalOptions.minSimilarity,
        minLines: finalOptions.minLines,
        approx: finalOptions.approx,
        minSharedTokens: finalOptions.minSharedTokens,
        maxCandidatesPerBlock: finalOptions.maxCandidatesPerBlock,
        batchSize: finalOptions.batchSize,
        streamResults: finalOptions.streamResults,
        severity: (finalOptions as any).severity,
        includeTests: (finalOptions as any).includeTests,
      };
      console.log(chalk.white('\nPattern-detect settings:'));
      console.log(`  minSimilarity: ${chalk.bold(patternDetectConfig.minSimilarity ?? 'default')}`);
      console.log(`  minLines: ${chalk.bold(patternDetectConfig.minLines ?? 'default')}`);
      if (patternDetectConfig.approx !== undefined) console.log(`  approx: ${chalk.bold(String(patternDetectConfig.approx))}`);
      if (patternDetectConfig.minSharedTokens !== undefined) console.log(`  minSharedTokens: ${chalk.bold(String(patternDetectConfig.minSharedTokens))}`);
      if (patternDetectConfig.maxCandidatesPerBlock !== undefined) console.log(`  maxCandidatesPerBlock: ${chalk.bold(String(patternDetectConfig.maxCandidatesPerBlock))}`);
      if (patternDetectConfig.batchSize !== undefined) console.log(`  batchSize: ${chalk.bold(String(patternDetectConfig.batchSize))}`);
      if (patternDetectConfig.streamResults !== undefined) console.log(`  streamResults: ${chalk.bold(String(patternDetectConfig.streamResults))}`);
      if (patternDetectConfig.severity !== undefined) console.log(`  severity: ${chalk.bold(String(patternDetectConfig.severity))}`);
      if (patternDetectConfig.includeTests !== undefined) console.log(`  includeTests: ${chalk.bold(String(patternDetectConfig.includeTests))}`);
    }

    if (finalOptions['context-analyzer'] || finalOptions.maxDepth) {
      const ca = finalOptions['context-analyzer'] || {
        maxDepth: finalOptions.maxDepth,
        maxContextBudget: finalOptions.maxContextBudget,
        minCohesion: (finalOptions as any).minCohesion,
        maxFragmentation: (finalOptions as any).maxFragmentation,
        includeNodeModules: (finalOptions as any).includeNodeModules,
      };
      console.log(chalk.white('\nContext-analyzer settings:'));
      console.log(`  maxDepth: ${chalk.bold(ca.maxDepth ?? 'default')}`);
      console.log(`  maxContextBudget: ${chalk.bold(ca.maxContextBudget ?? 'default')}`);
      if (ca.minCohesion !== undefined) console.log(`  minCohesion: ${chalk.bold(String(ca.minCohesion))}`);
      if (ca.maxFragmentation !== undefined) console.log(`  maxFragmentation: ${chalk.bold(String(ca.maxFragmentation))}`);
      if (ca.includeNodeModules !== undefined) console.log(`  includeNodeModules: ${chalk.bold(String(ca.includeNodeModules))}`);
    }

    if (finalOptions.consistency) {
      const c = finalOptions.consistency;
      console.log(chalk.white('\nConsistency settings:'));
      console.log(`  checkNaming: ${chalk.bold(String(c.checkNaming ?? true))}`);
      console.log(`  checkPatterns: ${chalk.bold(String(c.checkPatterns ?? true))}`);
      console.log(`  checkArchitecture: ${chalk.bold(String(c.checkArchitecture ?? false))}`);
      if (c.minSeverity) console.log(`  minSeverity: ${chalk.bold(c.minSeverity)}`);
      if (c.acceptedAbbreviations) console.log(`  acceptedAbbreviations: ${chalk.bold(truncateArray(c.acceptedAbbreviations, 8))}`);
      if (c.shortWords) console.log(`  shortWords: ${chalk.bold(truncateArray(c.shortWords, 8))}`);
    }

    console.log(chalk.white('\nStarting analysis...'));

    // Progress callback to surface per-tool output as each tool finishes
    const progressCallback = (event: { tool: string; data: any }) => {
      console.log(chalk.cyan(`\n--- ${event.tool.toUpperCase()} RESULTS ---`));
      try {
        if (event.tool === 'patterns') {
          const pr = event.data as any;
          console.log(`  Duplicate patterns: ${chalk.bold(String(pr.duplicates?.length || 0))}`);
          console.log(`  Files with pattern issues: ${chalk.bold(String(pr.results?.length || 0))}`);
          // show top duplicate summaries
          if (pr.duplicates && pr.duplicates.length > 0) {
            pr.duplicates.slice(0, 5).forEach((d: any, i: number) => {
              console.log(`   ${i + 1}. ${d.file1.split('/').pop()} ↔ ${d.file2.split('/').pop()} (sim=${(d.similarity * 100).toFixed(1)}%)`);
            });
          }

          // show top files with pattern issues (sorted by issue count desc)
          if (pr.results && pr.results.length > 0) {
            console.log(`  Top files with pattern issues:`);
            const sortedByIssues = [...pr.results].sort((a: any, b: any) => (b.issues?.length || 0) - (a.issues?.length || 0));
            sortedByIssues.slice(0, 5).forEach((r: any, i: number) => {
              console.log(`   ${i + 1}. ${r.fileName.split('/').pop()} - ${r.issues.length} issue(s)`);
            });
          }

          // Grouping and clusters summary (if available) — show after detailed findings
          if (pr.groups && pr.groups.length >= 0) {
            console.log(`  ✅ Grouped ${chalk.bold(String(pr.duplicates?.length || 0))} duplicates into ${chalk.bold(String(pr.groups.length))} file pairs`);
          }
          if (pr.clusters && pr.clusters.length >= 0) {
            console.log(`  ✅ Created ${chalk.bold(String(pr.clusters.length))} refactor clusters`);
            // show brief cluster summaries
            pr.clusters.slice(0, 3).forEach((cl: any, idx: number) => {
              const files = (cl.files || []).map((f: any) => f.path.split('/').pop()).join(', ');
              console.log(`   ${idx + 1}. ${files} (${cl.tokenCost || 'n/a'} tokens)`);
            });
          }
        } else if (event.tool === 'context') {
          const cr = event.data as any[];
          console.log(`  Context issues found: ${chalk.bold(String(cr.length || 0))}`);
          cr.slice(0, 5).forEach((c: any, i: number) => {
            const msg = c.message ? ` - ${c.message}` : '';
            console.log(`   ${i + 1}. ${c.file} (${c.severity || 'n/a'})${msg}`);
          });
        } else if (event.tool === 'consistency') {
          const rep = event.data as any;
          console.log(`  Consistency totalIssues: ${chalk.bold(String(rep.summary?.totalIssues || 0))}`);

          if (rep.results && rep.results.length > 0) {
            // Group issues by file
            const fileMap = new Map<string, any[]>();
            rep.results.forEach((r: any) => {
              (r.issues || []).forEach((issue: any) => {
                const file = issue.location?.file || r.file || 'unknown';
                if (!fileMap.has(file)) fileMap.set(file, []);
                fileMap.get(file)!.push(issue);
              });
            });

            // Sort files by number of issues desc
            const files = Array.from(fileMap.entries()).sort((a, b) => b[1].length - a[1].length);
            const topFiles = files.slice(0, 10);

            topFiles.forEach(([file, issues], idx) => {
              // Count severities
              const counts = issues.reduce((acc: any, it: any) => {
                const s = (it.severity || 'info').toLowerCase();
                acc[s] = (acc[s] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              const sample = issues.find((it: any) => it.severity === 'critical' || it.severity === 'major') || issues[0];
              const sampleMsg = sample ? ` — ${sample.message}` : '';

              console.log(`   ${idx + 1}. ${file} — ${issues.length} issue(s) (critical:${counts.critical || 0} major:${counts.major || 0} minor:${counts.minor || 0} info:${counts.info || 0})${sampleMsg}`);
            });

            const remaining = files.length - topFiles.length;
            if (remaining > 0) {
              console.log(chalk.dim(`   ... and ${remaining} more files with issues (use --output json for full details)`));
            }
          }
        }
      } catch (err) {
        // don't crash the run for progress printing errors
      }
    };

    const results = await analyzeUnified({ ...finalOptions, progressCallback, suppressToolConfig: true });

    // Summarize tools and results to console
    console.log(chalk.cyan('\n=== AIReady Run Summary ==='));
    console.log(chalk.white('Tools run:'), (finalOptions.tools || ['patterns', 'context', 'consistency']).join(', '));

    // Results summary
    console.log(chalk.cyan('\nResults summary:'));
    console.log(`  Total issues (all tools): ${chalk.bold(String(results.summary.totalIssues || 0))}`);
    if (results.duplicates) console.log(`  Duplicate patterns found: ${chalk.bold(String(results.duplicates.length || 0))}`);
    if (results.patterns) console.log(`  Pattern files with issues: ${chalk.bold(String(results.patterns.length || 0))}`);
    if (results.context) console.log(`  Context issues: ${chalk.bold(String(results.context.length || 0))}`);
    if (results.consistency) console.log(`  Consistency issues: ${chalk.bold(String(results.consistency.summary.totalIssues || 0))}`);
    console.log(chalk.cyan('===========================\n'));

    const elapsedTime = getElapsedTime(startTime);

    // Calculate score if requested: assemble per-tool scoring outputs
    let scoringResult: ReturnType<typeof calculateOverallScore> | undefined;
    if (options.score || finalOptions.scoring?.showBreakdown) {
      const toolScores: Map<string, ToolScoringOutput> = new Map();

      // Patterns score
      if (results.duplicates) {
        const { calculatePatternScore } = await import('@aiready/pattern-detect');
        try {
          const patternScore = calculatePatternScore(results.duplicates, results.patterns?.length || 0);
          toolScores.set('pattern-detect', patternScore);
        } catch (err) {
          // ignore scoring failures for a single tool
        }
      }

      // Context score
      if (results.context) {
        const { generateSummary: genContextSummary, calculateContextScore } = await import('@aiready/context-analyzer');
        try {
          const ctxSummary = genContextSummary(results.context);
          const contextScore = calculateContextScore(ctxSummary);
          toolScores.set('context-analyzer', contextScore);
        } catch (err) {
          // ignore
        }
      }

      // Consistency score
      if (results.consistency) {
        const { calculateConsistencyScore } = await import('@aiready/consistency');
        try {
          const issues = results.consistency.results?.flatMap((r: any) => r.issues) || [];
          const totalFiles = results.consistency.summary?.filesAnalyzed || 0;
          const consistencyScore = calculateConsistencyScore(issues, totalFiles);
          toolScores.set('consistency', consistencyScore);
        } catch (err) {
          // ignore
        }
      }

      // Hallucination risk score
      if (finalOptions.tools.includes('hallucination') || finalOptions.tools.includes('hallucination-risk')) {
        try {
          const { hallucinationRiskAction } = await import('./hallucination-risk');
          const hrScore = await hallucinationRiskAction(resolvedDir, { ...finalOptions, output: 'json' });
          if (hrScore) toolScores.set('hallucination-risk', hrScore);
        } catch (err) {
          // ignore if spoke not installed yet
        }
      }

      // Agent grounding score
      if (finalOptions.tools.includes('grounding') || finalOptions.tools.includes('agent-grounding')) {
        try {
          const { agentGroundingAction } = await import('./agent-grounding');
          const agScore = await agentGroundingAction(resolvedDir, { ...finalOptions, output: 'json' });
          if (agScore) toolScores.set('agent-grounding', agScore);
        } catch (err) {
          // ignore if spoke not installed yet
        }
      }

      // Testability score
      if (finalOptions.tools.includes('testability')) {
        try {
          const { testabilityAction } = await import('./testability');
          const tbScore = await testabilityAction(resolvedDir, { ...finalOptions, output: 'json' });
          if (tbScore) toolScores.set('testability', tbScore);
        } catch (err) {
          // ignore if spoke not installed yet
        }
      }

      // Documentation Drift score
      if (finalOptions.tools.includes('doc-drift')) {
        try {
          const { docDriftAction } = await import('./doc-drift');
          const ddScore = await docDriftAction(resolvedDir, { ...finalOptions, output: 'json' });
          if (ddScore) toolScores.set('doc-drift', ddScore);
        } catch (err) {
          // ignore if spoke not installed yet
        }
      }

      // Dependency Health score
      if (finalOptions.tools.includes('deps-health')) {
        try {
          const { depsHealthAction } = await import('./deps-health');
          const dhScore = await depsHealthAction(resolvedDir, { ...finalOptions, output: 'json' });
          if (dhScore) toolScores.set('dependency-health', dhScore);
        } catch (err) {
          // ignore if spoke not installed yet
        }
      }

      // Parse CLI weight overrides (if any)
      const cliWeights = parseWeightString((options as any).weights);

      // Only calculate overall score if we have at least one tool score
      if (toolScores.size > 0) {
        scoringResult = calculateOverallScore(toolScores, finalOptions, cliWeights.size ? cliWeights : undefined);

        console.log(chalk.bold('\n📊 AI Readiness Overall Score'));
        console.log(`  ${formatScore(scoringResult)}`);

        // Check if we need to compare to a previous report
        if (options.compareTo) {
          try {
            const prevReportStr = readFileSync(resolvePath(process.cwd(), options.compareTo), 'utf8');
            const prevReport = JSON.parse(prevReportStr);
            const prevScore = prevReport.scoring?.score || prevReport.scoring?.overallScore;

            if (typeof prevScore === 'number') {
              const diff = scoringResult.overall - prevScore;
              const diffStr = diff > 0 ? `+${diff}` : String(diff);
              console.log();
              if (diff > 0) {
                console.log(chalk.green(`  📈 Trend: ${diffStr} compared to ${options.compareTo} (${prevScore} → ${scoringResult.overall})`));
              } else if (diff < 0) {
                console.log(chalk.red(`  📉 Trend: ${diffStr} compared to ${options.compareTo} (${prevScore} → ${scoringResult.overall})`));
                // Trend gating: if we regressed and CI is on or threshold is present, we could lower the threshold effectively,
                // but for now, we just highlight the regression.
              } else {
                console.log(chalk.blue(`  ➖ Trend: No change compared to ${options.compareTo} (${prevScore} → ${scoringResult.overall})`));
              }

              // Add trend info to scoringResult for programmatic use
              (scoringResult as any).trend = {
                previousScore: prevScore,
                difference: diff
              };
            } else {
              console.log(chalk.yellow(`\n  ⚠️  Previous report at ${options.compareTo} does not contain an overall score.`));
            }
          } catch (e) {
            console.log(chalk.yellow(`\n  ⚠️  Could not read or parse previous report at ${options.compareTo}.`));
          }
        }

        // Show concise breakdown; detailed breakdown only if config requests it
        if (scoringResult.breakdown && scoringResult.breakdown.length > 0) {
          console.log(chalk.bold('\nTool breakdown:'));
          scoringResult.breakdown.forEach((tool) => {
            const rating = getRating(tool.score);
            const rd = getRatingDisplay(rating);
            console.log(`  - ${tool.toolName}: ${tool.score}/100 (${rating}) ${rd.emoji}`);
          });
          console.log();

          if (finalOptions.scoring?.showBreakdown) {
            console.log(chalk.bold('Detailed tool breakdown:'));
            scoringResult.breakdown.forEach((tool) => {
              console.log(formatToolScore(tool));
            });
            console.log();
          }
        }
      }
    }

    // Persist JSON summary when output format is json
    const outputFormat = options.output || finalOptions.output?.format || 'console';
    const userOutputFile = options.outputFile || finalOptions.output?.file;
    if (outputFormat === 'json') {
      const timestamp = getReportTimestamp();
      const defaultFilename = `aiready-report-${timestamp}.json`;
      const outputPath = resolveOutputPath(userOutputFile, defaultFilename, resolvedDir);
      const outputData = { ...results, scoring: scoringResult };
      handleJSONOutput(outputData, outputPath, `✅ Report saved to ${outputPath}`);

      // Warn if graph caps may be exceeded
      warnIfGraphCapExceeded(outputData, resolvedDir);
    }

    // CI/CD Gatekeeper Mode
    const isCI = options.ci || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    if (isCI && scoringResult) {
      const threshold = options.threshold ? parseInt(options.threshold) : undefined;
      const failOnLevel = options.failOn || 'critical';

      // Output GitHub Actions annotations
      if (process.env.GITHUB_ACTIONS === 'true') {
        console.log(`\n::group::AI Readiness Score`);
        console.log(`score=${scoringResult.overall}`);
        if (scoringResult.breakdown) {
          scoringResult.breakdown.forEach(tool => {
            console.log(`${tool.toolName}=${tool.score}`);
          });
        }
        console.log('::endgroup::');

        // Output annotation for score
        if (threshold && scoringResult.overall < threshold) {
          console.log(`::error::AI Readiness Score ${scoringResult.overall} is below threshold ${threshold}`);
        } else if (threshold) {
          console.log(`::notice::AI Readiness Score: ${scoringResult.overall}/100 (threshold: ${threshold})`);
        }

        // Output annotations for critical issues
        if (results.patterns) {
          const criticalPatterns = results.patterns.flatMap((p: any) =>
            p.issues.filter((i: any) => i.severity === 'critical')
          );
          criticalPatterns.slice(0, 10).forEach((issue: any) => {
            console.log(`::warning file=${issue.location?.file || 'unknown'},line=${issue.location?.line || 1}::${issue.message}`);
          });
        }
      }

      // Determine if we should fail
      let shouldFail = false;
      let failReason = '';

      // Check threshold
      if (threshold && scoringResult.overall < threshold) {
        shouldFail = true;
        failReason = `AI Readiness Score ${scoringResult.overall} is below threshold ${threshold}`;
      }

      // Check fail-on severity
      if (failOnLevel !== 'none') {
        const severityLevels = { critical: 4, major: 3, minor: 2, any: 1 };
        const minSeverity = severityLevels[failOnLevel as keyof typeof severityLevels] || 4;

        let criticalCount = 0;
        let majorCount = 0;

        if (results.patterns) {
          results.patterns.forEach((p: any) => {
            p.issues.forEach((i: any) => {
              if (i.severity === 'critical') criticalCount++;
              if (i.severity === 'major') majorCount++;
            });
          });
        }
        if (results.context) {
          results.context.forEach((c: any) => {
            if (c.severity === 'critical') criticalCount++;
            if (c.severity === 'major') majorCount++;
          });
        }
        if (results.consistency?.results) {
          results.consistency.results.forEach((r: any) => {
            r.issues?.forEach((i: any) => {
              if (i.severity === 'critical') criticalCount++;
              if (i.severity === 'major') majorCount++;
            });
          });
        }

        if (minSeverity >= 4 && criticalCount > 0) {
          shouldFail = true;
          failReason = `Found ${criticalCount} critical issues`;
        } else if (minSeverity >= 3 && (criticalCount + majorCount) > 0) {
          shouldFail = true;
          failReason = `Found ${criticalCount} critical and ${majorCount} major issues`;
        }
      }

      // Output result
      if (shouldFail) {
        console.log(chalk.red('\n🚫 PR BLOCKED: AI Readiness Check Failed'));
        console.log(chalk.red(`   Reason: ${failReason}`));
        console.log(chalk.dim('\n   Remediation steps:'));
        console.log(chalk.dim('   1. Run `aiready scan` locally to see detailed issues'));
        console.log(chalk.dim('   2. Fix the critical issues before merging'));
        console.log(chalk.dim('   3. Consider upgrading to Team plan for historical tracking: https://getaiready.dev/pricing'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ PR PASSED: AI Readiness Check'));
        if (threshold) {
          console.log(chalk.green(`   Score: ${scoringResult.overall}/100 (threshold: ${threshold})`));
        }
        console.log(chalk.dim('\n   💡 Track historical trends: https://getaiready.dev — Team plan $99/mo'));
      }
    }
  } catch (error) {
    handleCLIError(error, 'Analysis');
  }
}

export const scanHelpText = `
EXAMPLES:
  $ aiready scan                                    # Analyze all tools
  $ aiready scan --tools patterns,context           # Skip consistency
  $ aiready scan --profile agentic                  # Optimize for AI agent execution
  $ aiready scan --profile security                 # Optimize for secure coding (testability)
  $ aiready scan --compare-to prev-report.json      # Compare trends against previous run
  $ aiready scan --score --threshold 75             # CI/CD with threshold
  $ aiready scan --ci --threshold 70                # GitHub Actions gatekeeper
  $ aiready scan --ci --fail-on major               # Fail on major+ issues
  $ aiready scan --output json --output-file report.json

PROFILES:
  agentic:      hallucination, grounding, testability
  cost:         patterns, context
  security:     consistency, testability
  onboarding:   context, consistency, grounding

CI/CD INTEGRATION (Gatekeeper Mode):
  Use --ci for GitHub Actions integration:
  - Outputs GitHub Actions annotations for PR checks
  - Fails with exit code 1 if threshold not met
  - Shows clear "blocked" message with remediation steps

  Example GitHub Actions workflow:
    - name: AI Readiness Check
      run: aiready scan --ci --threshold 70
`;