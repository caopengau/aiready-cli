/**
 * Scan orchestrator - Main scan execution flow and metric consolidation
 */

import chalk from 'chalk';
import { readFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { calculateTokenBudget } from '@aiready/core';
import { analyzeUnified, scoreUnified, type ScoringResult } from '../index';
import {
  printScanSummary,
  printBusinessImpact,
  printScoring,
} from './report-formatter';
import { createProgressCallback, type ScanOptions } from './scan-helpers';

/**
 * Executes a unified scan based on the provided configuration.
 * Consolidates analysis results, scores, and calculates business metrics.
 *
 * @param resolvedDir - The directory being scanned
 * @param finalOptions - Final resolved scan options
 * @param options - Original CLI command options
 * @param startTime - The timestamp when the process started
 * @returns An object containing the unified results and the scoring result
 */
export async function runUnifiedScan(
  resolvedDir: string,
  finalOptions: any,
  options: ScanOptions,
  startTime: number
) {
  console.log(chalk.cyan('\n=== AIReady Run Preview ==='));
  console.log(
    chalk.white('Tools to run:'),
    (finalOptions.tools ?? []).join(', ')
  );

  // Dynamic progress callback
  const progressCallback = createProgressCallback();

  // Determine scoring profile for project-type-aware weighting
  const scoringProfile =
    options.profile ?? finalOptions.scoring?.profile ?? 'default';

  const results = await analyzeUnified({
    ...finalOptions,
    progressCallback,
    onProgress: () => {},
    suppressToolConfig: true,
  });

  printScanSummary(results, startTime);

  let scoringResult: ScoringResult | undefined;
  if (options.score || finalOptions.scoring?.showBreakdown) {
    // Pass the profile to scoreUnified
    scoringResult = await scoreUnified(results, {
      ...finalOptions,
      scoring: {
        ...finalOptions.scoring,
        profile: scoringProfile,
      },
    });

    printScoring(scoringResult, scoringProfile);

    // Trend comparison logic
    if (options.compareTo) {
      handleTrendComparison(options.compareTo, scoringResult);
    }

    // Token Budget & Cost Logic
    await handleBusinessImpactMetrics(
      results,
      scoringResult,
      options.model ?? 'gpt-5.4-mini'
    );
  }

  return { results, scoringResult };
}

/**
 * Handles trend comparison logic if a baseline report is provided.
 */
function handleTrendComparison(
  baselinePath: string,
  currentScoring: ScoringResult
) {
  try {
    const prevReport = JSON.parse(
      readFileSync(resolvePath(process.cwd(), baselinePath), 'utf8')
    );
    const prevScore = prevReport.scoring?.overall ?? prevReport.scoring?.score;

    if (typeof prevScore === 'number') {
      const diff = currentScoring.overall - prevScore;
      const diffStr = diff > 0 ? `+${diff}` : String(diff);
      if (diff > 0)
        console.log(
          chalk.green(
            `  📈 Trend: ${diffStr} compared to ${baselinePath} (${prevScore} → ${currentScoring.overall})`
          )
        );
      else if (diff < 0)
        console.log(
          chalk.red(
            `  📉 Trend: ${diffStr} compared to ${baselinePath} (${prevScore} → ${currentScoring.overall})`
          )
        );
      else
        console.log(
          chalk.blue(
            `  ➖ Trend: No change (${prevScore} → ${currentScoring.overall})`
          )
        );
    }
  } catch (e) {
    void e;
  }
}

/**
 * Calculates and prints business impact metrics (ROI, Token Budget).
 */
async function handleBusinessImpactMetrics(
  results: any,
  scoringResult: ScoringResult,
  modelId: string
) {
  // Token Budget & Cost Logic
  const totalWastedDuplication = (scoringResult.breakdown ?? []).reduce(
    (sum: number, s: any) =>
      sum + (s.tokenBudget?.wastedTokens?.bySource?.duplication ?? 0),
    0
  );
  const totalWastedFragmentation = (scoringResult.breakdown ?? []).reduce(
    (sum: number, s: any) =>
      sum + (s.tokenBudget?.wastedTokens?.bySource?.fragmentation ?? 0),
    0
  );
  const totalContext = Math.max(
    ...(scoringResult.breakdown ?? []).map(
      (s: any) => s.tokenBudget?.totalContextTokens ?? 0
    ),
    0
  );

  if (totalContext > 0) {
    const unifiedBudget = calculateTokenBudget({
      totalContextTokens: totalContext,
      wastedTokens: {
        duplication: totalWastedDuplication,
        fragmentation: totalWastedFragmentation,
        chattiness: totalContext * 0.1, // Default chattiness
      },
    });

    const allIssues: any[] = [];
    for (const toolId of results.summary.toolsRun) {
      if (results[toolId]?.results) {
        results[toolId].results.forEach((fileRes: any) => {
          if (fileRes.issues) {
            allIssues.push(...fileRes.issues);
          }
        });
      }
    }

    const { calculateBusinessROI } = await import('@aiready/core');
    const roi = calculateBusinessROI({
      tokenWaste: unifiedBudget.wastedTokens.total,
      issues: allIssues,
      modelId: modelId,
    });

    printBusinessImpact(roi, unifiedBudget);

    (results.summary as Record<string, unknown>).businessImpact = {
      estimatedMonthlyWaste: roi.monthlySavings,
      potentialSavings: roi.monthlySavings,
      productivityHours: roi.productivityGainHours,
    };

    (scoringResult as Record<string, unknown>).tokenBudget = unifiedBudget;
    (scoringResult as Record<string, unknown>).businessROI = roi;
  }
}
