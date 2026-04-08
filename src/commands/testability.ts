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
  renderStandardSummary,
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
  render: ({ results, summary, score, elapsedTime }) => {
    const rawData = (results as Record<string, any>).rawData || results;
    const summaryRecord = summary as Record<string, any>;
    const coverage = Math.round(
      ((summaryRecord.coverageRatio as number) || 0) * 100
    );
    const metrics = `Coverage: ${coverage}%  (${rawData.testFiles} test / ${rawData.sourceFiles} source files)`;

    renderStandardSummary({
      label: 'Testability',
      emoji: '🧪',
      summary: summaryRecord,
      score,
      elapsedTime,
      metrics,
    });

    if (summaryRecord.aiChangeSafetyRating === 'blind-risk') {
      console.log(
        chalk.red.bold(
          '\n     ⚠️  NO TESTS — AI changes to this codebase are completely unverifiable!\n'
        )
      );
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
