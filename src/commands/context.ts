/**
 * Context command - Analyze context window costs and dependency fragmentation
 */

import chalk from 'chalk';
import { resolve as resolvePath } from 'path';
import {
  loadMergedConfig,
  handleJSONOutput,
  handleCLIError,
  getElapsedTime,
  resolveOutputPath,
  formatToolScore,
} from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import { getReportTimestamp } from '../utils/helpers';

interface ContextOptions {
  maxDepth?: string;
  maxContext?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

export async function contextAction(
  directory: string,
  options: ContextOptions
) {
  console.log(chalk.blue('🧠 Analyzing context costs...\n'));

  const startTime = Date.now();
  const resolvedDir = resolvePath(process.cwd(), directory || '.');

  try {
    // Define defaults
    const defaults = {
      maxDepth: 5,
      maxContextBudget: 10000,
      include: undefined,
      exclude: undefined,
      output: {
        format: 'console',
        file: undefined,
      },
    };

    // Load and merge config with CLI options
    const baseOptions = await loadMergedConfig(resolvedDir, defaults, {
      maxDepth: options.maxDepth ? parseInt(options.maxDepth) : undefined,
      maxContextBudget: options.maxContext
        ? parseInt(options.maxContext)
        : undefined,
      include: options.include?.split(','),
      exclude: options.exclude?.split(','),
    });

    // Apply smart defaults for context analysis (always for individual context command)
    let finalOptions: any = { ...baseOptions };
    const { getSmartDefaults } = await import('@aiready/context-analyzer');
    const contextSmartDefaults = await getSmartDefaults(
      resolvedDir,
      baseOptions
    );
    finalOptions = { ...contextSmartDefaults, ...finalOptions };

    // Display configuration
    console.log('📋 Configuration:');
    console.log(`   Max depth: ${finalOptions.maxDepth}`);
    console.log(`   Max context budget: ${finalOptions.maxContextBudget}`);
    console.log(
      `   Min cohesion: ${(finalOptions.minCohesion * 100).toFixed(1)}%`
    );
    console.log(
      `   Max fragmentation: ${(finalOptions.maxFragmentation * 100).toFixed(1)}%`
    );
    console.log(`   Analysis focus: ${finalOptions.focus}`);
    console.log('');

    const { analyzeContext, generateSummary, calculateContextScore } =
      await import('@aiready/context-analyzer');

    const results = await analyzeContext(finalOptions);

    const elapsedTime = getElapsedTime(startTime);
    const summary = generateSummary(results);

    // Calculate score if requested
    let contextScore: ToolScoringOutput | undefined;
    if (options.score) {
      contextScore = calculateContextScore(summary as any);
    }

    const outputFormat =
      options.output || finalOptions.output?.format || 'console';
    const userOutputFile = options.outputFile || finalOptions.output?.file;

    if (outputFormat === 'json') {
      const outputData = {
        results,
        summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        ...(contextScore && { scoring: contextScore }),
      };

      const outputPath = resolveOutputPath(
        userOutputFile,
        `aiready-report-${getReportTimestamp()}.json`,
        resolvedDir
      );

      handleJSONOutput(
        outputData,
        outputPath,
        `✅ Results saved to ${outputPath}`
      );
    } else {
      // Console output - format the results nicely
      const terminalWidth = process.stdout.columns || 80;
      const dividerWidth = Math.min(60, terminalWidth - 2);
      const divider = '━'.repeat(dividerWidth);

      console.log(chalk.cyan(divider));
      console.log(chalk.bold.white('  CONTEXT ANALYSIS SUMMARY'));
      console.log(chalk.cyan(divider) + '\n');

      console.log(
        chalk.white(`📁 Files analyzed: ${chalk.bold(summary.totalFiles)}`)
      );
      console.log(
        chalk.white(
          `📊 Total tokens: ${chalk.bold(summary.totalTokens.toLocaleString())}`
        )
      );
      console.log(
        chalk.yellow(
          `💰 Avg context budget: ${chalk.bold(summary.avgContextBudget.toFixed(0))} tokens/file`
        )
      );
      console.log(
        chalk.white(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}\n`)
      );

      // Issues summary
      const totalIssues =
        summary.criticalIssues + summary.majorIssues + summary.minorIssues;
      if (totalIssues > 0) {
        console.log(chalk.bold('⚠️  Issues Found:\n'));
        if (summary.criticalIssues > 0) {
          console.log(
            chalk.red(`   🔴 Critical: ${chalk.bold(summary.criticalIssues)}`)
          );
        }
        if (summary.majorIssues > 0) {
          console.log(
            chalk.yellow(`   🟡 Major: ${chalk.bold(summary.majorIssues)}`)
          );
        }
        if (summary.minorIssues > 0) {
          console.log(
            chalk.blue(`   🔵 Minor: ${chalk.bold(summary.minorIssues)}`)
          );
        }
        console.log(
          chalk.green(
            `\n   💡 Potential savings: ${chalk.bold(summary.totalPotentialSavings.toLocaleString())} tokens\n`
          )
        );
      } else {
        console.log(chalk.green('✅ No significant issues found!\n'));
      }

      // Deep import chains
      if (summary.deepFiles.length > 0) {
        console.log(chalk.bold('📏 Deep Import Chains:\n'));
        console.log(
          chalk.gray(`   Average depth: ${summary.avgImportDepth.toFixed(1)}`)
        );
        console.log(
          chalk.gray(`   Maximum depth: ${summary.maxImportDepth}\n`)
        );
        summary.deepFiles.slice(0, 10).forEach((item) => {
          const fileName = item.file.split('/').slice(-2).join('/');
          console.log(
            `   ${chalk.cyan('→')} ${chalk.white(fileName)} ${chalk.dim(`(depth: ${item.depth})`)}`
          );
        });
        console.log();
      }

      // Fragmented modules
      if (summary.fragmentedModules.length > 0) {
        console.log(chalk.bold('🧩 Fragmented Modules:\n'));
        console.log(
          chalk.gray(
            `   Average fragmentation: ${(summary.avgFragmentation * 100).toFixed(0)}%\n`
          )
        );
        summary.fragmentedModules.slice(0, 10).forEach((module) => {
          console.log(
            `   ${chalk.yellow('●')} ${chalk.white(module.domain)} - ${chalk.dim(`${module.files.length} files, ${(module.fragmentationScore * 100).toFixed(0)}% scattered`)}`
          );
          console.log(
            chalk.dim(
              `     Token cost: ${module.totalTokens.toLocaleString()}, Cohesion: ${(module.avgCohesion * 100).toFixed(0)}%`
            )
          );
        });
        console.log();
      }

      // Low cohesion files
      if (summary.lowCohesionFiles.length > 0) {
        console.log(chalk.bold('🔀 Low Cohesion Files:\n'));
        console.log(
          chalk.gray(
            `   Average cohesion: ${(summary.avgCohesion * 100).toFixed(0)}%\n`
          )
        );
        summary.lowCohesionFiles.slice(0, 10).forEach((item) => {
          const fileName = item.file.split('/').slice(-2).join('/');
          const scorePercent = (item.score * 100).toFixed(0);
          const color = item.score < 0.4 ? chalk.red : chalk.yellow;
          console.log(
            `   ${color('○')} ${chalk.white(fileName)} ${chalk.dim(`(${scorePercent}% cohesion)`)}`
          );
        });
        console.log();
      }

      // Top expensive files
      if (summary.topExpensiveFiles.length > 0) {
        console.log(chalk.bold('💸 Most Expensive Files (Context Budget):\n'));
        summary.topExpensiveFiles.slice(0, 10).forEach((item) => {
          const fileName = item.file.split('/').slice(-2).join('/');
          const severityColor =
            item.severity === 'critical'
              ? chalk.red
              : item.severity === 'major'
                ? chalk.yellow
                : chalk.blue;
          console.log(
            `   ${severityColor('●')} ${chalk.white(fileName)} ${chalk.dim(`(${item.contextBudget.toLocaleString()} tokens)`)}`
          );
        });
        console.log();
      }

      // Display score if calculated
      if (contextScore) {
        console.log(chalk.cyan(divider));
        console.log(chalk.bold.white('  AI READINESS SCORE (Context)'));
        console.log(chalk.cyan(divider) + '\n');
        console.log(formatToolScore(contextScore));
        console.log();
      }
    }
  } catch (error) {
    handleCLIError(error, 'Context analysis');
  }
}
