/**
 * Testability command for unified CLI
 */

import chalk from 'chalk';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';

export async function testabilityAction(
  directory: string,
  options: any,
): Promise<ToolScoringOutput | undefined> {
  const { analyzeTestability, calculateTestabilityScore } = await import('@aiready/testability');

  const config = await loadConfig(directory);
  const merged = mergeConfigWithDefaults(config, {
    minCoverageRatio: 0.3,
  });

  const report = await analyzeTestability({
    rootDir: directory,
    minCoverageRatio: options.minCoverageRatio ?? merged.minCoverageRatio,
    include: options.include,
    exclude: options.exclude,
  });

  const scoring = calculateTestabilityScore(report);

  if (options.output === 'json') {
    return scoring;
  }

  const safetyIcons: Record<string, string> = {
    'safe': '✅',
    'moderate-risk': '⚠️ ',
    'high-risk': '🔴',
    'blind-risk': '💀',
  };
  const safetyColors: Record<string, Function> = {
    'safe': chalk.green,
    'moderate-risk': chalk.yellow,
    'high-risk': chalk.red,
    'blind-risk': chalk.bgRed.white,
  };

  const safety = report.summary.aiChangeSafetyRating;
  const icon = safetyIcons[safety] ?? '❓';
  const color = safetyColors[safety] ?? chalk.white;

  console.log(`  🧪 Testability:         ${chalk.bold(scoring.score + '/100')} (${report.summary.rating})`);
  console.log(`     AI Change Safety:  ${color(`${icon} ${safety.toUpperCase()}`)}`);
  console.log(chalk.dim(`     Coverage: ${Math.round(report.summary.coverageRatio * 100)}%  (${report.rawData.testFiles} test / ${report.rawData.sourceFiles} source files)`));

  // Critical blind-risk banner in the unified output
  if (safety === 'blind-risk') {
    console.log(chalk.red.bold('\n     ⚠️  NO TESTS — AI changes to this codebase are completely unverifiable!\n'));
  }

  return scoring;
}
