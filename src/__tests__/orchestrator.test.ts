import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock initializeParsers to avoid heavy startup work while preserving other exports
vi.mock('@aiready/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...actual,
    initializeParsers: vi.fn().mockResolvedValue(undefined),
  } as any;
});

import { UnifiedOrchestrator } from '../orchestrator';

describe('UnifiedOrchestrator', () => {
  let fakeRegistry: any;

  beforeEach(() => {
    vi.clearAllMocks();

    fakeRegistry = {
      find: (name: string) => {
        if (name === 'patterns')
          return {
            id: 'pattern-detect',
            analyze: async (_opts: any) => ({
              results: [{ issues: [1] }],
              summary: { totalFiles: 5 },
              metadata: { config: { sample: true } },
            }),
          };
        if (name === 'context')
          return {
            id: 'context-analyzer',
            analyze: async () => ({
              results: [],
              summary: { totalFiles: 2 },
            }),
          };
        if (name === 'consistency')
          return {
            id: 'naming-consistency',
            analyze: async () => ({
              results: [],
              summary: { totalFiles: 1 },
            }),
          };
        return undefined;
      },
    };
  });

  it('analyzes multiple tools, aggregates results, and applies legacy keys', async () => {
    const progressSpy = vi.fn();
    const orchestrator = new UnifiedOrchestrator(fakeRegistry);

    const result = await orchestrator.analyze({
      rootDir: 'src',
      maxDepth: 3,
      minSimilarity: 0.5,
      progressCallback: progressSpy,
    } as any);

    expect(result.summary.toolsRun).toEqual(
      expect.arrayContaining([
        'pattern-detect',
        'context-analyzer',
        'naming-consistency',
      ])
    );
    expect(result.summary.totalFiles).toBe(5);
    expect(result.patternDetect || result['pattern-detect']).toBeDefined();
    expect(progressSpy).toHaveBeenCalled();
  });

  it('sanitizeConfig removes infra keys and recurses', () => {
    const orchestrator = new UnifiedOrchestrator(fakeRegistry);
    const input = {
      rootDir: '/tmp',
      include: 'src',
      nested: {
        useSmartDefaults: true,
        keep: 'yes',
      },
      arr: [1, 2, 3],
    } as any;

    const cleaned = orchestrator.sanitizeConfig(input);
    expect(cleaned.rootDir).toBeUndefined();
    // `include` is not considered an infra key in sanitizeConfig, so it should be preserved
    expect(cleaned.include).toBe('src');
    expect(cleaned.nested.keep).toBe('yes');
    expect(Array.isArray(cleaned.arr)).toBe(true);
  });

  it('sanitizeConfig returns non-objects unchanged', () => {
    const orchestrator = new UnifiedOrchestrator(fakeRegistry);
    expect(orchestrator.sanitizeConfig(undefined as any)).toBeUndefined();
    expect(orchestrator.sanitizeConfig([1, 2, 3] as any)).toEqual([1, 2, 3]);
    expect(orchestrator.sanitizeConfig('string' as any)).toBe('string');
  });

  it('applies toolConfigs when provided for a provider', async () => {
    const orchestrator = new UnifiedOrchestrator(fakeRegistry);
    const res = await orchestrator.analyze({
      rootDir: 'src',
      toolConfigs: { 'pattern-detect': { custom: true } },
    } as any);

    expect(res.summary.toolConfigs!['pattern-detect']).toBeDefined();
    expect(res.summary.toolConfigs!['pattern-detect'].custom).toBe(true);
  });

  it('logs error when provider analyze throws', async () => {
    const badRegistry = {
      find: (name: string) => {
        if (name === 'bad')
          return {
            id: 'bad',
            analyze: async () => {
              throw new Error('boom');
            },
          };
        return undefined;
      },
    } as any;

    const orchestrator = new UnifiedOrchestrator(badRegistry);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await orchestrator.analyze({ tools: ['bad'] } as any);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
