import { calculateProductivityImpact, ToolName } from '@aiready/core';
import type { ToolScoringOutput, CostConfig } from '@aiready/core';
import type { ConsistencyIssue } from './types';

/**
 * Calculate AI Readiness Score for code consistency (0-100)
 *
 * Based on:
 * - Issue density (issues per file)
 * - Weighted severity (critical: 10pts, major: 3pts, minor: 0.5pts)
 * - Pattern consistency across codebase
 *
 * Includes business value metrics:
 * - Estimated developer hours to fix consistency issues
 */
export function calculateConsistencyScore(
  issues: ConsistencyIssue[],
  totalFilesAnalyzed: number,
  costConfig?: Partial<CostConfig>
): ToolScoringOutput {
  // Parameter reserved for future configuration; reference to avoid lint warnings
  void costConfig;
  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
  const majorIssues = issues.filter((i) => i.severity === 'major').length;
  const minorIssues = issues.filter((i) => i.severity === 'minor').length;
  const totalIssues = issues.length;

  // Issue density penalty (0-50 points)
  // Ideal: 0 issues/file = 0 penalty
  // Acceptable: <1 issue/file = 10 penalty
  // High: 1-3 issues/file = 10-40 penalty
  // Critical: >3 issues/file = 40-50 penalty
  const issuesPerFile =
    totalFilesAnalyzed > 0 ? totalIssues / totalFilesAnalyzed : 0;
  const densityPenalty = Math.min(50, issuesPerFile * 15);

  // Weighted severity penalty (0-50 points)
  // Each critical: 10 points
  // Each major: 3 points
  // Each minor: 0.5 points
  const weightedCount =
    criticalIssues * 10 + majorIssues * 3 + minorIssues * 0.5;
  const avgWeightedIssuesPerFile =
    totalFilesAnalyzed > 0 ? weightedCount / totalFilesAnalyzed : 0;
  const severityPenalty = Math.min(50, avgWeightedIssuesPerFile * 2);

  // Calculate final score
  const rawScore = 100 - densityPenalty - severityPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Build factors array
  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Issue Density',
      impact: -Math.round(densityPenalty),
      description: `${issuesPerFile.toFixed(2)} issues per file ${issuesPerFile < 1 ? '(excellent)' : issuesPerFile < 3 ? '(acceptable)' : '(high)'}`,
    },
  ];

  if (criticalIssues > 0) {
    const criticalImpact = Math.min(30, criticalIssues * 10);
    factors.push({
      name: 'Critical Issues',
      impact: -criticalImpact,
      description: `${criticalIssues} critical consistency issue${criticalIssues > 1 ? 's' : ''} (high AI confusion risk)`,
    });
  }

  if (majorIssues > 0) {
    const majorImpact = Math.min(20, Math.round(majorIssues * 3));
    factors.push({
      name: 'Major Issues',
      impact: -majorImpact,
      description: `${majorIssues} major issue${majorIssues > 1 ? 's' : ''} (moderate AI confusion risk)`,
    });
  }

  if (minorIssues > 0 && minorIssues >= totalFilesAnalyzed) {
    const minorImpact = -Math.round(minorIssues * 0.5);
    factors.push({
      name: 'Minor Issues',
      impact: minorImpact,
      description: `${minorIssues} minor issue${minorIssues > 1 ? 's' : ''} (slight AI confusion risk)`,
    });
  }

  // Generate recommendations
  const recommendations: ToolScoringOutput['recommendations'] = [];

  if (criticalIssues > 0) {
    const estimatedImpact = Math.min(30, criticalIssues * 10);
    recommendations.push({
      action:
        'Fix critical naming/pattern inconsistencies (highest AI confusion risk)',
      estimatedImpact,
      priority: 'high',
    });
  }

  if (majorIssues > 5) {
    const estimatedImpact = Math.min(15, Math.round(majorIssues / 2));
    recommendations.push({
      action: 'Standardize naming conventions across codebase',
      estimatedImpact,
      priority: 'medium',
    });
  }

  if (issuesPerFile > 3) {
    recommendations.push({
      action:
        'Establish and enforce coding style guide to reduce inconsistencies',
      estimatedImpact: 12,
      priority: 'medium',
    });
  }

  if (totalIssues > 20 && minorIssues / totalIssues > 0.7) {
    recommendations.push({
      action: 'Enable linter/formatter to automatically fix minor style issues',
      estimatedImpact: 8,
      priority: 'low',
    });
  }

  // Calculate business value metrics
  const productivityImpact = calculateProductivityImpact(issues);

  return {
    toolName: ToolName.NamingConsistency,
    score,
    rawMetrics: {
      totalIssues,
      criticalIssues,
      majorIssues,
      minorIssues,
      issuesPerFile: Math.round(issuesPerFile * 100) / 100,
      avgWeightedIssuesPerFile:
        Math.round(avgWeightedIssuesPerFile * 100) / 100,
      // Business value metrics
      estimatedDeveloperHours: productivityImpact.totalHours,
    },
    factors,
    recommendations,
  };
}
