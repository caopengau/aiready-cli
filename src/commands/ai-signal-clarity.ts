/**
 * AI signal clarity command for unified CLI
 */

import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { resolveOutputPath, loadConfig, mergeConfigWithDefaults } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';

export async function aiSignalClarityAction(
  directory: string,
  options: any,
): Promise<ToolScoringOutput | undefined> {
  const { analyzeAiSignalClarity, calculateHallucinationScore } = await import('@aiready/ai-signal-clarity');

  const config = await loadConfig(directory);
  const merged = mergeConfigWithDefaults(config, {
    minSeverity: 'info',
  });

  const report = await analyzeAiSignalClarity({
    rootDir: directory,
    minSeverity: options.minSeverity ?? merged.minSeverity ?? 'info',
    include: options.include,
    exclude: options.exclude,
  });

  const scoring = calculateHallucinationScore(report);

  if (options.output === 'json') {
    return scoring;
  }

  const { summary } = report;
  const ratingColors: Record<string, Function> = {
    minimal: chalk.green,
    low: chalk.cyan,
    moderate: chalk.yellow,
    high: chalk.red,
    severe: chalk.bgRed.white,
  };
  const color = ratingColors[summary.rating] ?? chalk.white;
  console.log(`  🧠 AI Signal Clarity:  ${chalk.bold(scoring.score + '/100')} (${color(summary.rating)})`);
  console.log(`     Top Risk: ${chalk.italic(summary.topRisk)}`);
  if (summary.totalSignals > 0) {
    console.log(chalk.dim(`     ${summary.criticalSignals} critical  ${summary.majorSignals} major  ${summary.minorSignals} minor signals`));
  }

  return scoring;
}
