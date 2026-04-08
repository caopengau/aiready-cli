/**
 * Shared CLI command builder utility for AIReady tool commands.
 * Provides a generic `defineToolCommand` function to reduce boilerplate
 * across individual tool command definitions.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { printTerminalHeader, type ToolScoringOutput } from '@aiready/core';
import type { BaseCommandOptions, ToolActionConfig } from '../scan-helpers';
import {
  renderSubSection,
  renderToolScoreFooter,
  renderToolHeader,
  renderSafetyRating,
} from '../../utils/terminal-renderers';

// Re-export common types for convenience
export type { BaseCommandOptions, ToolActionConfig, ToolScoringOutput };

/**
 * Common CLI options shared by all tool commands
 */
export interface CommonToolOptions extends BaseCommandOptions {
  /** File patterns to include (comma-separated) */
  include?: string;
  /** File patterns to exclude (comma-separated) */
  exclude?: string;
  /** Output format: console, json */
  output?: string;
  /** Output file path (for json) */
  outputFile?: string;
  /** Calculate and display AI Readiness Score (0-100) */
  score?: boolean;
}

/**
 * Configuration for defining a tool command
 */
export interface ToolCommandConfig<
  TOptions extends CommonToolOptions = CommonToolOptions,
> {
  /** Command name (e.g., 'context', 'patterns') */
  name: string;
  /** Command description */
  description: string;
  /** Tool name for internal use (e.g., 'context-analyzer', 'pattern-detect') */
  toolName: string;
  /** Display label (e.g., 'Context analysis') */
  label: string;
  /** Emoji for display (e.g., '🧩') */
  emoji: string;
  /** Additional command-specific options to register */
  options?: CommandOption[];
  /** Help text to append after built-in help */
  helpText?: string;
  /** Tool action configuration for executeToolAction */
  actionConfig: Omit<
    ToolActionConfig<any, any, any>,
    'toolName' | 'label' | 'emoji'
  >;
  /** Custom action handler (optional, overrides default actionConfig-based handler) */
  customAction?: (directory: string, options: TOptions) => Promise<any>;
}

/**
 * Command option definition
 */
export interface CommandOption {
  /** Option flags (e.g., '--max-depth <number>') */
  flags: string;
  /** Option description */
  description: string;
  /** Default value */
  defaultValue?: string;
}

/**
 * Adds common tool options to a commander command
 */
function addCommonOptions(cmd: Command): Command {
  return cmd
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
    .option('--no-score', 'Disable calculating AI Readiness Score');
}

/**
 * Generic function to define a tool command on a commander program.
 * Reduces boilerplate by handling common options and action setup.
 *
 * @param program - Commander program instance
 * @param config - Tool command configuration
 */
export function defineToolCommand<
  TOptions extends CommonToolOptions = CommonToolOptions,
>(program: Command, config: ToolCommandConfig<TOptions>): void {
  let cmd = program
    .command(config.name)
    .description(config.description)
    .argument('[directory]', 'Directory to analyze', '.');

  // Add tool-specific options
  if (config.options) {
    for (const opt of config.options) {
      cmd = cmd.option(opt.flags, opt.description, opt.defaultValue);
    }
  }

  // Add common options
  cmd = addCommonOptions(cmd);

  // Add help text if provided
  if (config.helpText) {
    cmd = cmd.addHelpText('after', config.helpText);
  }

  // Set up action handler
  cmd.action(async (directory: string, options: TOptions) => {
    const { executeToolAction } = await import('../scan-helpers');
    if (config.customAction) {
      await config.customAction(directory, options);
    } else {
      await executeToolAction(directory, options, {
        toolName: config.toolName,
        label: config.label,
        emoji: config.emoji,
        ...config.actionConfig,
      });
    }
  });
}

// Re-export rendering utilities for convenience
export {
  renderSubSection,
  renderToolScoreFooter,
  renderToolHeader,
  renderSafetyRating,
  printTerminalHeader,
  chalk,
};

/**
 * Standard configuration for a tool to reduce duplication in command files.
 */
export interface StandardToolConfig<TOptions = Record<string, unknown>> {
  toolName: string;
  label: string;
  emoji: string;
  importPath: string;
  analyzeFnName: string;
  scoreFnName?: string;
  defaults?: Record<string, unknown>;
  getCliOptions?: (opts: TOptions) => Record<string, unknown>;
  renderConsole?: (params: {
    results: unknown;
    summary: Record<string, unknown>;
    elapsedTime: string;
    score?: ToolScoringOutput;
    finalOptions: TOptions;
  }) => void;
}

/**
 * Standard summary rendering for common tool outputs.
 */
export function renderStandardSummary(params: {
  label: string;
  emoji: string;
  summary: Record<string, any>;
  elapsedTime: string;
  score?: ToolScoringOutput;
  metrics?: string;
}) {
  const { label, emoji, summary, elapsedTime, score, metrics } = params;

  renderToolHeader(
    label,
    emoji,
    score?.score || 0,
    summary.rating || 'UNKNOWN'
  );

  // Show safety rating if available (for testability, grounding)
  if (summary.aiChangeSafetyRating) {
    renderSafetyRating(summary.aiChangeSafetyRating);
  }

  const filesAnalyzed =
    summary.sourceFiles ?? summary.filesAnalyzed ?? summary.totalFiles ?? 0;

  console.log(
    chalk.dim(
      `     Analysis complete in ${chalk.bold(elapsedTime + 's')} | ${filesAnalyzed} files scanned`
    )
  );

  if (metrics) {
    console.log(chalk.dim(`     ${metrics}`));
  }

  if (score) {
    renderToolScoreFooter(score);
  }
}

/**
 * Creates a standard ToolActionConfig from a StandardToolConfig to reduce duplication.
 */
export function createStandardToolConfig<TOptions = any>(
  config: StandardToolConfig<TOptions>
): ToolActionConfig<any, any, any> {
  return {
    toolName: config.toolName,
    label: config.label,
    emoji: config.emoji,
    defaults: {
      rootDir: '',
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
      ...(config.defaults || {}),
    },
    getCliOptions: config.getCliOptions || (() => ({})),
    importTool: async () => {
      const tool = await import(config.importPath);
      return {
        analyze: tool[config.analyzeFnName],
        generateSummary: (report: any) => {
          try {
            const genSum = tool.generateSummary;
            return genSum ? genSum(report) : report.summary || report;
          } catch {
            return report.summary || report;
          }
        },
        calculateScore: (data: any, resultsCount?: number) => {
          const scoreFn = config.scoreFnName
            ? tool[config.scoreFnName]
            : undefined;
          if (!scoreFn) {
            return {
              score: 0,
              toolName: config.toolName,
              rawMetrics: data,
              factors: [],
              recommendations: [],
            };
          }
          const score = scoreFn(data, resultsCount);
          return {
            ...score,
            toolName: config.toolName,
            rawMetrics: data,
            factors: score.factors || [],
            recommendations: (score.recommendations || []).map(
              (action: string | any) =>
                typeof action === 'string'
                  ? {
                      action,
                      estimatedImpact: 10,
                      priority: 'medium' as const,
                    }
                  : action
            ),
          };
        },
      };
    },
    renderConsole: (params) => {
      if (config.renderConsole) {
        config.renderConsole(params);
      } else {
        renderStandardSummary({
          label: config.label,
          emoji: config.emoji,
          summary: params.summary,
          elapsedTime: params.elapsedTime,
          score: params.score,
        });
      }
    },
  };
}
