/**
 * Consistency command - Check naming conventions and architectural consistency
 */

import { Command } from 'commander';
import {
  defineToolCommand,
  renderSubSection,
  chalk,
  createStandardToolConfig,
  renderStandardSummary,
} from './shared/command-builder';
import type { Severity } from '@aiready/core';

interface ConsistencyOptions {
  naming?: boolean;
  patterns?: boolean;
  minSeverity?: Severity;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

/**
 * Shared configuration for the consistency command to avoid duplication.
 */
const SHARED_CONSISTENCY_CONFIG = createStandardToolConfig<ConsistencyOptions>({
  toolName: 'naming-consistency',
  label: 'Consistency Analysis',
  emoji: '📏',
  importPath: '@aiready/consistency',
  analyzeFnName: 'analyzeConsistency',
  scoreFnName: 'calculateConsistencyScore',
  defaults: {
    checkNaming: true,
    checkPatterns: true,
    minSeverity: 'info' as Severity,
  },
  getCliOptions: (opts) => ({
    checkNaming: opts.naming !== false,
    checkPatterns: opts.patterns !== false,
    minSeverity: opts.minSeverity as Severity | undefined,
  }),
  renderConsole: ({ results, summary, elapsedTime, score }) => {
    const report = results as any;
    const summaryData = summary as any;
    renderStandardSummary({
      label: 'Consistency Analysis',
      emoji: '📏',
      summary: summaryData,
      elapsedTime,
      score,
    });

    if (summaryData.totalIssues > 0 && report.results) {
      renderSubSection('Top Consistency Issues');
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
        .slice(0, 5);

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
      });
    } else if (summaryData.totalIssues === 0) {
      console.log(
        chalk.green('\n  ✅ No consistency issues detected. Excellent work!')
      );
    }
  },
});

/**
 * Define the consistency command.
 *
 * @param program - Commander program instance
 */
export function defineConsistencyCommand(program: Command) {
  defineToolCommand(program, {
    name: 'consistency',
    description: 'Check naming conventions and architectural consistency',
    toolName: 'naming-consistency',
    label: 'Consistency Analysis',
    emoji: '📏',
    options: [
      {
        flags: '--naming',
        description: 'Check naming conventions (default: true)',
      },
      {
        flags: '--no-naming',
        description: 'Skip naming analysis',
      },
      {
        flags: '--patterns',
        description: 'Check code patterns (default: true)',
      },
      {
        flags: '--no-patterns',
        description: 'Skip pattern analysis',
      },
      {
        flags: '--min-severity <level>',
        description: 'Minimum severity: info|minor|major|critical',
        defaultValue: 'info',
      },
    ],
    actionConfig: SHARED_CONSISTENCY_CONFIG,
  });
}

/**
 * Action handler for consistency analysis.
 */
export async function consistencyAction(
  directory: string,
  options: ConsistencyOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, SHARED_CONSISTENCY_CONFIG);
}
