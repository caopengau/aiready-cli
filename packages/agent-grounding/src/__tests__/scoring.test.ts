import { describe, it, expect } from 'vitest';
import { calculateGroundingScore } from '../scoring';
import { AgentGroundingReport } from '../types';
import { ToolName } from '@aiready/core';

describe('Agent Grounding Scoring', () => {
  const mockReport: AgentGroundingReport = {
    summary: {
      score: 65,
      rating: 'moderate',
      dimensions: {
        structureClarityScore: 60,
        selfDocumentationScore: 70,
        entryPointScore: 80,
        apiClarityScore: 50,
        domainConsistencyScore: 65,
      },
    },
    results: [],
    rawData: {
      totalFiles: 20,
      totalDirectories: 5,
      deepDirectories: 2,
      vagueFileNames: 3,
      hasRootReadme: true,
      readmeIsFresh: true,
      totalExports: 50,
      untypedExports: 10,
      inconsistentDomainTerms: 5,
    },
    recommendations: ['Fix vague filenames'],
  };

  it('should map report to ToolScoringOutput correctly', () => {
    const scoring = calculateGroundingScore(mockReport);

    expect(scoring.toolName).toBe(ToolName.AgentGrounding);
    expect(scoring.score).toBe(65);
    expect(scoring.factors.length).toBe(5);

    const apiClarityFactor = scoring.factors.find(
      (f) => f.name === 'API Clarity'
    );
    expect(apiClarityFactor?.impact).toBe(0); // 50 - 50
    expect(apiClarityFactor?.description).toContain(
      '10 of 50 exports lack type annotations'
    );
  });

  it('should set high priority for low scores', () => {
    const lowScoreReport: AgentGroundingReport = {
      ...mockReport,
      summary: {
        ...mockReport.summary,
        score: 40,
      },
    };

    const scoring = calculateGroundingScore(lowScoreReport);
    expect(scoring.recommendations[0].priority).toBe('high');
  });
});
