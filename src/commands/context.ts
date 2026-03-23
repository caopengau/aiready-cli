import chalk from 'chalk';
import { printTerminalHeader } from '@aiready/core';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderSubSection,
  renderIssueSummaryBlock,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface ContextOptions extends BaseCommandOptions {
  maxDepth?: string;
  maxContext?: string;
}

export async function contextAction(
  directory: string,
  options: ContextOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'context-analyzer',
    label: 'Context analysis',
    emoji: '🧠',
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
    preAnalyze: async (resolvedDir, baseOptions) => {
      const { getSmartDefaults } = await import('@aiready/context-analyzer');
      const smartDefaults = await getSmartDefaults(resolvedDir, baseOptions);
      return { ...smartDefaults, ...baseOptions };
    },
    importTool: async () => {
      const { analyzeContext, generateSummary, calculateContextScore } =
        await import('@aiready/context-analyzer');
      return {
        analyze: analyzeContext as any,
        generateSummary,
        calculateScore: calculateContextScore as any,
      };
    },
    renderConsole: ({ summary, elapsedTime, score }) => {
      printTerminalHeader('CONTEXT ANALYSIS SUMMARY');

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

      renderIssueSummaryBlock(summary);

      if (summary.deepFiles && summary.deepFiles.length > 0) {
        renderSubSection('Deep Import Chains');
        summary.deepFiles.slice(0, 10).forEach((item: any) => {
          const fileName = item.file.split('/').slice(-2).join('/');
          console.log(
            `   ${chalk.cyan('→')} ${chalk.white(fileName)} ${chalk.dim(`(depth: ${item.depth})`)}`
          );
        });
      }

      if (summary.fragmentedModules && summary.fragmentedModules.length > 0) {
        renderSubSection('Fragmented Modules');
        summary.fragmentedModules.slice(0, 10).forEach((module: any) => {
          console.log(
            `   ${chalk.yellow('●')} ${chalk.white(module.domain)} - ${chalk.dim(`${module.files.length} files, ${(module.fragmentationScore * 100).toFixed(0)}% scattered`)}`
          );
          console.log(
            chalk.dim(
              `     Token cost: ${module.totalTokens.toLocaleString()}, Cohesion: ${(module.avgCohesion * 100).toFixed(0)}%`
            )
          );
        });
      }

      renderToolScoreFooter(score);
    },
  });
}
