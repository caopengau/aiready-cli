import { describe, it, expect, vi } from 'vitest';
import { analyzePatterns, generateSummary } from '../index';
import { validateSpokeOutput, SpokeOutputSchema } from '@aiready/core';

// Mock core functions to avoid actual FS access
vi.mock('@aiready/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...actual,
    scanFiles: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
    readFileContent: vi.fn().mockImplementation((file) => {
      if (file === 'file1.ts') return 'function test() { return 1; }';
      if (file === 'file2.ts') return 'function test() { return 1; }';
      return '';
    }),
  };
});

describe('Pattern Detect Contract Validation', () => {
  it('should produce output matching the SpokeOutput contract', async () => {
    const output = await analyzePatterns({
      rootDir: './test',
      minSimilarity: 0.5,
      suppressToolConfig: true,
    } as any);

    const summary = generateSummary(output.results);

    const fullOutput = {
      results: output.results,
      summary,
      metadata: {
        toolName: 'pattern-detect',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      },
    };

    // 1. Legacy validation
    const validation = validateSpokeOutput('pattern-detect', fullOutput);

    if (!validation.valid) {
      console.error('Contract Validation Errors (Legacy):', validation.errors);
    }

    expect(validation.valid).toBe(true);

    // 2. Zod validation (Round 1 improvement)
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
