import { describe, it, expect, vi } from 'vitest';
import { PatternDetectProvider } from '../provider';
import * as main from '../index';

vi.mock('../index', async () => {
  const actual = await vi.importActual('../index');
  return {
    ...actual,
    analyzePatterns: vi.fn(),
  };
});

describe('Pattern Detect Provider', () => {
  it('should analyze and return SpokeOutput', async () => {
    vi.mocked(main.analyzePatterns).mockResolvedValue({
      results: [],
      duplicates: [],
      files: ['f1.ts'],
      config: { rootDir: '.' },
    } as any);

    const output = await PatternDetectProvider.analyze({ rootDir: '.' });

    expect(output.summary.totalFiles).toBe(1);
    expect(output.metadata.toolName).toBe('pattern-detect');
  });

  it('should score an output', () => {
    const mockOutput = {
      summary: { totalFiles: 10, duplicates: [] } as any,
      results: [],
    };

    const scoring = PatternDetectProvider.score(mockOutput as any, {
      rootDir: '.',
    });
    expect(scoring.score).toBeDefined();
  });
});
