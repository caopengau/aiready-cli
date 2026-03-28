import chalk from 'chalk';
import { Command } from 'commander';
import { printTerminalHeader } from '@aiready/core';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderSubSection,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface ContextOptions extends BaseCommandOptions {
  maxDepth?: string;
  maxContext?: string;
}

/**
 * Define the context command.
 *
 * @param program - Commander program instance
 */
export function defineContextCommand(program: Command) {
  program
    .command('context')
    .description('Analyze context window costs and dependency fragmentation')
    .argument('[directory]', 'Directory to analyze', '.')
    .option('--max-depth <number>', 'Maximum acceptable import depth', '5')
    .option(
      '--max-context <number>',
      'Maximum acceptable context budget (tokens)',
      '10000'
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
    .action(async (directory, options) => {
      await contextAction(directory, options);
    });
}

/**
 * Action handler for context analysis.
 */
export async function contextAction(
  directory: string,
  options: ContextOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'context-analyzer',
    label: 'Context analysis',
    emoji: '🧩',
    defaults: {
      maxDepth: 5,
      maxContextBudget: 10000,
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
    },
    getCliOptions: (opts) => ({
      maxDepth: opts.maxDepth ? parseInt(opts.maxDepth) : undefined,
      maxContextBudget: opts.maxContext ? parseInt(opts.maxContext) : undefined,
    }),
    importTool: async () => {
      const { analyzeContext, generateSummary, calculateContextScore } =
        await import('@aiready/context-analyzer');
      return {
        analyze: analyzeContext,
        generateSummary: generateContextSummary,
        calculateScore: calculateContextScore,
      };
    },
    renderConsole: ({ results: _results, summary, elapsedTime, score }) => {
      printTerminalHeader('CONTEXT ANALYSIS SUMMARY');

      console.log(
        chalk.white(`📁 Total files: ${chalk.bold(summary.totalFiles)}`)
      );
      console.log(
        chalk.white(
          `💸 Total tokens (context budget): ${chalk.bold(summary.totalTokens.toLocaleString())}`
        )
      );
      console.log(
        chalk.cyan(
          `📊 Average context budget: ${chalk.bold(summary.avgContextBudget.toFixed(0))} tokens`
        )
      );
      console.log(
        chalk.gray(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}`)
      );

      if (summary.fragmentedModules.length > 0) {
        renderSubSection('Top Fragmented Modules');
        summary.fragmentedModules.slice(0, 5).forEach((mod: any) => {
          const scoreColor =
            mod.fragmentationScore > 0.7
              ? chalk.red
              : mod.fragmentationScore > 0.4
                ? chalk.yellow
                : chalk.green;

          console.log(
            `  ${scoreColor('■')} ${chalk.white(mod.domain.padEnd(20))} ${chalk.bold((mod.fragmentationScore * 100).toFixed(0) + '%')} fragmentation`
          );
        });
      }

      if (summary.topExpensiveFiles.length > 0) {
        renderSubSection('Top Context-Expensive Files');
        summary.topExpensiveFiles.slice(0, 5).forEach((item: any) => {
          const icon =
            item.severity === 'critical'
              ? '🔴'
              : item.severity === 'major'
                ? '🟡'
                : '🔵';
          const color =
            item.severity === 'critical'
              ? chalk.red
              : item.severity === 'major'
                ? chalk.yellow
                : chalk.blue;

          console.log(
            `  ${icon} ${color(item.severity.toUpperCase())}: ${chalk.white(item.file.split('/').pop())} ${chalk.dim(`(${item.contextBudget.toLocaleString()} tokens)`)}`
          );
        });
      }

      renderToolScoreFooter(score);
    },
  });
}
