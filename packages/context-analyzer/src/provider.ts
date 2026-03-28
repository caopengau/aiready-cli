import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  Severity,
  IssueType,
  SpokeOutputSchema,
} from '@aiready/core';
import { calculateContextScore } from './scoring';
import type {
  ContextAnalyzerOptions,
  ContextAnalysisResult,
  ContextSummary,
} from './types';

/**
 * Context Analyzer Tool Provider
 */
export const ContextAnalyzerProvider: ToolProvider = {
  id: ToolName.ContextAnalyzer,
  alias: ['context', 'fragmentation', 'budget'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const { analyzeContext } = await import('./orchestrator');
    const { generateSummary } = await import('./summary');

    const results = await analyzeContext(options as ContextAnalyzerOptions);
    const summary = generateSummary(results, options);

    // Normalize to SpokeOutput format
    const normalizedResults: AnalysisResult[] = results.map(
      (r: ContextAnalysisResult) => ({
        fileName: r.file,
        issues: r.issues.map((msg) => ({
          type: IssueType.ContextFragmentation,
          severity: r.severity as Severity,
          message: msg,
          location: { file: r.file, line: 1 },
          suggestion: r.recommendations[0],
        })),
        metrics: {
          tokenCost: r.tokenCost,
          complexityScore: r.importDepth,
        },
      })
    );

    return SpokeOutputSchema.parse({
      results: normalizedResults,
      summary: {
        ...summary,
      },
      metadata: {
        toolName: ToolName.ContextAnalyzer,
        version: '0.17.5',
        timestamp: new Date().toISOString(),
      },
    });
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    const summary = output.summary as unknown as ContextSummary;
    return calculateContextScore(summary, options.costConfig);
  },

  defaultWeight: 19,
};
