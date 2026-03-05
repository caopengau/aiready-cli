import { describe, it, expect, vi } from 'vitest';
import { analyzeUnified } from '../index';

// Mock the individual tools
vi.mock('@aiready/pattern-detect', () => ({
  analyzePatterns: vi.fn().mockResolvedValue({
    results: [],
    duplicates: [],
    files: [],
  }),
  generateSummary: vi.fn().mockReturnValue({
    totalDuplicateLines: 0,
    potentialSavings: 0,
  }),
}));

vi.mock('@aiready/context-analyzer', () => ({
  analyzeContext: vi.fn().mockResolvedValue([]),
  generateSummary: vi.fn().mockReturnValue({
    totalFiles: 0,
    averageCohesion: 0,
    averageFragmentation: 0,
  }),
}));

describe('CLI Unified Analysis', () => {
  it('should run unified analysis with both tools', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: ['patterns', 'context'],
    });

    expect(results).toHaveProperty('patternDetect');
    expect(results).toHaveProperty('contextAnalyzer');
    expect(results).toHaveProperty('summary');
  });

  it('should run analysis with only patterns tool', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: ['patterns'],
    });

    expect(results).toHaveProperty('patternDetect');
    expect(results).not.toHaveProperty('contextAnalyzer');
    expect(results).toHaveProperty('summary');
  });

  it('should run analysis with only context tool', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: ['context'],
    });

    expect(results).not.toHaveProperty('patternDetect');
    expect(results).toHaveProperty('contextAnalyzer');
    expect(results).toHaveProperty('summary');
  });
});
