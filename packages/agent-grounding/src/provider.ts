import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput,
  AnalysisResult,
  SpokeOutputSchema,
} from '@aiready/core';
import { analyzeAgentGrounding } from './analyzer';
import { calculateGroundingScore } from './scoring';
import { AgentGroundingOptions, AgentGroundingReport } from './types';

/**
 * Agent Grounding Tool Provider
 */
export const AgentGroundingProvider: ToolProvider = {
  id: ToolName.AgentGrounding,
  alias: ['agent-grounding', 'grounding', 'navigation'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const report = await analyzeAgentGrounding(
      options as AgentGroundingOptions
    );

    const results: AnalysisResult[] = report.issues.map((i) => ({
      fileName: i.location.file,
      issues: [i] as any[],
      metrics: {
        agentGroundingScore: report.summary.score,
      },
    }));

    return SpokeOutputSchema.parse({
      results,
      summary: report.summary,
      metadata: {
        toolName: ToolName.AgentGrounding,
        version: '0.9.5',
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
    } as unknown as AgentGroundingReport;

    return calculateGroundingScore(report);
  },

  defaultWeight: 10,
};
