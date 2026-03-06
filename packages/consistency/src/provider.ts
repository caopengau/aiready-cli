import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeConsistency } from './analyzer';
import { calculateConsistencyScore } from './scoring';
import { ConsistencyOptions, ConsistencyIssue } from './types';

/**
 * Consistency Tool Provider
 */
export const ConsistencyProvider: ToolProvider = {
  id: ToolName.NamingConsistency,
  alias: ['consistency', 'naming', 'standards'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeConsistency(options as ConsistencyOptions);

    return SpokeOutputSchema.parse({
      results: report.results as AnalysisResult[],
      summary: report.summary,
      metadata: {
        toolName: ToolName.NamingConsistency,
        version: '0.16.5',
        timestamp: new Date().toISOString(),
      },
    });
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    const results = output.results as AnalysisResult[];
    const allIssues = results.flatMap((r) => r.issues as ConsistencyIssue[]);
    const totalFiles = (output.summary as any).filesAnalyzed || results.length;

    return calculateConsistencyScore(
      allIssues,
      totalFiles,
      (options as any).costConfig
    );
  },

  defaultWeight: 14,
};
