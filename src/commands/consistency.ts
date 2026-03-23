/**
 * Consistency command - Check naming conventions and architectural consistency
 */

import chalk from 'chalk';
import { writeFileSync } from 'fs';
import {
  handleCLIError,
  getElapsedTime,
  resolveOutputPath,
  formatToolScore,
  prepareActionConfig,
  resolveOutputFormat,
  formatStandardReport,
  handleStandardJSONOutput,
} from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import { getReportTimestamp, generateMarkdownReport } from '../utils';

interface ConsistencyOptions {
  naming?: boolean;
  patterns?: boolean;
  minSeverity?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

export async function consistencyAction(
  directory: string,
  options: ConsistencyOptions
) {
  console.log(chalk.blue('🔍 Analyzing consistency...\n'));

  const startTime = Date.now();

  try {
    // Define defaults
    const defaults: any = {
      checkNaming: true,
      checkPatterns: true,
      minSeverity: 'info' as const,
      include: undefined,
      exclude: undefined,
      output: {
        format: 'console',
        file: undefined,
      },
    };

    // Load and merge config with CLI options
    const { resolvedDir, finalOptions } = await prepareActionConfig(
      directory,
      defaults,
      {
        checkNaming: options.naming !== false,
        checkPatterns: options.patterns !== false,
        minSeverity: options.minSeverity,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      }
    );

    const { analyzeConsistency, calculateConsistencyScore } =
      await import('@aiready/consistency');

    const report = await analyzeConsistency(finalOptions);

    const elapsedTime = getElapsedTime(startTime);

    // Calculate score if requested
    let consistencyScore: ToolScoringOutput | undefined;
    if (options.score) {
      const issues = report.results?.flatMap((r: any) => r.issues) ?? [];
      consistencyScore = calculateConsistencyScore(
        issues,
        report.summary.filesAnalyzed
      );
    }

    const { format: outputFormat, file: userOutputFile } = resolveOutputFormat(
      options,
      finalOptions
    );

    if (outputFormat === 'json') {
      const outputData = formatStandardReport({
        report,
        summary: report.summary,
        elapsedTime,
        score: consistencyScore,
      });

      handleStandardJSONOutput({
        outputData,
        outputFile: userOutputFile,
        resolvedDir,
      });
    } else if (outputFormat === 'markdown') {
      // Markdown output
      const markdown = generateMarkdownReport(report, elapsedTime);
      const outputPath = resolveOutputPath(
        userOutputFile,
        `aiready-report-${getReportTimestamp()}.md`,
        resolvedDir
      );
      writeFileSync(outputPath, markdown);
      console.log(chalk.green(`✅ Report saved to ${outputPath}`));
    } else {
      // Console output - format to match standalone CLI
      console.log(chalk.bold('\n📊 Summary\n'));
      console.log(
        `Files Analyzed: ${chalk.cyan(report.summary.filesAnalyzed)}`
      );
      console.log(`Total Issues: ${chalk.yellow(report.summary.totalIssues)}`);
      console.log(`  Naming: ${chalk.yellow(report.summary.namingIssues)}`);
      console.log(`  Patterns: ${chalk.yellow(report.summary.patternIssues)}`);
      console.log(
        `  Architecture: ${chalk.yellow(report.summary.architectureIssues ?? 0)}`
      );
      console.log(`Analysis Time: ${chalk.gray(elapsedTime + 's')}\n`);

      if (report.summary.totalIssues === 0) {
        console.log(
          chalk.green(
            '✨ No consistency issues found! Your codebase is well-maintained.\n'
          )
        );
      } else {
        // Group and display issues by category
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
          const remaining =
            namingResults.reduce((sum, r) => sum + r.issues.length, 0) - shown;
          if (remaining > 0) {
            console.log(chalk.dim(`  ... and ${remaining} more issues\n`));
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
          const remaining =
            patternResults.reduce((sum, r) => sum + r.issues.length, 0) - shown;
          if (remaining > 0) {
            console.log(chalk.dim(`  ... and ${remaining} more issues\n`));
          }
        }

        if (report.recommendations.length > 0) {
          console.log(chalk.bold('💡 Recommendations\n'));
          report.recommendations.forEach((rec: string, i: number) => {
            console.log(`${i + 1}. ${rec}`);
          });
          console.log();
        }
      }

      // Display score if calculated
      if (consistencyScore) {
        console.log(chalk.bold('\n📊 AI Readiness Score (Consistency)\n'));
        console.log(formatToolScore(consistencyScore));
        console.log();
      }
    }
  } catch (error) {
    handleCLIError(error, 'Consistency analysis');
  }
}
