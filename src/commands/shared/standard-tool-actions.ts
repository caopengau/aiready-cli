/**
 * Shared implementations for standard config-driven CLI actions.
 */

import {
  createStandardToolConfig,
  renderStandardSummary,
  chalk,
  type ToolScoringOutput,
} from './command-builder';
import { executeToolAction } from '../scan-helpers';

interface BaseToolOptions {
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

// --- Documentation Drift ---

interface DocDriftOptions extends BaseToolOptions {
  staleMonths?: number;
}

const docDriftConfig = createStandardToolConfig<DocDriftOptions>({
  toolName: 'doc-drift',
  label: 'Documentation Drift',
  emoji: '📝',
  importPath: '@aiready/doc-drift',
  analyzeFnName: 'analyzeDocDrift',
  scoreFnName: 'calculateDocDriftScore',
  defaults: { staleMonths: 6 },
  getCliOptions: (opts) => ({
    staleMonths: opts.staleMonths ? Number(opts.staleMonths) : undefined,
  }),
});

export async function docDriftAction(
  directory: string,
  options: DocDriftOptions
): Promise<ToolScoringOutput | undefined> {
  return await executeToolAction(directory, options, docDriftConfig);
}

// --- Dependency Health ---

interface DepsHealthOptions extends BaseToolOptions {
  trainingCutoffYear?: number;
}

const depsHealthConfig = createStandardToolConfig<DepsHealthOptions>({
  toolName: 'dependency-health',
  label: 'Dependency Health',
  emoji: '📦',
  importPath: '@aiready/deps',
  analyzeFnName: 'analyzeDeps',
  scoreFnName: 'calculateDepsScore',
  defaults: { trainingCutoffYear: 2023 },
  getCliOptions: (opts) => ({
    trainingCutoffYear: opts.trainingCutoffYear
      ? Number(opts.trainingCutoffYear)
      : undefined,
  }),
});

export async function depsHealthAction(
  directory: string,
  options: DepsHealthOptions
): Promise<ToolScoringOutput | undefined> {
  return await executeToolAction(directory, options, depsHealthConfig);
}

// --- AI Signal Clarity ---

interface AiSignalClarityOptions extends BaseToolOptions {
  minSeverity?: string;
}

const aiSignalClarityConfig = createStandardToolConfig<AiSignalClarityOptions>({
  toolName: 'ai-signal-clarity',
  label: 'AI Signal Clarity',
  emoji: '🧠',
  importPath: '@aiready/ai-signal-clarity',
  analyzeFnName: 'analyzeAiSignalClarity',
  scoreFnName: 'calculateAiSignalClarityScore',
  defaults: { minSeverity: 'info' },
  getCliOptions: (opts) => ({
    minSeverity: opts.minSeverity,
  }),
  render: ({ summary, score, elapsedTime }) => {
    renderStandardSummary({
      label: 'AI Signal Clarity',
      emoji: '🧠',
      summary: summary as Record<string, any>,
      score,
      elapsedTime,
      metrics: `Top Risk: ${chalk.italic((summary as any).topRisk || 'None')}`,
    });

    if ((summary as any).totalSignals > 0) {
      console.log(
        chalk.dim(
          `     ${(summary as any).criticalSignals} critical  ${(summary as any).majorSignals} major  ${(summary as any).minorSignals} minor signals`
        )
      );
    }
  },
});

export async function aiSignalClarityAction(
  directory: string,
  options: AiSignalClarityOptions
): Promise<ToolScoringOutput | undefined> {
  return await executeToolAction(directory, options, aiSignalClarityConfig);
}
