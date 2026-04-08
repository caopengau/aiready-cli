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
  createStandardToolConfig,
  renderStandardSummary,
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

const contextConfig = createStandardToolConfig<ContextOptions>({
  toolName: 'context-analyzer',
  label: 'Context analysis',
  emoji: '🧩',
  importPath: '@aiready/context-analyzer',
  analyzeFnName: 'analyzeContext',
  scoreFnName: 'calculateContextScore',
  defaults: {
    maxDepth: 5,
    maxContextBudget: 10000,
  },
  getCliOptions: (opts) => ({
    maxDepth: opts.maxDepth ? parseInt(opts.maxDepth) : undefined,
    maxContextBudget: opts.maxContext ? parseInt(opts.maxContext) : undefined,
  }),
  render: ({ summary, elapsedTime, score }) => {
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

    renderToolScoreFooter(score);
  },
});

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
    actionConfig: contextConfig,
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

  return await executeToolAction(directory, options, contextConfig);
}
