import { describe, it, expect, vi } from 'vitest';
import { UnifiedOrchestrator } from '../orchestrator';

describe('UnifiedOrchestrator branch coverage', () => {
  it('merges tool config when options.tools is an object', async () => {
    const provider = {
      id: 'pattern-detect',
      analyze: vi.fn(async (options: any) => {
        return {
          summary: { totalFiles: 3, config: options },
          results: [{ issues: [{}, {}] }],
          metadata: {},
        } as any;
      }),
    } as any;

    const registry = { find: vi.fn(() => provider) } as any;

    const orchestrator = new UnifiedOrchestrator(registry);

    const options = {
      rootDir: '.',
      tools: ['pattern-detect'],
      toolConfigs: { 'pattern-detect': { customOpt: 1 } },
    } as any;

    const result = await orchestrator.analyze(options);
    expect(registry.find).toHaveBeenCalled();
    expect(result.summary.toolsRun).toContain('pattern-detect');
    expect(result['pattern-detect']).toBeDefined();
    expect(result.summary.totalFiles).toBe(3);
  });

  it('warns and continues when provider missing', async () => {
    const registry = { find: vi.fn(() => undefined) } as any;
    const orchestrator = new UnifiedOrchestrator(registry);

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const options = { tools: ['non-existent'], rootDir: '.' } as any;

    const result = await orchestrator.analyze(options);

    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
