import chalk from 'chalk';
import { executeToolAction, BaseCommandOptions } from './scan-helpers';
import {
  renderToolHeader,
  renderSafetyRating,
  renderToolScoreFooter,
} from '../utils/terminal-renderers';

interface GroundingOptions extends BaseCommandOptions {
  maxDepth?: string;
  readmeStaleDays?: string;
}

export async function agentGroundingAction(
  directory: string,
  options: GroundingOptions
) {
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
      renderSafetyRating(summary.rating); // Using rating as safety for simplicity here

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
