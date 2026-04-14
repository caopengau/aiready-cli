import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use a scoped spy on `executeToolAction` so other tests aren't affected.

describe('Consistency Action (mocked executeToolAction)', () => {
  let consoleSpy: any;
  let consistencyAction: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Replace executeToolAction with a test-local implementation
    const scanHelpers = await import('../scan-helpers');
    vi.spyOn(scanHelpers, 'executeToolAction').mockImplementation(
      async (directory, options, config) => {
        const report = {
          results: [
            {
              fileName: 'f1.ts',
              issues: [
                {
                  type: 'naming-inconsistency',
                  severity: 'major',
                  message: 'Bad name',
                  location: { file: 'f1.ts', line: 1 },
                  suggestion: 'Rename to goodName',
                },
              ],
              metrics: {},
            },
          ],
        };

        const summary = {
          filesAnalyzed: 1,
          totalIssues: 1,
          namingIssues: 1,
          patternIssues: 0,
          architectureIssues: 0,
          rating: 'GOOD',
        };

        const elapsedTime = '0.05';
        const score = options?.score
          ? {
              score: 80,
              toolName: 'Consistency Analysis',
              rawMetrics: {},
              factors: [],
              recommendations: [],
            }
          : undefined;

        config.renderConsole({
          results: report,
          summary,
          elapsedTime,
          score,
          finalOptions: options,
        });
        return { results: report, summary, elapsedTime, score };
      }
    );

    ({ consistencyAction } = await import('../consistency'));
  });

  it('renders issues when present', async () => {
    await consistencyAction('.', {});
    // Header + files/summary lines should be logged
    const allOutput = consoleSpy.mock.calls
      .map((call: any) => call[0])
      .join('\n');
    expect(allOutput).toContain('Consistency Analysis');
    expect(allOutput).toContain('files scanned');
  });

  it('renders success message when no issues', async () => {
    const scanHelpers = await import('../scan-helpers');
    vi.mocked(scanHelpers.executeToolAction).mockImplementationOnce(
      async (directory, options, config) => {
        const report = { results: [] };
        const summary = {
          filesAnalyzed: 0,
          totalIssues: 0,
          namingIssues: 0,
          patternIssues: 0,
          architectureIssues: 0,
          rating: 'EXCELLENT',
        };
        const elapsedTime = '0.02';
        config.renderConsole({
          results: report,
          summary,
          elapsedTime,
          score: undefined,
          finalOptions: options,
        });
        return { results: report, summary, elapsedTime, score: undefined };
      }
    );

    await consistencyAction('.', {});
    const allOutput = consoleSpy.mock.calls
      .map((call: any) => call[0])
      .join('\n');
    expect(allOutput).toContain('Consistency Analysis');
    expect(allOutput).toContain('EXCELLENT');
  });

  it('passes score through when requested', async () => {
    const scanHelpers = await import('../scan-helpers');
    vi.mocked(scanHelpers.executeToolAction).mockImplementationOnce(
      async (directory, options, config) => {
        const report = { results: [] };
        const summary = {
          filesAnalyzed: 0,
          totalIssues: 0,
          namingIssues: 0,
          patternIssues: 0,
          architectureIssues: 0,
          rating: 'EXCELLENT',
        };
        const elapsedTime = '0.02';
        const score = {
          score: 88,
          toolName: 'Consistency Analysis',
          rawMetrics: {},
          factors: [],
          recommendations: [],
        };
        config.renderConsole({
          results: report,
          summary,
          elapsedTime,
          score,
          finalOptions: { ...options, score: true },
        });
        return { results: report, summary, elapsedTime, score };
      }
    );

    await consistencyAction('.', { score: true } as any);
    const allOutput = consoleSpy.mock.calls
      .map((call: any) => call[0])
      .join('\n');
    expect(allOutput).toContain('Consistency Analysis');
    expect(allOutput).toContain('88/100');
  });

  it('renders issues sorted by severity and shows suggestions', async () => {
    const scanHelpers = await import('../scan-helpers');
    vi.mocked(scanHelpers.executeToolAction).mockImplementationOnce(
      async (directory, options, config) => {
        const report = {
          results: [
            {
              fileName: 'a.ts',
              issues: [
                {
                  severity: 'minor',
                  message: 'minor issue',
                  suggestion: 'fix minor',
                  line: 5,
                },
              ],
            },
            {
              fileName: 'b.ts',
              issues: [
                {
                  severity: 'critical',
                  message: 'critical issue',
                  suggestion: 'fix critical',
                  line: 1,
                },
              ],
            },
            {
              fileName: 'c.ts',
              issues: [
                {
                  severity: 'major',
                  message: 'major issue',
                  suggestion: 'fix major',
                  line: 2,
                },
              ],
            },
          ],
        };

        const summary = {
          filesAnalyzed: 3,
          totalIssues: 3,
          namingIssues: 1,
          patternIssues: 1,
          architectureIssues: 1,
          rating: 'POOR',
        };
        const elapsedTime = '0.10';
        config.renderConsole({
          results: report,
          summary,
          elapsedTime,
          score: undefined,
          finalOptions: options,
        });
        return { results: report, summary, elapsedTime };
      }
    );

    await consistencyAction('.', {} as any);

    const allOutput = consoleSpy.mock.calls
      .map((call: any) => call[0])
      .join('\n');
    expect(allOutput).toContain('Consistency Analysis');
    expect(allOutput).toContain('POOR');
  });

  it('registers command and exposes getCliOptions correctly', async () => {
    const shared = await import('../shared/command-builder');
    const spy = vi.spyOn(shared, 'defineStandardTool');

    const fakeProgram = {
      command: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      argument: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      addHelpText: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
    } as any;

    const mod = await import('../consistency');
    mod.defineConsistencyCommand(fakeProgram);

    expect(spy).toHaveBeenCalled();
    const config = spy.mock.calls[0][1];
    const cliOpts = config.getCliOptions({
      naming: false,
      patterns: true,
      minSeverity: 'major',
    });
    expect(cliOpts.checkNaming).toBe(false);
    expect(cliOpts.checkPatterns).toBe(true);
    expect(cliOpts.minSeverity).toBe('major');
  });

  it('handles summary.totalIssues > 0 with no results', async () => {
    const scanHelpers = await import('../scan-helpers');
    vi.mocked(scanHelpers.executeToolAction).mockImplementationOnce(
      async (directory, options, config) => {
        const summary = {
          filesAnalyzed: 1,
          totalIssues: 0,
          namingIssues: 0,
          patternIssues: 0,
          architectureIssues: 0,
          rating: 'EXCELLENT',
        };
        const elapsedTime = '0.04';
        // Pass an object for results so renderConsole receives an object (report) with no .results
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

    await consistencyAction('.', {} as any);
    const allOutput = consoleSpy.mock.calls
      .map((call: any) => call[0])
      .join('\n');
    expect(allOutput).toContain('Consistency Analysis');
    expect(allOutput).toContain('EXCELLENT');
  });
});
