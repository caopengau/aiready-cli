import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeDocDrift } from './analyzer';
import { DocDriftOptions, DocDriftIssue } from './types';

/**
 * Documentation Drift Tool Provider
 */
export const DocDriftProvider: ToolProvider = {
  id: ToolName.DocDrift,
  alias: ['doc-drift', 'docs', 'jsdoc'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeDocDrift(options as DocDriftOptions);

    // Group issues by file for AnalysisResult format
    const fileIssuesMap = new Map<string, DocDriftIssue[]>();
    for (const issue of report.issues) {
      const file = issue.location.file;
      if (!fileIssuesMap.has(file)) fileIssuesMap.set(file, []);
      fileIssuesMap.get(file)!.push(issue);
    }

    const results: AnalysisResult[] = Array.from(fileIssuesMap.entries()).map(
      ([fileName, issues]) => ({
        fileName,
        issues: issues as any[],
        metrics: {},
      })
    );

    return SpokeOutputSchema.parse({
      results,
      summary: report.summary,
      metadata: {
        toolName: ToolName.DocDrift,
        version: '0.9.5',
        timestamp: new Date().toISOString(),
        rawData: report.rawData,
      },
    });
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    const summary = output.summary as any;
    const rawData = (output.metadata as any)?.rawData || {};

    return {
      toolName: ToolName.DocDrift,
      score: summary.score || 0,
      rawMetrics: {
        ...summary,
        ...rawData,
      },
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
