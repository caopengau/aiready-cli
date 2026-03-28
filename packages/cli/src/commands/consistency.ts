import chalk from 'chalk';
import { Command } from 'commander';
import { printTerminalHeader, Severity } from '@aiready/core';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderSubSection,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface ConsistencyOptions extends BaseCommandOptions {
  naming?: boolean;
  patterns?: boolean;
  minSeverity?: Severity;
}

/**
 * Define the consistency command.
 *
 * @param program - Commander program instance
 */
export function defineConsistencyCommand(program: Command) {
  program
    .command('consistency')
    .description('Check naming conventions and architectural consistency')
    .argument('[directory]', 'Directory to analyze', '.')
    .option('--naming', 'Check naming conventions (default: true)')
    .option('--no-naming', 'Skip naming analysis')
    .option('--patterns', 'Check code patterns (default: true)')
    .option('--no-patterns', 'Skip pattern analysis')
    .option(
      '--min-severity <level>',
      'Minimum severity: info|minor|major|critical',
      'info'
    )
    .option(
      '--include <patterns>',
      'File patterns to include (comma-separated)'
    )
    .option(
      '--exclude <patterns>',
      'File patterns to exclude (comma-separated)'
    )
    .option(
      '-o, --output <format>',
      'Output format: console, json, markdown',
      'console'
    )
    .option('--output-file <path>', 'Output file path (for json/markdown)')
    .option('--score', 'Calculate and display AI Readiness Score (0-100)', true)
    .option('--no-score', 'Disable calculating AI Readiness Score')
    .action(async (directory, options) => {
      await consistencyAction(directory, options);
    });
}

/**
 * Action handler for consistency analysis.
 */
export async function consistencyAction(
  directory: string,
  options: ConsistencyOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'naming-consistency',
    label: 'Consistency analysis',
    emoji: '📏',
    defaults: {
      rootDir: '',
      checkNaming: options.naming !== false,
      checkPatterns: options.patterns !== false,
      minSeverity: (options.minSeverity || 'info') as Severity,
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
    },
    getCliOptions: (opts) => ({
      checkNaming: opts.naming !== false,
      checkPatterns: opts.patterns !== false,
      minSeverity: opts.minSeverity as Severity | undefined,
    }),
    importTool: async () => {
      const { analyzeConsistency, generateSummary, calculateConsistencyScore } =
        await import('@aiready/consistency');
      return {
        analyze: async (opts) => {
          const report = await analyzeConsistency(opts);
          // Return the full report so renderConsole can access summary/results
          return report;
        },
        generateSummary,
        calculateScore: (data: any, resultsCount?: number) =>
          calculateConsistencyScore(data, resultsCount ?? 0),
      };
    },
    renderConsole: ({ results: report, summary, elapsedTime, score }) => {
      printTerminalHeader('CONSISTENCY ANALYSIS SUMMARY');

      console.log(
        chalk.white(`📁 Files analyzed: ${chalk.bold(summary.filesAnalyzed)}`)
      );
      console.log(
        chalk.white(`⚠  Total issues: ${chalk.bold(summary.totalIssues)}`)
      );
      console.log(
        chalk.gray(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}`)
      );

      if (summary.totalIssues > 0 && report.results) {
        renderSubSection('Issues Breakdown');
        const sortedIssues = [...report.results]
          .flatMap((file: any) =>
            (file.issues || []).map((issue: any) => ({
              ...issue,
              file: file.fileName,
            }))
          )
          .sort((a: any, b: any) => {
            const levels: Record<string, number> = {
              critical: 4,
              major: 3,
              minor: 2,
              info: 1,
            };
            return (levels[b.severity] || 0) - (levels[a.severity] || 0);
          })
          .slice(0, 10);

        sortedIssues.forEach((issue: any) => {
          const icon =
            issue.severity === 'critical'
              ? '🔴'
              : issue.severity === 'major'
                ? '🟡'
                : '🔵';
          const color =
            issue.severity === 'critical'
              ? chalk.red
              : issue.severity === 'major'
                ? chalk.yellow
                : chalk.blue;

          console.log(
            `  ${icon} ${color(issue.severity.toUpperCase())}: ${chalk.white(issue.file)}${issue.line ? `:${issue.line}` : ''}`
          );
          console.log(`     ${issue.message}`);
          if (issue.suggestion) {
            console.log(chalk.dim(`     💡 ${issue.suggestion}`));
          }
          console.log();
        });
      } else {
        console.log(
          chalk.green('\n✨ Great! No consistency issues detected.\n')
        );
      }

      renderToolScoreFooter(score);
    },
  });
}
