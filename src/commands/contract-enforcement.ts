/**
 * Contract enforcement command - Analyze defensive coding patterns
 */

import {
  defineToolCommand,
  renderToolHeader,
  renderToolScoreFooter,
  chalk,
  createStandardToolConfig,
  renderStandardSummary,
} from './shared/command-builder';

interface ContractEnforcementOptions {
  minChainDepth?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

const contractEnforcementConfig =
  createStandardToolConfig<ContractEnforcementOptions>({
    toolName: 'contract-enforcement',
    label: 'Contract enforcement analysis',
    emoji: '🛡️',
    importPath: '@aiready/contract-enforcement',
    analyzeFnName: 'analyzeContractEnforcement',
    defaults: { minChainDepth: 3 },
    getCliOptions: (opts) => ({
      minChainDepth: opts.minChainDepth
        ? parseInt(opts.minChainDepth, 10)
        : undefined,
    }),
    render: ({ results, summary, score, elapsedTime }) => {
      const rawData = (results as Record<string, any>).rawData || results;
      const summaryRecord = summary as Record<string, any>;
      const metrics = `Patterns: ${summaryRecord.totalDefensivePatterns} (${summaryRecord.defensiveDensity}/kLOC)`;

      renderStandardSummary({
        label: 'Contract Enforcement',
        emoji: '🛡️',
        summary: summaryRecord,
        score,
        elapsedTime,
        metrics,
      });

      const dims = summaryRecord.dimensions as Record<string, number>;
      if (dims) {
        console.log(
          chalk.dim(
            `     Types: ${dims.typeEscapeHatchScore} | Fallbacks: ${dims.fallbackCascadeScore} | Errors: ${dims.errorTransparencyScore} | Validation: ${dims.boundaryValidationScore}`
          )
        );
      }

      if (
        (summaryRecord.totalDefensivePatterns as number) > 0 &&
        rawData['as-any'] !== undefined
      ) {
        const breakdown = [
          `any: ${Number(rawData['as-any']) + Number(rawData['any-parameter']) + Number(rawData['any-return'])}`,
          `unknown: ${rawData['as-unknown']}`,
          `chaining: ${rawData['deep-optional-chain']}`,
          `fallbacks: ${Number(rawData['nullish-literal-default']) + Number(rawData['env-fallback'])}`,
        ].join('  |  ');
        console.log(chalk.dim(`     Details: ${breakdown}`));
      }
    },
  });

// Override calculateScore because it has custom arguments
const originalImportTool = contractEnforcementConfig.importTool;
contractEnforcementConfig.importTool = async () => {
  const tool = await import('@aiready/contract-enforcement');
  const base = await originalImportTool();
  return {
    ...base,
    calculateScore: (data: unknown, resultsCount?: number) => {
      const result = tool.calculateContractEnforcementScore(
        data as any,
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
        recommendations: (result.recommendations || []).map((rec: string) => ({
          action: rec,
          estimatedImpact: 5,
          priority: 'medium' as const,
        })),
      };
    },
  };
};

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
    actionConfig: contractEnforcementConfig,
  });
}

export async function contractEnforcementAction(
  directory: string,
  options: ContractEnforcementOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, {
    ...contractEnforcementConfig,
  });
}
