import chalk from 'chalk';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderToolHeader,
  renderSafetyRating,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface TestabilityOptions extends BaseCommandOptions {
  minCoverage?: string;
}

export async function testabilityAction(
  directory: string,
  options: TestabilityOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'testability-index',
    label: 'Testability analysis',
    emoji: '🧪',
    defaults: {
      minCoverageRatio: 0.3,
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
    },
    getCliOptions: (opts) => ({
      minCoverageRatio: opts.minCoverage
        ? parseFloat(opts.minCoverage)
        : undefined,
    }),
    importTool: async () => {
      const tool = await import('@aiready/testability');
      return {
        analyze: tool.analyzeTestability as any,
        generateSummary: (report: any) => report.summary,
        calculateScore: tool.calculateTestabilityScore as any,
      };
    },
    renderConsole: ({ results, summary, score }) => {
      renderToolHeader('Testability', '🧪', score?.score || 0, summary.rating);
      renderSafetyRating(summary.aiChangeSafetyRating);

      const rawData = (results as any).rawData || (results as any);
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
}
