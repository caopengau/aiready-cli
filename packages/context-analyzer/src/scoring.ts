import {
  calculateMonthlyCost,
  calculateProductivityImpact,
  DEFAULT_COST_CONFIG,
  type CostConfig,
  ToolName,
} from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { ContextSummary } from './types';

/**
 * Calculate AI Readiness Score for context efficiency (0-100)
 */
export function calculateContextScore(
  summary: ContextSummary,
  costConfig?: Partial<CostConfig>
): ToolScoringOutput {
  const {
    avgContextBudget,
    maxContextBudget,
    avgImportDepth,
    maxImportDepth,
    avgFragmentation,
    criticalIssues,
    majorIssues,
  } = summary;

  const budgetScore =
    avgContextBudget < 5000
      ? 100
      : Math.max(0, 100 - (avgContextBudget - 5000) / 150);

  const depthScore =
    avgImportDepth < 5 ? 100 : Math.max(0, 100 - (avgImportDepth - 5) * 10);

  const fragmentationScore =
    avgFragmentation < 0.3
      ? 100
      : Math.max(0, 100 - (avgFragmentation - 0.3) * 200);

  const criticalPenalty = criticalIssues * 10;
  const majorPenalty = majorIssues * 3;

  const maxBudgetPenalty =
    maxContextBudget > 15000
      ? Math.min(20, (maxContextBudget - 15000) / 500)
      : 0;

  const rawScore =
    budgetScore * 0.4 + depthScore * 0.3 + fragmentationScore * 0.3;
  const finalScore =
    rawScore - criticalPenalty - majorPenalty - maxBudgetPenalty;

  const score = Math.max(0, Math.min(100, Math.round(finalScore)));

  const factors = [
    {
      name: 'Context Budget',
      impact: Math.round(budgetScore * 0.4 - 40),
      description: `Avg ${Math.round(avgContextBudget)} tokens per file ${avgContextBudget < 5000 ? '(excellent)' : avgContextBudget < 10000 ? '(acceptable)' : '(high)'}`,
    },
    {
      name: 'Import Depth',
      impact: Math.round(depthScore * 0.3 - 30),
      description: `Avg ${avgImportDepth.toFixed(1)} levels ${avgImportDepth < 5 ? '(excellent)' : avgImportDepth < 8 ? '(acceptable)' : '(deep)'}`,
    },
    {
      name: 'Fragmentation',
      impact: Math.round(fragmentationScore * 0.3 - 30),
      description: `${(avgFragmentation * 100).toFixed(0)}% fragmentation ${avgFragmentation < 0.3 ? '(well-organized)' : avgFragmentation < 0.5 ? '(moderate)' : '(high)'}`,
    },
  ];

  if (criticalIssues > 0) {
    factors.push({
      name: 'Critical Issues',
      impact: -criticalPenalty,
      description: `${criticalIssues} critical context issue${criticalIssues > 1 ? 's' : ''}`,
    });
  }

  if (majorIssues > 0) {
    factors.push({
      name: 'Major Issues',
      impact: -majorPenalty,
      description: `${majorIssues} major context issue${majorIssues > 1 ? 's' : ''}`,
    });
  }

  if (maxBudgetPenalty > 0) {
    factors.push({
      name: 'Extreme File Detected',
      impact: -Math.round(maxBudgetPenalty),
      description: `One file requires ${Math.round(maxContextBudget)} tokens (very high)`,
    });
  }

  const recommendations: ToolScoringOutput['recommendations'] = [];

  if (avgContextBudget > 10000) {
    const estimatedImpact = Math.min(
      15,
      Math.round((avgContextBudget - 10000) / 1000)
    );
    recommendations.push({
      action: 'Reduce file dependencies to lower context requirements',
      estimatedImpact,
      priority: 'high',
    });
  }

  if (avgImportDepth > 8) {
    const estimatedImpact = Math.min(10, Math.round((avgImportDepth - 8) * 2));
    recommendations.push({
      action: 'Flatten import chains to reduce depth',
      estimatedImpact,
      priority: avgImportDepth > 10 ? 'high' : 'medium',
    });
  }

  if (avgFragmentation > 0.5) {
    const estimatedImpact = Math.min(
      12,
      Math.round((avgFragmentation - 0.5) * 40)
    );
    recommendations.push({
      action: 'Consolidate related code into cohesive modules',
      estimatedImpact,
      priority: 'medium',
    });
  }

  if (maxContextBudget > 20000) {
    recommendations.push({
      action: `Split large file (${Math.round(maxContextBudget)} tokens) into smaller modules`,
      estimatedImpact: 8,
      priority: 'high',
    });
  }

  const cfg = { ...DEFAULT_COST_CONFIG, ...costConfig };
  const estimatedMonthlyCost = calculateMonthlyCost(
    avgContextBudget * (summary.totalFiles || 1),
    cfg
  );

  const issues = [
    ...Array(criticalIssues).fill({ severity: 'critical' as const }),
    ...Array(majorIssues).fill({ severity: 'major' as const }),
  ];
  const productivityImpact = calculateProductivityImpact(issues);

  return {
    toolName: ToolName.ContextAnalyzer,
    score,
    rawMetrics: {
      avgContextBudget: Math.round(avgContextBudget),
      maxContextBudget: Math.round(maxContextBudget),
      avgImportDepth: Math.round(avgImportDepth * 10) / 10,
      maxImportDepth,
      avgFragmentation: Math.round(avgFragmentation * 100) / 100,
      criticalIssues,
      majorIssues,
      estimatedMonthlyCost,
      estimatedDeveloperHours: productivityImpact.totalHours,
    },
    factors,
    recommendations,
  };
}

export function mapScoreToRating(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'needs work';
  return 'critical';
}
