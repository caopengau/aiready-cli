/**
 * Doc drift risk command for unified CLI
 */

import chalk from 'chalk';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';

export async function docDriftAction(
  directory: string,
  options: any
): Promise<ToolScoringOutput | undefined> {
  const { analyzeDocDrift } = await import('@aiready/doc-drift');

  const config = await loadConfig(directory);
  const merged = mergeConfigWithDefaults(config, {
    staleMonths: 6,
  });

  const report = await analyzeDocDrift({
    rootDir: directory,
    include: options.include,
    exclude: options.exclude,
    staleMonths: options.staleMonths ?? merged.staleMonths ?? 6,
  });

  const scoring: ToolScoringOutput = {
    toolName: 'doc-drift',
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
    minimal: chalk.green,
    low: chalk.cyan,
    moderate: chalk.yellow,
    high: chalk.red,
    severe: chalk.bgRed.white,
  };
  const color = ratingColors[summary.rating] ?? chalk.white;
  console.log(
    `  📝 Documentation Drift:  ${chalk.bold(100 - scoring.score + '/100 health')} (${color(summary.rating)} risk)`
  );
  if (report.issues.length > 0) {
    console.log(chalk.dim(`     Found ${report.issues.length} drift issues.`));
  } else {
    console.log(chalk.dim(`     No documentation drift detected.`));
  }

  return scoring;
}
