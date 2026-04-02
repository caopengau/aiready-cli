/**
 * Shared CLI command builder utility for AIReady tool commands.
 * Provides a generic `defineToolCommand` function to reduce boilerplate
 * across individual tool command definitions.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import {
  printTerminalHeader,
  Severity,
  type ToolScoringOutput,
} from '@aiready/core';
import {
  executeToolAction,
  type BaseCommandOptions,
  type ToolActionConfig,
} from '../scan-helpers';
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
