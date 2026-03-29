/**
 * Scan command - Run comprehensive AI-readiness analysis using the tool registry
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import {
  handleJSONOutput,
  handleCLIError,
  resolveOutputPath,
  getRepoMetadata,
  emitIssuesAsAnnotations,
} from '@aiready/core';
import { getReportTimestamp, warnIfGraphCapExceeded } from '../utils';
import { mapToUnifiedReport } from './report-formatter';
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
    const { results, scoringResult } = await runUnifiedScan(
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

    // Output persistence
    const outputFormat =
      options.output ?? (finalOptions as any).output?.format ?? 'console';
    const outputPath = resolveOutputPath(
      options.outputFile ?? (finalOptions as any).output?.file,
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

    // 4. Gatekeeper Logic (Thresholds & CI Failures)
    await handleGatekeeper(
      outputData,
      scoringResult,
      options,
      finalOptions,
      results
    );

    // 5. Deep Link to Platform
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
 * Handles threshold checks and CI failures based on scan results.
 */
async function handleGatekeeper(
  outputData: any,
  scoringResult: any,
  options: ScanOptions,
  finalOptions: any,
  results: any
) {
  if (!scoringResult) return;

  const isCI = options.ci ?? process.env.CI === 'true';
  const defaultFailOn = isCI ? 'critical' : 'none';
  const threshold = options.threshold
    ? parseInt(options.threshold)
    : finalOptions.threshold;
  const failOnLevel = options.failOn ?? finalOptions.failOn ?? defaultFailOn;

  let shouldFail = false;
  let failReason = '';

  const report = mapToUnifiedReport(results, scoringResult);

  // Emit annotations only in CI
  if (isCI && report.results && report.results.length > 0) {
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

  if (failOnLevel !== 'none' && !shouldFail) {
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
    .addHelpText('after', SCAN_HELP_TEXT)
    .action(async (directory, options) => {
      await scanAction(directory, options);
    });
}
