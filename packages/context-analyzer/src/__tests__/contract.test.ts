import { describe, it, expect, vi } from 'vitest';
import { analyzeContext, generateSummary } from '../index';
import {
  validateSpokeOutput,
  SpokeOutputSchema,
  Severity,
  IssueType,
} from '@aiready/core';

// Mock core functions
vi.mock('@aiready/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...actual,
    scanFiles: vi.fn().mockResolvedValue(['file1.ts']),
    readFileContent: vi
      .fn()
      .mockResolvedValue('import { a } from "./b"; export const x = 1;'),
  };
});

describe('Context Analyzer Contract Validation', () => {
  it('should produce output matching the SpokeOutput contract', async () => {
    const results = await analyzeContext({
      rootDir: './test',
    } as any);

    const summary = generateSummary(results);

    // Context analyzer results need mapping to meet the strict AnalysisResult contract
    // because it uses 'file' instead of 'fileName' and 'issues: string[]' instead of 'issues: Issue[]'
    const mappedResults = results.map((r) => ({
      fileName: r.file,
      issues: r.issues.map((msg) => ({
        type: IssueType.ContextFragmentation,
        severity: r.severity as Severity,
        message: msg,
        location: { file: r.file, line: 1 },
      })),
      metrics: {
        tokenCost: r.tokenCost,
        complexityScore: r.cohesionScore * 100,
      },
    }));

    const fullOutput = {
      results: mappedResults,
      summary,
      metadata: {
        toolName: 'context-analyzer',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      },
    };

    // 1. Legacy validation
    const validation = validateSpokeOutput('context-analyzer', fullOutput);

    if (!validation.valid) {
      console.error('Contract Validation Errors (Legacy):', validation.errors);
    }

    expect(validation.valid).toBe(true);

    // 2. Zod validation
    const zodResult = SpokeOutputSchema.safeParse(fullOutput);
    if (!zodResult.success) {
      console.error(
        'Contract Validation Errors (Zod):',
        zodResult.error.format()
      );
    }
    expect(zodResult.success).toBe(true);
  });
});
