import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeAiSignalClarity } from './analyzer';
import { calculateAiSignalClarityScore } from './scoring';
import { AiSignalClarityOptions, AiSignalClarityReport } from './types';

/**
 * AI Signal Clarity Tool Provider
 */
export const AiSignalClarityProvider: ToolProvider = {
  id: ToolName.AiSignalClarity,
  alias: ['ai-signal', 'clarity', 'hallucination'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeAiSignalClarity(
      options as AiSignalClarityOptions
    );

    const results: AnalysisResult[] = report.results.map((r) => ({
      fileName: r.filePath,
      issues: r.issues as any[],
      metrics: {
        aiSignalClarityScore: 100, // Default or calculated via scoring
      },
    }));

    return SpokeOutputSchema.parse({
      results,
      summary: report.summary,
      metadata: {
        toolName: ToolName.AiSignalClarity,
        version: '0.9.5',
        timestamp: new Date().toISOString(),
        aggregateSignals: report.aggregateSignals,
      },
    });
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    const report = {
      summary: output.summary,
      aggregateSignals: (output.metadata as any).aggregateSignals,
      results: [], // Not needed for scoring
    } as unknown as AiSignalClarityReport;

    return calculateAiSignalClarityScore(report);
  },

  defaultWeight: 11,
};
