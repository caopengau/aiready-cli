import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeTestability } from './analyzer';
import { calculateTestabilityScore } from './scoring';
import { TestabilityOptions, TestabilityReport } from './types';

/**
 * Testability Tool Provider
 */
export const TestabilityProvider: ToolProvider = {
  id: ToolName.TestabilityIndex,
  alias: ['testability', 'tests', 'verification'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeTestability(options as TestabilityOptions);

    const results: AnalysisResult[] = report.issues.map((i) => ({
      fileName: i.location.file,
      issues: [i] as any[],
      metrics: {
        testabilityScore: report.summary.score,
      },
    }));

    return SpokeOutputSchema.parse({
      results,
      summary: report.summary,
      metadata: {
        toolName: ToolName.TestabilityIndex,
        version: '0.2.5',
        timestamp: new Date().toISOString(),
        rawData: report.rawData,
      },
    });
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    const report = {
      summary: output.summary,
      rawData: (output.metadata as any).rawData,
      recommendations: (output.summary as any).recommendations || [],
    } as unknown as TestabilityReport;

    return calculateTestabilityScore(report);
  },

  defaultWeight: 10,
};
