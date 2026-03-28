import chalk from 'chalk';
import { Command } from 'commander';
import { printTerminalHeader } from '@aiready/core';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderSubSection,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface PatternsOptions extends BaseCommandOptions {
  similarity?: string;
  minLines?: string;
  maxCandidates?: string;
  minSharedTokens?: string;
  fullScan?: boolean;
}

export const PATTERNS_HELP_TEXT = `
EXAMPLES:
  $ aiready patterns                                 # Default analysis
  $ aiready patterns --similarity 0.6               # Stricter matching
  $ aiready patterns --min-lines 10                 # Larger patterns only
`;

/**
 * Define the patterns command structure.
 *
 * @param program - Commander program instance
 */
export function definePatternsCommand(program: Command) {
  program
    .command('patterns')
    .description('Detect duplicate code patterns that confuse AI models')
    .argument('[directory]', 'Directory to analyze', '.')
    .option(
      '-s, --similarity <number>',
      'Minimum similarity score (0-1)',
      '0.40'
    )
    .option('-l, --min-lines <number>', 'Minimum lines to consider', '5')
    .option(
      '--max-candidates <number>',
      'Maximum candidates per block (performance tuning)'
    )
    .option(
      '--min-shared-tokens <number>',
      'Minimum shared tokens for candidates (performance tuning)'
    )
    .option(
      '--full-scan',
      'Disable smart defaults for comprehensive analysis (slower)'
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
    .option('--score', 'Calculate and display AI Readiness Score (0-100)')
    .option('--no-score', 'Disable calculating AI Readiness Score')
    .addHelpText('after', PATTERNS_HELP_TEXT)
    .action(async (directory, options) => {
      await patternsAction(directory, options);
    });
}

/**
 * Executes pattern analysis action.
 */
export async function patternsAction(
  directory: string,
  options: PatternsOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'pattern-detect',
    label: 'Pattern analysis',
    emoji: '🔍',
    defaults: {
      rootDir: '',
      useSmartDefaults: !options.fullScan,
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
      minSimilarity: options.fullScan ? 0.4 : undefined,
      minLines: options.fullScan ? 5 : undefined,
    },
    getCliOptions: (opts) => ({
      minSimilarity: opts.similarity ? parseFloat(opts.similarity) : undefined,
      minLines: opts.minLines ? parseInt(opts.minLines) : undefined,
      maxCandidatesPerBlock: opts.maxCandidates
        ? parseInt(opts.maxCandidates)
        : undefined,
      minSharedTokens: opts.minSharedTokens
        ? parseInt(opts.minSharedTokens)
        : undefined,
    }),
    importTool: async () => {
      const {
        analyzePatterns,
        generateSummary: rawGenerateSummary,
        calculatePatternScore,
      } = await import('@aiready/pattern-detect');
      return {
        analyze: analyzePatterns,
        generateSummary: (results: any) => rawGenerateSummary(results.results),
        calculateScore: (data: any, resultsCount?: number) =>
          calculatePatternScore(data, resultsCount ?? 0),
      };
    },
    renderConsole: ({ results, summary, elapsedTime, score }) => {
      const duplicates = (results as any).duplicates || [];
      printTerminalHeader('PATTERN ANALYSIS SUMMARY');

      console.log(
        chalk.white(
          `📁 Files analyzed: ${chalk.bold((results as any).files?.length || 0)}`
        )
      );
      console.log(
        chalk.yellow(
          `⚠  Duplicate patterns found: ${chalk.bold(summary.totalPatterns)}`
        )
      );
      console.log(
        chalk.red(
          `💰 Token cost (wasted): ${chalk.bold(summary.totalTokenCost.toLocaleString())}`
        )
      );
      console.log(
        chalk.gray(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}`)
      );

      const sortedTypes = Object.entries(summary.patternsByType || {})
        .filter(([, count]) => (count as number) > 0)
        .sort(([, a], [, b]) => (b as number) - (a as number));

      if (sortedTypes.length > 0) {
        renderSubSection('Patterns By Type');
        sortedTypes.forEach(([type, count]) => {
          console.log(`  ${chalk.white(type.padEnd(15))} ${chalk.bold(count)}`);
        });
      }

      if (summary.totalPatterns > 0 && duplicates.length > 0) {
        renderSubSection('Top Duplicate Patterns');
        [...duplicates]
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 10)
          .forEach((dup) => {
            const isHigh = dup.similarity > 0.9;
            const icon = dup.similarity > 0.95 ? '🔴' : isHigh ? '🟡' : '🔵';
            const label =
              dup.similarity > 0.95 ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM';
            console.log(
              `${icon} ${label}: ${chalk.bold(dup.file1.split('/').pop())} ↔ ${chalk.bold(dup.file2.split('/').pop())}`
            );
            console.log(
              `   Similarity: ${chalk.bold(Math.round(dup.similarity * 100) + '%')} | Wasted: ${chalk.bold(dup.tokenCost.toLocaleString())} tokens each`
            );
            console.log(
              `   Lines: ${chalk.cyan(dup.line1 + '-' + dup.endLine1)} ↔ ${chalk.cyan(dup.line2 + '-' + dup.endLine2)}\n`
            );
          });
      } else {
        console.log(
          chalk.green('\n✨ Great! No duplicate patterns detected.\n')
        );
      }

      renderToolScoreFooter(score);
    },
  });
}
