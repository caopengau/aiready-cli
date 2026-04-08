/**
 * Agent grounding command - Analyze agent grounding readiness
 */

import {
  defineToolCommand,
  createStandardToolConfig,
  renderStandardSummary,
} from './shared/command-builder';

interface GroundingOptions {
  maxDepth?: string;
  readmeStaleDays?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

const agentGroundingConfig = createStandardToolConfig<GroundingOptions>({
  toolName: 'agent-grounding',
  label: 'Agent grounding',
  emoji: '🧭',
  importPath: '@aiready/agent-grounding',
  analyzeFnName: 'analyzeAgentGrounding',
  scoreFnName: 'calculateGroundingScore',
  defaults: { maxRecommendedDepth: 4, readmeStaleDays: 90 },
  getCliOptions: (opts) => ({
    maxRecommendedDepth: opts.maxDepth ? parseInt(opts.maxDepth) : undefined,
    readmeStaleDays: opts.readmeStaleDays
      ? parseInt(opts.readmeStaleDays)
      : undefined,
  }),
  renderConsole: ({ summary, score, elapsedTime }) => {
    const summaryRecord = summary as Record<string, any>;
    renderStandardSummary({
      label: 'Agent Grounding',
      emoji: '🧠',
      summary: summaryRecord,
      score,
      elapsedTime,
      metrics: `Files: ${summaryRecord.filesAnalyzed}  Dirs: ${summaryRecord.directoriesAnalyzed}`,
    });
  },
});

export function defineAgentGroundingCommand(
  program: import('commander').Command
) {
  defineToolCommand(program, {
    name: 'grounding',
    description: 'Analyze agent grounding readiness',
    toolName: 'agent-grounding',
    label: 'Agent grounding',
    emoji: '🧭',
    options: [
      {
        flags: '--max-depth <number>',
        description: 'Maximum recommended import depth',
        defaultValue: '4',
      },
      {
        flags: '--readme-stale-days <number>',
        description: 'Days before README is considered stale',
        defaultValue: '90',
      },
    ],
    actionConfig: agentGroundingConfig,
  });
}

export async function agentGroundingAction(
  directory: string,
  options: GroundingOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, {
    ...agentGroundingConfig,
  });
}
