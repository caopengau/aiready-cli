import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeDeps } from './analyzer';
import { DepsOptions, DepsIssue } from './types';

/**
 * Dependency Health Tool Provider
 */
export const DepsProvider: ToolProvider = {
  id: ToolName.DependencyHealth,
  alias: ['deps', 'deps-health', 'packages'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeDeps(options as DepsOptions);

    // Group issues by file for AnalysisResult format
    const fileIssuesMap = new Map<string, DepsIssue[]>();
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
        toolName: ToolName.DependencyHealth,
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
      toolName: ToolName.DependencyHealth,
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

  defaultWeight: 6,
};
