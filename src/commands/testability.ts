/**
 * Testability command - Analyze test coverage and testability
 */

import {
  defineToolCommand,
  renderToolHeader,
  renderSafetyRating,
  renderToolScoreFooter,
  chalk,
  createStandardToolConfig,
} from './shared/command-builder';

interface TestabilityOptions {
  minCoverage?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

const testabilityConfig = createStandardToolConfig<TestabilityOptions>({
  toolName: 'testability-index',
  label: 'Testability analysis',
  emoji: '🧪',
  importPath: '@aiready/testability',
  analyzeFnName: 'analyzeTestability',
  scoreFnName: 'calculateTestabilityScore',
  defaults: { minCoverageRatio: 0.3 },
  getCliOptions: (opts) => ({
    minCoverageRatio: opts.minCoverage
      ? parseFloat(opts.minCoverage)
      : undefined,
  }),
  render: ({ results, summary, score }) => {
    renderToolHeader('Testability', '🧪', score?.score || 0, summary.rating);
    renderSafetyRating(summary.aiChangeSafetyRating);

    const rawData = results.rawData || results;
    console.log(
      chalk.dim(
        `     Coverage: ${Math.round(summary.coverageRatio * 100)}%  (${rawData.testFiles} test / ${rawData.sourceFiles} source files)`
      )
    );

    if (summary.aiChangeSafetyRating === 'blind-risk') {
      console.log(
        chalk.red.bold(
          '\n     ⚠️  NO TESTS — AI changes to this codebase are completely unverifiable!\n'
        )
      );
    }

    if (score) {
      renderToolScoreFooter(score);
    }
  },
});

export function defineTestabilityCommand(program: import('commander').Command) {
  defineToolCommand(program, {
    name: 'testability',
    description: 'Analyze test coverage and AI change safety',
    toolName: 'testability-index',
    label: 'Testability analysis',
    emoji: '🧪',
    options: [
      {
        flags: '--min-coverage <number>',
        description: 'Minimum coverage ratio (0-1)',
        defaultValue: '0.3',
      },
    ],
    actionConfig: testabilityConfig,
  });
}

export async function testabilityAction(
  directory: string,
  options: TestabilityOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, {
    ...testabilityConfig,
  });
}
