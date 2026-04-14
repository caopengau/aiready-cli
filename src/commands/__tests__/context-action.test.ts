import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({ on: vi.fn(), kill: vi.fn() }),
    execFile: vi.fn(),
  };
});

describe('Context Action (mocked executeToolAction)', () => {
  let consoleSpy: any;
  let contextAction: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const scanHelpers = await import('../scan-helpers');
    vi.spyOn(scanHelpers, 'executeToolAction').mockImplementation(
      async (directory, options, config) => {
        const summary = {
          totalFiles: 3,
          totalTokens: 123456,
          avgContextBudget: 41152.0,
          rating: 'MODERATE',
          fragmentedModules: [
            { domain: 'modA', fragmentationScore: 0.8 },
            { domain: 'modB', fragmentationScore: 0.5 },
            { domain: 'modC', fragmentationScore: 0.2 },
          ],
          topExpensiveFiles: [
            {
              severity: 'critical',
              file: '/path/one.js',
              contextBudget: 999999,
            },
            { severity: 'major', file: '/path/two.js', contextBudget: 5000 },
            { severity: 'minor', file: '/path/three.js', contextBudget: 123 },
          ],
        };
        const elapsedTime = '0.12';
        config.renderConsole({
          results: {},
          summary,
          elapsedTime,
          score: undefined,
          finalOptions: options,
        });
        return { results: {}, summary, elapsedTime };
      }
    );

    ({ contextAction } = await import('../context'));
  });

  it('renders fragmented modules and expensive files with colors/icons', async () => {
    await contextAction('.', {});
    const allOutput = consoleSpy.mock.calls
      .map((call: any) => call[0])
      .join('\n');
    expect(allOutput).toContain('Context Analysis');
    expect(allOutput).toContain('MODERATE');
  });
});
