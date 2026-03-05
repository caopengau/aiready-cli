import { describe, it, expect, vi } from 'vitest';
import { analyzeConsistency } from '../index';
import { validateSpokeOutput } from '../../../core/src/types/contract';

// Mock core functions
vi.mock('@aiready/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...actual,
    scanFiles: vi.fn().mockResolvedValue(['file1.ts']),
    readFileContent: vi.fn().mockResolvedValue('export const My_Variable = 1;'), // Intentionally inconsistent
  };
});

describe('Consistency Spoke Contract Validation', () => {
  it('should produce output matching the SpokeOutput contract', async () => {
    const results = await analyzeConsistency({
      rootDir: './test',
    } as any);

    const fullOutput = {
      results: results.results,
      summary: results.summary,
    };

    const validation = validateSpokeOutput('consistency', fullOutput);

    if (!validation.valid) {
      console.error('Contract Validation Errors:', validation.errors);
    }

    expect(validation.valid).toBe(true);
  });
});
