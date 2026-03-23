import chalk from 'chalk';
import { writeFileSync } from 'fs';
import {
  resolveOutputPath,
  formatToolScore,
  resolveOutputFormat,
} from '@aiready/core';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import { getReportTimestamp, generateMarkdownReport } from '../utils';

interface ConsistencyOptions extends BaseCommandOptions {
  naming?: boolean;
  patterns?: boolean;
  minSeverity?: string;
}

export async function consistencyAction(
  directory: string,
  options: ConsistencyOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'naming-consistency',
    label: 'Consistency analysis',
    emoji: '🔍',
    defaults: {
      checkNaming: true,
      checkPatterns: true,
      minSeverity: 'info' as const,
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
    },
    getCliOptions: (opts) => ({
      checkNaming: opts.naming !== false,
      checkPatterns: opts.patterns !== false,
      minSeverity: opts.minSeverity,
    }),
    importTool: async () => {
      const { analyzeConsistency, calculateConsistencyScore } =
        await import('@aiready/consistency');
      return {
        analyze: analyzeConsistency as any,
        generateSummary: (report: any) => report.summary,
        calculateScore: (summary: any, _resultsCount?: number) => {
          // Calculate score based on results in report
          // This requires the full report which is results in our generic action
          return calculateConsistencyScore(
            summary.results?.flatMap((r: any) => r.issues) ?? [],
            summary.summary.filesAnalyzed
          );
        },
      };
    },
    renderConsole: ({ results, summary, elapsedTime, score, finalOptions }) => {
      const report = results as any;
      const { format: outputFormat, file: userOutputFile } =
        resolveOutputFormat(options, finalOptions as any);

      if (outputFormat === 'markdown') {
        const markdown = generateMarkdownReport(report, elapsedTime);
        const outputPath = resolveOutputPath(
          userOutputFile,
          `aiready-report-${getReportTimestamp()}.md`,
          directory
        );
        writeFileSync(outputPath, markdown);
        console.log(chalk.green(`✅ Report saved to ${outputPath}`));
        return;
      }

      console.log(chalk.bold('\n📊 Summary\n'));
      console.log(`Files Analyzed: ${chalk.cyan(summary.filesAnalyzed)}`);
      console.log(`Total Issues: ${chalk.yellow(summary.totalIssues)}`);
      console.log(`  Naming: ${chalk.yellow(summary.namingIssues)}`);
      console.log(`  Patterns: ${chalk.yellow(summary.patternIssues)}`);
      console.log(
        `  Architecture: ${chalk.yellow(summary.architectureIssues ?? 0)}`
      );
      console.log(`Analysis Time: ${chalk.gray(elapsedTime + 's')}\n`);

      if (summary.totalIssues === 0) {
        console.log(
          chalk.green(
            '✨ No consistency issues found! Your codebase is well-maintained.\n'
          )
        );
      } else {
        const namingResults = report.results.filter((r: any) =>
          r.issues.some((i: any) => i.category === 'naming')
        );
        const patternResults = report.results.filter((r: any) =>
          r.issues.some((i: any) => i.category === 'patterns')
        );

        if (namingResults.length > 0) {
          console.log(chalk.bold('🏷️  Naming Issues\n'));
          let shown = 0;
          for (const namingFileResult of namingResults) {
            if (shown >= 5) break;
            for (const issue of namingFileResult.issues) {
              if (shown >= 5) break;
              const severityColor =
                issue.severity === 'critical'
                  ? chalk.red
                  : issue.severity === 'major'
                    ? chalk.yellow
                    : issue.severity === 'minor'
                      ? chalk.blue
                      : chalk.gray;
              console.log(
                `${severityColor(issue.severity.toUpperCase())} ${chalk.dim(`${issue.location.file}:${issue.location.line}`)}`
              );
              console.log(`  ${issue.message}`);
              if (issue.suggestion) {
                console.log(
                  `  ${chalk.dim('→')} ${chalk.italic(issue.suggestion)}`
                );
              }
              console.log();
              shown++;
            }
          }
        }

        if (patternResults.length > 0) {
          console.log(chalk.bold('🔄 Pattern Issues\n'));
          let shown = 0;
          for (const patternFileResult of patternResults) {
            if (shown >= 5) break;
            for (const issue of patternFileResult.issues) {
              if (shown >= 5) break;
              const severityColor =
                issue.severity === 'critical'
                  ? chalk.red
                  : issue.severity === 'major'
                    ? chalk.yellow
                    : issue.severity === 'minor'
                      ? chalk.blue
                      : chalk.gray;
              console.log(
                `${severityColor(issue.severity.toUpperCase())} ${chalk.dim(`${issue.location.file}:${issue.location.line}`)}`
              );
              console.log(`  ${issue.message}`);
              if (issue.suggestion) {
                console.log(
                  `  ${chalk.dim('→')} ${chalk.italic(issue.suggestion)}`
                );
              }
              console.log();
              shown++;
            }
          }
        }

        if (report.recommendations?.length > 0) {
          console.log(chalk.bold('💡 Recommendations\n'));
          report.recommendations.forEach((rec: string, i: number) => {
            console.log(`${i + 1}. ${rec}`);
          });
          console.log();
        }
      }

      if (score) {
        console.log(chalk.bold('\n📊 AI Readiness Score (Consistency)\n'));
        console.log(formatToolScore(score));
        console.log();
      }
    },
  });
}
