/**
 * Agent grounding command - Analyze agent grounding readiness
 */

import {
  defineToolCommand,
  renderToolHeader,
  renderSafetyRating,
  renderToolScoreFooter,
  chalk,
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
    actionConfig: {
      defaults: {
        rootDir: '',
        maxRecommendedDepth: 4,
        readmeStaleDays: 90,
        include: undefined,
        exclude: undefined,
        output: { format: 'console', file: undefined },
      },
      getCliOptions: (opts: GroundingOptions) => ({
        maxRecommendedDepth: opts.maxDepth
          ? parseInt(opts.maxDepth)
          : undefined,
        readmeStaleDays: opts.readmeStaleDays
          ? parseInt(opts.readmeStaleDays)
          : undefined,
      }),
      importTool: async () => {
        const tool = await import('@aiready/agent-grounding');
        return {
          analyze: tool.analyzeAgentGrounding,
          generateSummary: (report: any) => report.summary,
          calculateScore: (data: any) => {
            const score = tool.calculateGroundingScore(data);
            return {
              ...score,
              toolName: 'agent-grounding',
              rawMetrics: data,
              factors: [],
              recommendations: (score.recommendations || []).map(
                (action: string) => ({
                  action,
                  estimatedImpact: 10,
                  priority: 'medium',
                })
              ),
            };
          },
        };
      },
      renderConsole: ({ results, summary, score }: any) => {
        renderToolHeader(
          'Agent Grounding',
          '🧠',
          score?.score || 0,
          summary.rating
        );
        renderSafetyRating(summary.rating);

        const _rawData = results.rawData || results;
        console.log(
          chalk.dim(
            `     Files: ${summary.filesAnalyzed}  Dirs: ${summary.directoriesAnalyzed}`
          )
        );

        if (score) {
          renderToolScoreFooter(score);
        }
      },
    },
  });
}

export async function agentGroundingAction(
  directory: string,
  options: GroundingOptions
) {
  const { executeToolAction } = await import('./scan-helpers');

  return await executeToolAction(directory, options, {
    toolName: 'agent-grounding',
    label: 'Agent grounding',
    emoji: '🧭',
    defaults: {
      rootDir: '',
      maxRecommendedDepth: 4,
      readmeStaleDays: 90,
      include: undefined,
      exclude: undefined,
      output: { format: 'console', file: undefined },
    },
    getCliOptions: (opts) => ({
      maxRecommendedDepth: opts.maxDepth ? parseInt(opts.maxDepth) : undefined,
      readmeStaleDays: opts.readmeStaleDays
        ? parseInt(opts.readmeStaleDays)
        : undefined,
    }),
    importTool: async () => {
      const tool = await import('@aiready/agent-grounding');
      return {
        analyze: tool.analyzeAgentGrounding,
        generateSummary: (report: any) => report.summary,
        calculateScore: (data: any) => {
          const score = tool.calculateGroundingScore(data);
          return {
            ...score,
            toolName: 'agent-grounding',
            rawMetrics: data,
            factors: [],
            recommendations: (score.recommendations || []).map(
              (action: string) => ({
                action,
                estimatedImpact: 10,
                priority: 'medium',
              })
            ),
          };
        },
      };
    },
    renderConsole: ({ results, summary, score }) => {
      renderToolHeader(
        'Agent Grounding',
        '🧠',
        score?.score || 0,
        summary.rating
      );
      renderSafetyRating(summary.rating);

      const _rawData = results.rawData || results;
      console.log(
        chalk.dim(
          `     Files: ${summary.filesAnalyzed}  Dirs: ${summary.directoriesAnalyzed}`
        )
      );

      if (score) {
        renderToolScoreFooter(score);
      }
    },
  });
}
