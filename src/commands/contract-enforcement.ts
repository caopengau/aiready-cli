/**
 * Contract enforcement command - Analyze defensive coding patterns
 */

import type { ToolScoringOutput } from '@aiready/core';
import {
  defineToolCommand,
  renderToolHeader,
  renderToolScoreFooter,
  chalk,
} from './shared/command-builder';

interface ContractEnforcementOptions {
  minChainDepth?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

export function defineContractEnforcementCommand(
  program: import('commander').Command
) {
  defineToolCommand(program, {
    name: 'contracts',
    description: 'Analyze defensive coding patterns and contract enforcement',
    toolName: 'contract-enforcement',
    label: 'Contract enforcement analysis',
    emoji: '🛡️',
    options: [
      {
        flags: '--min-chain-depth <number>',
        description: 'Minimum chain depth to analyze',
        defaultValue: '3',
      },
    ],
    actionConfig: {
      defaults: {
        rootDir: '',
        minChainDepth: 3,
        include: undefined,
        exclude: undefined,
        output: { format: 'console', file: undefined },
      },
      getCliOptions: (opts: ContractEnforcementOptions) => ({
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
      renderConsole: ({ results, summary, score }: any) => {
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
            `as-any: ${rawData['as-any'] || 0}`,
            `as-unknown: ${rawData['as-unknown'] || 0}`,
            `deep-?.: ${rawData['deep-optional-chain'] || 0}`,
            `?? literal: ${rawData['nullish-literal-default'] || 0}`,
            `swallowed-error: ${rawData['swallowed-error'] || 0}`,
            `env-fallback: ${rawData['env-fallback'] || 0}`,
            `guard-clause: ${rawData['unnecessary-guard'] || 0}`,
            `any-param: ${rawData['any-parameter'] || 0}`,
            `any-return: ${rawData['any-return'] || 0}`,
          ].join('  |  ');
          console.log(chalk.dim(`     ${breakdown}`));
        }

        if (score) {
          renderToolScoreFooter(score);
        }
      },
    },
  });
}

export async function contractEnforcementAction(
  directory: string,
  options: ContractEnforcementOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

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
          `as-any: ${rawData['as-any'] || 0}`,
          `as-unknown: ${rawData['as-unknown'] || 0}`,
          `deep-?.: ${rawData['deep-optional-chain'] || 0}`,
          `?? literal: ${rawData['nullish-literal-default'] || 0}`,
          `swallowed-error: ${rawData['swallowed-error'] || 0}`,
          `env-fallback: ${rawData['env-fallback'] || 0}`,
          `guard-clause: ${rawData['unnecessary-guard'] || 0}`,
          `any-param: ${rawData['any-parameter'] || 0}`,
          `any-return: ${rawData['any-return'] || 0}`,
        ].join('  |  ');
        console.log(chalk.dim(`     ${breakdown}`));
      }

      if (score) {
        renderToolScoreFooter(score);
      }
    },
  });
}
