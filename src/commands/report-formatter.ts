import chalk from 'chalk';
import {
  Severity,
  ScoringResult,
  formatScore,
  getRating,
  getRatingDisplay,
} from '@aiready/core';

/**
 * Handle console output for the scan results
 */
export function printScanSummary(results: any, startTime: number) {
  console.log(chalk.cyan('\n=== AIReady Run Summary ==='));
  console.log(
    `  Total issues (all tools): ${chalk.bold(String(results.summary.totalIssues || 0))}`
  );
  console.log(
    `  Execution time: ${chalk.bold(((Date.now() - startTime) / 1000).toFixed(2) + 's')}`
  );
}

/**
 * Print business impact analysis
 */
export function printBusinessImpact(roi: any, unifiedBudget: any) {
  console.log(chalk.bold('\n💰 Business Impact Analysis (Monthly)'));
  console.log(
    `  Potential Savings: ${chalk.green(chalk.bold('$' + roi.monthlySavings.toLocaleString()))}`
  );
  console.log(
    `  Productivity Gain: ${chalk.cyan(chalk.bold(roi.productivityGainHours + 'h'))} (est. dev time)`
  );
  console.log(
    `  Context Efficiency: ${chalk.yellow((unifiedBudget.efficiencyRatio * 100).toFixed(0) + '%')}`
  );
  console.log(
    `  Annual Value: ${chalk.bold('$' + roi.annualValue.toLocaleString())} (ROI Prediction)`
  );
}

/**
 * Print detailed scoring breakdown
 */
export function printScoring(
  scoringResult: ScoringResult,
  scoringProfile: string
) {
  console.log(chalk.bold('\n📊 AI Readiness Overall Score'));
  console.log(`  ${formatScore(scoringResult)}`);
  console.log(chalk.dim(`  (Scoring Profile: ${scoringProfile})`));

  if (scoringResult.breakdown) {
    console.log(chalk.bold('\nTool breakdown:'));
    scoringResult.breakdown.forEach((tool) => {
      const rating = getRating(tool.score);
      const emoji = getRatingDisplay(rating).emoji;
      console.log(
        `  - ${tool.toolName}: ${tool.score}/100 (${rating}) ${emoji}`
      );
    });

    // Top Actionable Recommendations
    const allRecs = scoringResult.breakdown
      .flatMap((t) =>
        (t.recommendations || []).map((r) => ({ ...r, tool: t.toolName }))
      )
      .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
      .slice(0, 3);

    if (allRecs.length > 0) {
      console.log(chalk.bold('\n🎯 Top Actionable Recommendations:'));
      allRecs.forEach((rec, i) => {
        const priorityIcon =
          rec.priority === 'high'
            ? '🔴'
            : rec.priority === 'medium'
              ? '🟡'
              : '🔵';
        console.log(`  ${i + 1}. ${priorityIcon} ${chalk.bold(rec.action)}`);
        console.log(
          `     Impact: ${chalk.green(`+${rec.estimatedImpact} points`)} to ${rec.tool}`
        );
      });
    }
  }
}

/**
 * Normalize report mapping (CLI logic)
 */
export function mapToUnifiedReport(
  res: any,
  scoring: ScoringResult | undefined
) {
  const allResults: any[] = [];
  const totalFilesSet = new Set<string>();
  let criticalCount = 0;
  let majorCount = 0;

  res.summary.toolsRun.forEach((toolId: string) => {
    const spokeRes = res[toolId];
    if (!spokeRes || !spokeRes.results) return;

    spokeRes.results.forEach((r: any) => {
      totalFilesSet.add(r.fileName);
      allResults.push(r);
      r.issues?.forEach((i: any) => {
        if (i.severity === Severity.Critical || i.severity === 'critical')
          criticalCount++;
        if (i.severity === Severity.Major || i.severity === 'major')
          majorCount++;
      });
    });
  });

  return {
    ...res,
    results: allResults,
    summary: {
      ...res.summary,
      totalFiles: totalFilesSet.size,
      criticalIssues: criticalCount,
      majorIssues: majorCount,
    },
    scoring,
  };
}
