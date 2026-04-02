/**
 * Context analysis command - Analyze context window costs and dependency fragmentation
 */

import { Command } from 'commander';
import {
  defineToolCommand,
  renderSubSection,
  renderToolScoreFooter,
  printTerminalHeader,
  chalk,
} from './shared/command-builder';

interface ContextOptions {
  maxDepth?: string;
  maxContext?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

/**
 * Define the context command.
 *
 * @param program - Commander program instance
 */
export function defineContextCommand(program: Command) {
  defineToolCommand(program, {
    name: 'context',
    description: 'Analyze context window costs and dependency fragmentation',
    toolName: 'context-analyzer',
    label: 'Context analysis',
    emoji: '🧩',
    options: [
      {
        flags: '--max-depth <number>',
        description: 'Maximum acceptable import depth',
        defaultValue: '5',
      },
      {
        flags: '--max-context <number>',
        description: 'Maximum acceptable context budget (tokens)',
        defaultValue: '10000',
      },
    ],
    actionConfig: {
      defaults: {
        rootDir: '',
        maxDepth: 5,
        maxContextBudget: 10000,
        include: undefined,
        exclude: undefined,
        output: { format: 'console', file: undefined },
      },
      getCliOptions: (opts: ContextOptions) => ({
        maxDepth: opts.maxDepth ? parseInt(opts.maxDepth) : undefined,
        maxContextBudget: opts.maxContext
          ? parseInt(opts.maxContext)
          : undefined,
      }),
      importTool: async () => {
        const { analyzeContext, generateSummary, calculateContextScore } =
          await import('@aiready/context-analyzer');
        return {
          analyze: analyzeContext,
          generateSummary,
          calculateScore: (data: any, _resultsCount?: number) =>
            calculateContextScore(data),
        };
      },
      renderConsole: ({
        results: _results,
        summary,
        elapsedTime,
        score,
      }: any) => {
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
    },
  });
}

/**
 * Action handler for context analysis.
 */
export async function contextAction(
  directory: string,
  options: ContextOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, {
    toolName: 'context-analyzer',
    label: 'Context analysis',
    emoji: '🧩',
    defaults: {
      rootDir: '',
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
        generateSummary,
        calculateScore: (data: any, _resultsCount?: number) =>
          calculateContextScore(data),
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
