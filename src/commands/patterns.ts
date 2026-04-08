/**
 * Patterns command - Detect duplicate code patterns that confuse AI models
 */

import { Command } from 'commander';
import {
  defineToolCommand,
  renderSubSection,
  chalk,
  createStandardToolConfig,
  renderStandardSummary,
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
        defaultValue: '0.6',
      },
      {
        flags: '-l, --min-lines <number>',
        description: 'Minimum lines to consider',
        defaultValue: '10',
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
    actionConfig: patternsConfig,
  });
}

const patternsConfig = createStandardToolConfig<PatternsOptions>({
  toolName: 'pattern-detect',
  label: 'Pattern analysis',
  emoji: '🔍',
  importPath: '@aiready/pattern-detect',
  analyzeFnName: 'analyzePatterns',
  scoreFnName: 'calculatePatternScore',
  defaults: {
    useSmartDefaults: true,
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
    useSmartDefaults: !opts.fullScan,
  }),
  renderConsole: ({ results, summary, score, elapsedTime }) => {
    const rawResults = results as { duplicates?: any[] };
    const duplicates = rawResults.duplicates || [];

    renderStandardSummary({
      label: 'Pattern Analysis',
      emoji: '🔍',
      summary: summary as Record<string, any>,
      score,
      elapsedTime,
    });

    if ((summary.totalPatterns as number) > 0 && duplicates.length > 0) {
      renderSubSection('Top Duplicate Patterns');
      [...duplicates]
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, 5)
        .forEach((dup) => {
          const sim = dup.similarity || 0;
          const file1 = (dup.file1 || '').split('/').pop();
          const file2 = (dup.file2 || '').split('/').pop();
          const isHigh = sim > 0.9;
          const icon = sim > 0.95 ? '🔴' : isHigh ? '🟡' : '🔵';
          console.log(
            `${icon} ${chalk.bold(file1)} ↔ ${chalk.bold(file2)} (${Math.round(sim * 100)}%)`
          );
        });
    }
  },
});

/**
 * Executes pattern analysis action.
 */
export async function patternsAction(
  directory: string,
  options: PatternsOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, patternsConfig);
}
