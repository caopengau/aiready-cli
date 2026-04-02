/**
 * Patterns command - Detect duplicate code patterns that confuse AI models
 */

import { Command } from 'commander';
import {
  defineToolCommand,
  renderSubSection,
  renderToolScoreFooter,
  printTerminalHeader,
  chalk,
} from './shared/command-builder';

interface PatternsOptions {
  similarity?: string;
  minLines?: string;
  maxCandidates?: string;
  minSharedTokens?: string;
  fullScan?: boolean;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
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
  defineToolCommand(program, {
    name: 'patterns',
    description: 'Detect duplicate code patterns that confuse AI models',
    toolName: 'pattern-detect',
    label: 'Pattern analysis',
    emoji: '🔍',
    helpText: PATTERNS_HELP_TEXT,
    options: [
      {
        flags: '-s, --similarity <number>',
        description: 'Minimum similarity score (0-1)',
        defaultValue: '0.40',
      },
      {
        flags: '-l, --min-lines <number>',
        description: 'Minimum lines to consider',
        defaultValue: '5',
      },
      {
        flags: '--max-candidates <number>',
        description: 'Maximum candidates per block (performance tuning)',
      },
      {
        flags: '--min-shared-tokens <number>',
        description:
          'Minimum shared tokens for candidates (performance tuning)',
      },
      {
        flags: '--full-scan',
        description:
          'Disable smart defaults for comprehensive analysis (slower)',
      },
    ],
    actionConfig: {
      defaults: {
        rootDir: '',
        useSmartDefaults: true,
        include: undefined,
        exclude: undefined,
        output: { format: 'console', file: undefined },
        minSimilarity: undefined,
        minLines: undefined,
      },
      getCliOptions: (opts: PatternsOptions) => ({
        minSimilarity: opts.similarity
          ? parseFloat(opts.similarity)
          : undefined,
        minLines: opts.minLines ? parseInt(opts.minLines) : undefined,
        maxCandidatesPerBlock: opts.maxCandidates
          ? parseInt(opts.maxCandidates)
          : undefined,
        minSharedTokens: opts.minSharedTokens
          ? parseInt(opts.minSharedTokens)
          : undefined,
        useSmartDefaults: !opts.fullScan,
        minSimilarityFull: opts.fullScan ? 0.4 : undefined,
        minLinesFull: opts.fullScan ? 5 : undefined,
      }),
      importTool: async () => {
        const {
          analyzePatterns,
          generateSummary: rawGenerateSummary,
          calculatePatternScore,
        } = await import('@aiready/pattern-detect');
        return {
          analyze: analyzePatterns,
          generateSummary: (results: any) =>
            rawGenerateSummary(results.results),
          calculateScore: (data: any, resultsCount?: number) =>
            calculatePatternScore(data, resultsCount ?? 0),
        };
      },
      renderConsole: ({ results, summary, elapsedTime, score }: any) => {
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
            console.log(
              `  ${chalk.white(type.padEnd(15))} ${chalk.bold(count)}`
            );
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
    },
  });
}

/**
 * Executes pattern analysis action.
 */
export async function patternsAction(
  directory: string,
  options: PatternsOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

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
