#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeConsistency } from './analyzer';
import type { ConsistencyOptions } from './types';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import {
  loadConfig,
  mergeConfigWithDefaults,
  resolveOutputPath,
} from '@aiready/core';

const program = new Command();

program
  .name('aiready-consistency')
  .description(
    'Detect consistency patterns in naming, code structure, and architecture'
  )
  .version('0.1.0')
  .addHelpText(
    'after',
    `
LANGUAGE SUPPORT:
  Supported: TypeScript (.ts, .tsx), JavaScript (.js, .jsx)
  Note: Python, Java, and other language files will be safely ignored

CONFIGURATION:
  Supports config files: aiready.json, aiready.config.json, .aiready.json, .aireadyrc.json
  CLI options override config file settings

ANALYSIS CATEGORIES:
  --naming         Check naming conventions and quality (default: enabled)
  --patterns       Check code pattern consistency (default: enabled)
  --architecture   Check architectural consistency (coming soon)

EXAMPLES:
  aiready-consistency .                               # Full analysis
  aiready-consistency . --no-naming                   # Skip naming checks
  aiready-consistency . --min-severity major          # Only show major+ patterns
  aiready-consistency . --output json > report.json   # JSON export
`
  )
  .argument('<directory>', 'Directory to analyze')
  .option('--naming', 'Check naming conventions and quality (default: true)')
  .option('--no-naming', 'Skip naming analysis')
  .option('--patterns', 'Check code pattern consistency (default: true)')
  .option('--no-patterns', 'Skip pattern analysis')
  .option(
    '--architecture',
    'Check architectural consistency (not yet implemented)'
  )
  .option(
    '--min-severity <level>',
    'Minimum severity: info|minor|major|critical. Default: info'
  )
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option(
    '-o, --output <format>',
    'Output format: console|json|markdown',
    'console'
  )
  .option('--output-file <path>', 'Output file path (for json/markdown)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing consistency...\n'));

    const startTime = Date.now();

    // Load config file if it exists
    const config = await loadConfig(directory);

    // Define defaults
    const defaults = {
      checkNaming: true,
      checkPatterns: true,
      checkArchitecture: false,
      minSeverity: 'info' as const,
      include: undefined,
      exclude: undefined,
    };

    // Merge config with defaults
    const mergedConfig = mergeConfigWithDefaults(config, defaults);

    // Override with CLI options (CLI takes precedence)
    const finalOptions: ConsistencyOptions = {
      rootDir: directory,
      checkNaming: options.naming !== false && mergedConfig.checkNaming,
      checkPatterns: options.patterns !== false && mergedConfig.checkPatterns,
      checkArchitecture: options.architecture || mergedConfig.checkArchitecture,
      minSeverity: (options.minSeverity as string) || mergedConfig.minSeverity,
      include: options.include?.split(',') || mergedConfig.include,
      exclude: options.exclude?.split(',') || mergedConfig.exclude,
    };

    const report = await analyzeConsistency(finalOptions);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Output based on format
    if (options.output === 'json') {
      const output = JSON.stringify(report, null, 2);
      const outputPath = resolveOutputPath(
        options.outputFile,
        `consistency-report-${new Date().toISOString().split('T')[0]}.json`,
        directory
      );

      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(outputPath, output);
      console.log(chalk.green(`✓ Report saved to ${outputPath}`));
    } else if (options.output === 'markdown') {
      const markdown = generateMarkdownReport(report, elapsedTime);
      const outputPath = resolveOutputPath(
        options.outputFile,
        `consistency-report-${new Date().toISOString().split('T')[0]}.md`,
        directory
      );

      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(outputPath, markdown);
      console.log(chalk.green(`✓ Report saved to ${outputPath}`));
    } else {
      // Console output
      displayConsoleReport(report, elapsedTime);
    }
  });

program.parse();

function displayConsoleReport(report: any, elapsedTime: string): void {
  const { summary, results, recommendations } = report;

  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(`Files Analyzed: ${chalk.cyan(summary.filesAnalyzed)}`);
  console.log(`Total Patterns Found: ${chalk.yellow(summary.totalIssues)}`);
  console.log(`  Naming: ${chalk.yellow(summary.namingIssues)}`);
  console.log(`  Code Patterns: ${chalk.yellow(summary.patternIssues)}`);
  console.log(`  Architecture: ${chalk.yellow(summary.architectureIssues)}`);
  console.log(`Analysis Time: ${chalk.gray(elapsedTime + 's')}\n`);

  if (summary.totalIssues === 0) {
    console.log(
      chalk.green(
        '✨ No consistency patterns found! Your codebase is AI-friendly.\n'
      )
    );
    return;
  }

  // Group issues by category
  const namingResults = results.filter((r: any) =>
    r.issues?.some((i: any) => i.category === 'naming')
  );
  const patternResults = results.filter((r: any) =>
    r.issues?.some((i: any) => i.category === 'patterns')
  );

  if (namingResults.length > 0) {
    console.log(chalk.bold('🏷️  Naming Patterns\n'));
    displayCategoryIssues(namingResults, 5);
  }

  if (patternResults.length > 0) {
    console.log(chalk.bold('\n🔄 Code Patterns\n'));
    displayCategoryIssues(patternResults, 5);
  }

  console.log(chalk.bold('\n💡 Recommendations\n'));
  recommendations.forEach((rec: string, i: number) => {
    console.log(`${i + 1}. ${rec}`);
  });

  console.log();
}

function displayCategoryIssues(results: any[], maxToShow: number): void {
  let shown = 0;
  for (const result of results) {
    if (shown >= maxToShow) break;

    for (const issue of result.issues || []) {
      if (shown >= maxToShow) break;

      const severityColor =
        issue.severity === 'critical'
          ? chalk.red
          : issue.severity === 'major'
            ? chalk.yellow
            : issue.severity === 'minor'
              ? chalk.blue
              : chalk.gray;

      console.log(
        `${severityColor(issue.severity.toUpperCase())} ${chalk.dim(
          `${issue.location.file}:${issue.location.line}`
        )}`
      );
      console.log(`  ${issue.message}`);
      if (issue.suggestion) {
        console.log(`  ${chalk.dim('→')} ${chalk.italic(issue.suggestion)}`);
      }
      console.log();
      shown++;
    }
  }

  const remaining =
    results.reduce((sum, r) => sum + (r.issues?.length || 0), 0) - shown;
  if (remaining > 0) {
    console.log(chalk.dim(`  ... and ${remaining} more patterns\n`));
  }
}

function generateMarkdownReport(report: any, elapsedTime: string): string {
  const { summary, results, recommendations } = report;

  let markdown = `# Consistency Analysis Report\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Analysis Time:** ${elapsedTime}s\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Files Analyzed:** ${summary.filesAnalyzed}\n`;
  markdown += `- **Total Patterns Found:** ${summary.totalIssues}\n`;
  markdown += `  - Naming: ${summary.namingIssues}\n`;
  markdown += `  - Code Patterns: ${summary.patternIssues}\n`;
  markdown += `  - Architecture: ${summary.architectureIssues}\n\n`;

  if (summary.totalIssues === 0) {
    markdown += `✨ No consistency patterns found! Your codebase is AI-friendly.\n`;
    return markdown;
  }

  markdown += `## Patterns by Category\n\n`;

  // Naming patterns
  const namingResults = results.filter((r: any) =>
    r.issues?.some((i: any) => i.category === 'naming')
  );
  if (namingResults.length > 0) {
    markdown += `### 🏷️ Naming Patterns\n\n`;
    for (const result of namingResults) {
      for (const issue of result.issues || []) {
        if (issue.category !== 'naming') continue;
        markdown += `- **${issue.severity.toUpperCase()}** \`${issue.location.file}:${issue.location.line}\`\n`;
        markdown += `  - ${issue.message}\n`;
        if (issue.suggestion) {
          markdown += `  - 💡 ${issue.suggestion}\n`;
        }
      }
    }
    markdown += `\n`;
  }

  // Code patterns
  const patternResults = results.filter((r: any) =>
    r.issues?.some((i: any) => i.category === 'patterns')
  );
  if (patternResults.length > 0) {
    markdown += `### 🔄 Code Patterns\n\n`;
    for (const result of patternResults) {
      for (const issue of result.issues || []) {
        if (issue.category !== 'patterns') continue;
        markdown += `- **${issue.severity.toUpperCase()}** ${issue.message}\n`;
        if (issue.examples && issue.examples.length > 0) {
          markdown += `  - Examples:\n`;
          issue.examples.forEach((ex: string) => {
            markdown += `    - ${ex}\n`;
          });
        }
        if (issue.suggestion) {
          markdown += `  - 💡 ${issue.suggestion}\n`;
        }
      }
    }
    markdown += `\n`;
  }

  markdown += `## Recommendations\n\n`;
  recommendations.forEach((rec: string, i: number) => {
    markdown += `${i + 1}. ${rec}\n`;
  });

  return markdown;
}
