import { calculateAiSignalClarity, ToolName } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { AiSignalClarityReport } from './types';

/**
 * Convert AI signal clarity report into a ToolScoringOutput
 * suitable for inclusion in the unified AIReady score.
 *
 * Note: The risk score from core is 0-100 where higher = more risk.
 * We invert it so the spoke score is 0-100 where higher = better.
 */
export function calculateAiSignalClarityScore(
  report: AiSignalClarityReport
): ToolScoringOutput {
  const { aggregateSignals } = report;

  const riskResult = calculateAiSignalClarity({
    overloadedSymbols: aggregateSignals.overloadedSymbols,
    magicLiterals: aggregateSignals.magicLiterals,
    booleanTraps: aggregateSignals.booleanTraps,
    implicitSideEffects: aggregateSignals.implicitSideEffects,
    deepCallbacks: aggregateSignals.deepCallbacks,
    ambiguousNames: aggregateSignals.ambiguousNames,
    undocumentedExports: aggregateSignals.undocumentedExports,
    totalSymbols: Math.max(1, aggregateSignals.totalSymbols),
    totalExports: Math.max(1, aggregateSignals.totalExports),
  });

  // Invert: high risk = low score
  const score = Math.max(0, 100 - riskResult.score);

  const factors: ToolScoringOutput['factors'] = riskResult.signals.map(
    (sig) => ({
      name: sig.name,
      impact: -sig.riskContribution,
      description: sig.description,
    })
  );

  const recommendations: ToolScoringOutput['recommendations'] =
    riskResult.recommendations.map((rec) => ({
      action: rec,
      estimatedImpact: 8,
      priority: riskResult.score > 50 ? 'high' : 'medium',
    }));

  return {
    toolName: ToolName.AiSignalClarity,
    score,
    rawMetrics: {
      riskScore: riskResult.score,
      rating: riskResult.rating,
      topRisk: riskResult.topRisk,
      ...aggregateSignals,
    },
    factors,
    recommendations,
  };
}
