import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeChangeAmplification } from './analyzer';
import {
  ChangeAmplificationOptions,
  FileChangeAmplificationResult,
} from './types';

/**
 * Change Amplification Tool Provider
 */
export const ChangeAmplificationProvider: ToolProvider = {
  id: ToolName.ChangeAmplification,
  alias: ['change-amp', 'change-amplification', 'coupling'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeChangeAmplification(
      options as ChangeAmplificationOptions
    );

    return SpokeOutputSchema.parse({
      results: report.results as AnalysisResult[],
      summary: report.summary,
      metadata: {
        toolName: ToolName.ChangeAmplification,
        version: '0.9.5',
        timestamp: new Date().toISOString(),
      },
    });
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    const summary = output.summary as any;

    return {
      toolName: ToolName.ChangeAmplification,
      score: summary.score || 0,
      rawMetrics: summary,
      factors: [],
      recommendations: (summary.recommendations || []).map(
        (action: string) => ({
          action,
          estimatedImpact: 5,
          priority: 'medium',
        })
      ),
    };
  },

  defaultWeight: 8,
};
