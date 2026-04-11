/**
 * Scan command - Run comprehensive AI-readiness analysis using the tool registry
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve as resolvePath, join, relative } from 'path';
import {
  handleJSONOutput,
  handleCLIError,
  resolveOutputPath,
  getRepoMetadata,
  emitIssuesAsAnnotations,
  Severity,
  safeJsonStringify,
} from '@aiready/core';
import type { UnifiedReport, ScoringResult } from '@aiready/core';
import { getReportTimestamp, warnIfGraphCapExceeded } from '../utils';
import {
  mapToUnifiedReport,
  printOverallScore,
  handleTrendComparison,
} from './report-formatter';
import { uploadAction } from './upload';
import { type ScanOptions } from './scan-helpers';
import { resolveScanConfig } from './scan-config';
import { runUnifiedScan } from './scan-orchestrator';

/**
 * CLI action handler for the "scan" command.
 * Runs a comprehensive AI-readiness analysis across multiple tools.
 *
 * @param directory - The directory to analyze (defaults to ".")
 * @param options - CLI options from commander
 */
export async function scanAction(directory: string, options: ScanOptions) {
  console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

  const startTime = Date.now();
  const resolvedDir = resolvePath(process.cwd(), directory ?? '.');
  const repoMetadata = getRepoMetadata(resolvedDir);

  try {
    // 1. Resolve configuration
    const finalOptions = await resolveScanConfig(resolvedDir, options);

    // 2. Execute Scan Orchestration
    const { results, scoringResult, scoringProfile } = await runUnifiedScan(
      resolvedDir,
      finalOptions,
      options,
      startTime
    );

    // 3. Post-processing & Reporting
    console.log(
      chalk.dim(
        '\n──────────────────────────────────────────────────────────────────'
      )
    );
    console.log(chalk.dim('💬 Found a bug or have a metric idea?'));
    console.log(chalk.dim('👉 Copy/paste this to your AI agent:'));
    console.log(
      chalk.cyan(
        `   "Any feedback for the tools? Please use 'aiready bug' to report ❤️"`
      )
    );
    console.log(
      chalk.dim(
        '──────────────────────────────────────────────────────────────────'
      )
    );

    const outputData = {
      ...mapToUnifiedReport(results, scoringResult),
      repository: repoMetadata,
    };

    // 4. Apply Baseline & Severity Overrides
    applyGatingRules(outputData, options, finalOptions, resolvedDir);

    // 5. Output persistence
    const finalOptionsRecord = finalOptions as Record<string, unknown>;
    const outputConfig = finalOptionsRecord.output as
      | Record<string, unknown>
      | undefined;
    const outputFormat =
      options.output ?? (outputConfig?.format as string) ?? 'console';
    const outputPath = resolveOutputPath(
      options.outputFile ?? (outputConfig?.file as string),
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
        writeFileSync(outputPath, safeJsonStringify(outputData, 2));
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

    // 6. Final Scoring Summary
    if (scoringResult) {
      printOverallScore(scoringResult, scoringProfile || 'default');
      if (options.compareTo) {
        handleTrendComparison(options.compareTo, scoringResult);
      }
    }

    // 7. Gatekeeper Logic (Thresholds & CI Failures)
    await handleGatekeeper(
      outputData,
      scoringResult,
      options,
      finalOptions,
      resolvedDir
    );

    // 8. Deep Link to Platform
    const isCI = options.ci ?? process.env.CI === 'true';
    if (!isCI) {
      console.log(
        chalk.dim(
          '\n──────────────────────────────────────────────────────────────────'
        )
      );
      console.log(chalk.bold('📈 Want to see the full interactive report?'));
      console.log(
        chalk.cyan(
          `   Upload this report to: ${chalk.bold('https://platform.getaiready.dev')}`
        )
      );
      console.log(
        chalk.dim('   Or run: ') + chalk.white(`aiready upload ${outputPath}`)
      );
      console.log(
        chalk.dim(
          '──────────────────────────────────────────────────────────────────'
        )
      );
    }
  } catch (error) {
    handleCLIError(error, 'Analysis');
  }
}

/**
 * Applies baseline filtering and severity overrides to the report.
 */
function applyGatingRules(
  report: UnifiedReport,
  options: ScanOptions,
  finalOptions: Record<string, unknown>,
  resolvedDir: string
) {
  // 1. Load Baseline if requested
  const baselineHashes = new Set<string>();
  if (options.baseline) {
    const baselinePath = join(resolvedDir, '.aiready', 'baseline.json');
    if (existsSync(baselinePath)) {
      try {
        const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
        if (baseline.results) {
          baseline.results.forEach((fileRes: any) => {
            const relPath = relative(
              resolvedDir,
              resolvePath(resolvedDir, fileRes.fileName || fileRes.filePath)
            );
            if (fileRes.issues) {
              fileRes.issues.forEach((issue: any) => {
                baselineHashes.add(
                  getIssueHash(issue, issue.toolId || 'unknown', relPath)
                );
              });
            }
          });
        }
        console.log(
          chalk.dim(
            `   Loaded baseline with ${baselineHashes.size} existing issues to filter.`
          )
        );
      } catch (err) {
        console.warn(
          chalk.yellow(
            `   Warning: Failed to load baseline from ${baselinePath}`
          )
        );
      }
    } else {
      console.warn(
        chalk.yellow(`   Warning: Baseline file not found at ${baselinePath}`)
      );
    }
  }

  // 2. Apply Severity Overrides and Filter Baseline
  let criticalCount = 0;
  let majorCount = 0;
  let minorCount = 0;

  report.results.forEach((fileRes: Record<string, any>) => {
    const relPath = relative(
      resolvedDir,
      resolvePath(resolvedDir, fileRes.fileName || fileRes.filePath)
    );
    const filteredIssues = (fileRes.issues || []).filter((issue: any) => {
      // a. Apply Severity Overrides
      const toolId = issue.toolId || 'unknown';
      const category = issue.category || '';
      const toolConfig =
        (finalOptions.tools as Record<string, any>)?.[toolId] || {};
      const overrides =
        (toolConfig.severityOverrides as Record<string, any>) || {};

      if (overrides[category]) {
        issue.severity = overrides[category];
      }

      // b. Baseline Filtering
      if (options.baseline) {
        const hash = getIssueHash(issue, toolId, relPath);
        if (baselineHashes.has(hash)) {
          return false; // Skip existing issue
        }
      }
      return true;
    });

    fileRes.issues = filteredIssues;
    filteredIssues.forEach((i: any) => {
      const s = String(i.severity || '').toLowerCase();
      if (s === 'critical') criticalCount++;
      else if (s === 'major') majorCount++;
      else if (s === 'minor') minorCount++;
    });
  });

  // Update summary counts
  report.summary.criticalIssues = criticalCount;
  report.summary.majorIssues = majorCount;
  report.summary.minorIssues = minorCount;

  if (options.baseline && baselineHashes.size > 0) {
    const totalRemaining = criticalCount + majorCount + minorCount;
    console.log(
      chalk.green(
        `   Baseline filtering applied: ${totalRemaining} new issues remaining.`
      )
    );
  }
}

/**
 * Handles threshold checks and CI failures based on scan results.
 */
async function handleGatekeeper(
  outputData: UnifiedReport,
  scoringResult: ScoringResult | undefined,
  options: ScanOptions,
  finalOptions: Record<string, unknown>,
  resolvedDir: string
) {
  if (!scoringResult) return;

  const threshold = options.threshold
    ? parseInt(options.threshold)
    : (finalOptions.threshold as number | undefined);

  const isCI = options.ci ?? process.env.CI === 'true';

  // AIReady is a quality gate. If a threshold is defined, it should be enforced by default
  // unless explicitly disabled with --fail-on none.
  const defaultFailOn = isCI || threshold !== undefined ? 'critical' : 'none';

  const failOnLevel =
    options.failOn ??
    (finalOptions.failOn as string | undefined) ??
    defaultFailOn;

  let shouldFail = false;
  let failReason = '';

  // Emit annotations only in CI
  if (isCI && outputData.results && outputData.results.length > 0) {
    console.log(
      chalk.cyan(
        `\n📝 Emitting GitHub Action annotations for ${outputData.results.length} issues...`
      )
    );
    emitIssuesAsAnnotations(outputData.results);
  }

  if (failOnLevel !== 'none') {
    if (threshold && scoringResult.overall < threshold) {
      shouldFail = true;
      failReason = `Score ${scoringResult.overall} < threshold ${threshold}`;
    }
  }

  if (failOnLevel !== 'none' && !shouldFail) {
    if (failOnLevel === 'critical' && outputData.summary.criticalIssues > 0) {
      shouldFail = true;
      failReason = `Found ${outputData.summary.criticalIssues} critical issues`;
    } else if (
      failOnLevel === 'major' &&
      outputData.summary.criticalIssues + outputData.summary.majorIssues > 0
    ) {
      shouldFail = true;
      failReason = `Found ${outputData.summary.criticalIssues} critical and ${outputData.summary.majorIssues} major issues`;
    }
  }

  if (shouldFail) {
    console.log(chalk.red(`\n🚫 SCAN FAILED: ${failReason}`));
    process.exit(1);
  } else {
    console.log(chalk.green('\n✅ SCAN PASSED'));
  }
}

export const SCAN_HELP_TEXT = `
Run a comprehensive AI-readiness scan of your codebase.

${chalk.bold('Examples:')}
  $ aiready scan .
  $ aiready scan src --profile agentic
  $ aiready scan . --threshold 80 --fail-on critical
  $ aiready scan . --output json --output-file report.json

${chalk.bold('Profiles:')}
  agentic     - Focus on AI signal clarity and agent grounding
  cost        - Focus on token budget and pattern reuse
  logic       - Focus on testability and naming consistency
  ui          - Focus on component naming and documentation
  security    - Focus on naming and testability
  onboarding  - Focus on context and grounding

${chalk.bold('CI/CD Integration:')}
  Use --threshold and --fail-on to use AIReady as a quality gate in your CI pipelines.
  When running in GitHub Actions, it will automatically emit annotations for found issues.
`;

/**
 * Define the scan command.
 */
export function defineScanCommand(program: Command) {
  program
    .command('scan')
    .description(
      'Run comprehensive AI-readiness analysis (patterns + context + consistency)'
    )
    .argument('[directory]', 'Directory to analyze', '.')
    .option(
      '-t, --tools <tools>',
      'Tools to run (comma-separated: patterns,context,consistency,doc-drift,deps-health,aiSignalClarity,grounding,testability,changeAmplification)'
    )
    .option(
      '--profile <type>',
      'Scan profile to use (agentic, cost, logic, ui, security, onboarding)'
    )
    .option(
      '--compare-to <path>',
      'Compare results against a previous AIReady report JSON'
    )
    .option('--baseline', 'Filter findings against a debt-baseline file')
    .option(
      '-C, --changed-files-only',
      'Only scan files changed in git (staged or unstaged)'
    )
    .option(
      '--include <patterns>',
      'File patterns to include (comma-separated)'
    )
    .option(
      '--exclude <patterns>',
      'File patterns to exclude (comma-separated)'
    )
    .option('-o, --output <format>', 'Output format: console, json', 'console')
    .option('--output-file <path>', 'Output file path (for json)')
    .option('--score', 'Calculate and display AI Readiness Score (0-100)', true)
    .option('--no-score', 'Disable calculating AI Readiness Score')
    .option('--weights <weights>', 'Custom scoring weights')
    .option(
      '--threshold <score>',
      'Fail CI/CD if score below threshold (0-100)'
    )
    .option(
      '--ci',
      'CI mode: GitHub Actions annotations, no colors, fail on threshold'
    )
    .option('--fail-on <level>', 'Fail on issues: critical, major, any')
    .option('--api-key <key>', 'Platform API key for automatic upload')
    .option('--upload', 'Automatically upload results to the platform')
    .option('--server <url>', 'Custom platform URL')
    .option('--verbose', 'Show verbose output for debugging')
    .addHelpText('after', SCAN_HELP_TEXT)
    .action(async (directory, options) => {
      await scanAction(directory, options);
    });
}

/**
 * Generate a unique hash for an issue to identify it across scans.
 * Excludes line numbers to handle code shifts.
 */
function getIssueHash(
  issue: any,
  toolId: string,
  relativePath: string
): string {
  const parts = [
    toolId,
    issue.category || issue.type || '',
    relativePath,
    (issue.message || '').trim().toLowerCase(),
  ];
  return parts.join('|');
}
