import chalk from 'chalk';
import { ToolScoringOutput } from '@aiready/core';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderToolHeader,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface ContractEnforcementOptions extends BaseCommandOptions {
  minChainDepth?: string;
}

export async function contractEnforcementAction(
  directory: string,
  options: ContractEnforcementOptions
) {
  return await executeToolAction(directory, options, {
    toolName: 'contract-enforcement',
    label: 'Contract enforcement analysis',
    emoji: '🛡️',
    defaults: {
      rootDir: '',
      minChainDepth: 3,
      include: undefined,
      exclude: undefined,
    },
    getCliOptions: (opts) => ({
      minChainDepth: opts.minChainDepth
        ? parseInt(opts.minChainDepth, 10)
        : undefined,
    }),
    importTool: async () => {
      const tool = await import('@aiready/contract-enforcement');
      return {
        analyze: tool.analyzeContractEnforcement,
        generateSummary: (report: any) => report.summary,
        calculateScore: (
          data: any,
          resultsCount?: number
        ): ToolScoringOutput => {
          const result = tool.calculateContractEnforcementScore(
            data,
            resultsCount ?? 0,
            resultsCount ?? 0
          );
          return {
            toolName: 'contract-enforcement',
            score: result.score,
            rawMetrics: result.dimensions || {},
            factors: (result.recommendations || []).map(
              (rec: string, i: number) => ({
                name: `Recommendation ${i + 1}`,
                impact: 0,
                description: rec,
              })
            ),
            recommendations: (result.recommendations || []).map(
              (rec: string) => ({
                action: rec,
                estimatedImpact: 5,
                priority: 'medium' as const,
              })
            ),
          };
        },
      };
    },
    renderConsole: ({ results, summary, score }) => {
      renderToolHeader(
        'Contract Enforcement',
        '🛡️',
        score?.score || 0,
        summary.rating
      );

      const rawData = results.rawData || results;
      console.log(
        chalk.dim(
          `     Patterns: ${summary.totalDefensivePatterns}  (${summary.defensiveDensity}/kLOC)  |  ${summary.sourceFiles} files scanned`
        )
      );

      const dims = summary.dimensions;
      if (dims) {
        const entries = [
          ['Type Escape Hatches', dims.typeEscapeHatchScore],
          ['Fallback Cascades', dims.fallbackCascadeScore],
          ['Error Transparency', dims.errorTransparencyScore],
          ['Boundary Validation', dims.boundaryValidationScore],
        ] as const;

        for (const [name, val] of entries) {
          const color =
            val >= 80 ? chalk.green : val >= 60 ? chalk.yellow : chalk.red;
          console.log(chalk.dim(`     ${name}: ${color(val + '/100')}`));
        }
      }

      if (
        summary.totalDefensivePatterns > 0 &&
        rawData['as-any'] !== undefined
      ) {
        const breakdown = [
          rawData['as-any'] && `as-any: ${rawData['as-any']}`,
          rawData['as-unknown'] && `as-unknown: ${rawData['as-unknown']}`,
          rawData['deep-optional-chain'] &&
            `deep-?.: ${rawData['deep-optional-chain']}`,
          rawData['nullish-literal-default'] &&
            `?? literal: ${rawData['nullish-literal-default']}`,
          rawData['swallowed-error'] &&
            `swallowed-error: ${rawData['swallowed-error']}`,
          rawData['env-fallback'] && `env-fallback: ${rawData['env-fallback']}`,
          rawData['unnecessary-guard'] &&
            `guard-clause: ${rawData['unnecessary-guard']}`,
          rawData['any-parameter'] && `any-param: ${rawData['any-parameter']}`,
          rawData['any-return'] && `any-return: ${rawData['any-return']}`,
        ]
          .filter(Boolean)
          .join('  |  ');
        console.log(chalk.dim(`     ${breakdown}`));
      }

      if (score) {
        renderToolScoreFooter(score);
      }
    },
  });
}
