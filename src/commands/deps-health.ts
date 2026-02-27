/**
 * Dependency health command for unified CLI
 */

import chalk from 'chalk';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';

export async function depsHealthAction(
  directory: string,
  options: any
): Promise<ToolScoringOutput | undefined> {
  const { analyzeDeps } = await import('@aiready/deps');

  const config = await loadConfig(directory);
  const merged = mergeConfigWithDefaults(config, {
    trainingCutoffYear: 2023,
  });

  const report = await analyzeDeps({
    rootDir: directory,
    include: options.include,
    exclude: options.exclude,
    trainingCutoffYear:
      options.trainingCutoffYear ?? merged.trainingCutoffYear ?? 2023,
  });

  const scoring: ToolScoringOutput = {
    toolName: 'dependency-health',
    score: report.summary.score,
    rawMetrics: report.rawData,
    factors: [],
    recommendations: report.recommendations.map((action: string) => ({
      action,
      estimatedImpact: 5,
      priority: 'medium',
    })),
  };

  if (options.output === 'json') {
    return scoring;
  }

  const { summary } = report;
  const ratingColors: Record<string, (s: string) => string> = {
    excellent: chalk.green,
    good: chalk.blueBright,
    moderate: chalk.yellow,
    poor: chalk.red,
    hazardous: chalk.bgRed.white,
  };
  const color = ratingColors[summary.rating] ?? chalk.white;
  console.log(
    `  📦 Dependency Health:  ${chalk.bold(scoring.score + '/100 health')} (${color(summary.rating)})`
  );
  if (report.issues.length > 0) {
    console.log(
      chalk.dim(`     Found ${report.issues.length} dependency issues.`)
    );
  } else {
    console.log(chalk.dim(`     Dependencies look healthy for AI assistance.`));
  }

  return scoring;
}
