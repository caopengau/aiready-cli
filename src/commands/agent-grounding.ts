/**
 * Agent grounding command for unified CLI
 */

import chalk from 'chalk';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';

export async function agentGroundingAction(
  directory: string,
  options: any
): Promise<ToolScoringOutput | undefined> {
  const { analyzeAgentGrounding, calculateGroundingScore } =
    await import('@aiready/agent-grounding');

  const config = await loadConfig(directory);
  const merged = mergeConfigWithDefaults(config, {
    maxRecommendedDepth: 4,
    readmeStaleDays: 90,
  });

  const report = await analyzeAgentGrounding({
    rootDir: directory,
    maxRecommendedDepth: options.maxDepth ?? merged.maxRecommendedDepth,
    readmeStaleDays: options.readmeStaleDays ?? merged.readmeStaleDays,
    include: options.include,
    exclude: options.exclude,
  });

  const scoring = calculateGroundingScore(report);

  if (options.output === 'json') {
    return scoring;
  }

  const scoreColor = (s: number) =>
    s >= 85
      ? chalk.green
      : s >= 70
        ? chalk.cyan
        : s >= 50
          ? chalk.yellow
          : chalk.red;
  void scoreColor;

  console.log(
    `  🧭 Agent Grounding:     ${chalk.bold(scoring.score + '/100')} (${report.summary.rating})`
  );
  const dims = report.summary.dimensions;
  const worstDim = Object.entries(dims).sort(([, a], [, b]) => a - b)[0];
  if (worstDim && worstDim[1] < 70) {
    const name = worstDim[0]
      .replace(/([A-Z])/g, ' $1')
      .replace('Score', '')
      .trim();
    console.log(
      chalk.dim(`     Weakest dimension: ${name} (${worstDim[1]}/100)`)
    );
  }

  return scoring;
}
