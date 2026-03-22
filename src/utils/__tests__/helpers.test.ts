import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReportTimestamp,
  truncateArray,
  generateMarkdownReport,
  buildToolScoringOutput,
  loadMergedToolConfig,
  buildCommonScanOptions,
  runConfiguredToolCommand,
  warnIfGraphCapExceeded,
} from '../helpers';

vi.mock('@aiready/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({ tool: 'value' }),
  mergeConfigWithDefaults: vi.fn().mockImplementation((config, defaults) => ({
    ...defaults,
    ...config,
  })),
  getReportTimestamp: vi.fn().mockReturnValue('20260322-230000'),
  findLatestReport: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

describe('CLI Helpers', () => {
  it('should generate a valid timestamp', () => {
    const ts = getReportTimestamp();
    expect(ts).toBe('20260322-230000');
  });

  it('should truncate arrays correctly', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(truncateArray(arr, 3)).toContain('+2 more');
    expect(truncateArray(arr, 10)).toBe('1, 2, 3, 4, 5');
  });

  it('should handle undefined array in truncateArray', () => {
    expect(truncateArray(undefined)).toBe('');
  });

  it('should generate markdown report', () => {
    const report = {
      summary: {
        filesAnalyzed: 10,
        totalIssues: 5,
        namingIssues: 2,
        patternIssues: 3,
      },
      recommendations: ['Fix naming'],
    };
    const md = generateMarkdownReport(report, '1.5');
    expect(md).toContain('# Consistency Analysis Report');
    expect(md).toContain('**Files Analyzed:** 10');
    expect(md).toContain('Fix naming');
  });

  it('should handle empty recommendations in markdown report', () => {
    const report = {
      summary: {
        filesAnalyzed: 10,
        totalIssues: 5,
        namingIssues: 2,
        patternIssues: 3,
      },
      recommendations: [],
    };
    const md = generateMarkdownReport(report, '1.5');
    expect(md).not.toContain('## Recommendations');
  });
});

describe('buildToolScoringOutput', () => {
  it('should build tool scoring output with score and recommendations', () => {
    const report = {
      summary: { score: 85 },
      rawData: { metric1: 100 },
      recommendations: ['Fix this', 'Improve that'],
    };
    const result = buildToolScoringOutput('test-tool', report);

    expect(result.toolName).toBe('test-tool');
    expect(result.score).toBe(85);
    expect(result.rawMetrics).toEqual({ metric1: 100 });
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0]).toHaveProperty('action', 'Fix this');
    expect(result.recommendations[0]).toHaveProperty('estimatedImpact', 5);
  });

  it('should handle missing optional fields', () => {
    const report = {
      summary: { score: 50 },
    };
    const result = buildToolScoringOutput('test-tool', report);

    expect(result.toolName).toBe('test-tool');
    expect(result.score).toBe(50);
    expect(result.rawMetrics).toEqual({});
    expect(result.recommendations).toHaveLength(0);
  });
});

describe('loadMergedToolConfig', () => {
  it('should load and merge tool config with defaults', async () => {
    const defaults = { maxDepth: 5, include: ['*.ts'] };
    const result = await loadMergedToolConfig('/test/dir', defaults);

    expect(result).toBeDefined();
    expect(result.maxDepth).toBe(5);
    expect(result.include).toEqual(['*.ts']);
  });
});

describe('buildCommonScanOptions', () => {
  it('should build common scan options from directory and options', () => {
    const directory = '/test/dir';
    const options = {
      include: '*.ts,*.js',
      exclude: 'node_modules',
    };
    const extras = { maxDepth: 5 };

    const result = buildCommonScanOptions(directory, options, extras);

    expect(result.rootDir).toBe('/test/dir');
    expect(result.include).toBe('*.ts,*.js');
    expect(result.exclude).toBe('node_modules');
    expect(result.maxDepth).toBe(5);
  });

  it('should build options without extras', () => {
    const result = buildCommonScanOptions('/test', {});

    expect(result.rootDir).toBe('/test');
    expect(result.include).toBeUndefined();
    expect(result.exclude).toBeUndefined();
  });
});

describe('runConfiguredToolCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run configured tool command and return report and scoring', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({ results: [] });
    const mockScore = vi.fn().mockReturnValue({ score: 80 });

    const result = await runConfiguredToolCommand({
      directory: '/test',
      options: {},
      defaults: { maxDepth: 5 },
      analyze: mockAnalyze,
      getExtras: () => ({}),
      score: mockScore,
    });

    expect(result.report).toEqual({ results: [] });
    expect(result.scoring).toEqual({ score: 80 });
    expect(mockAnalyze).toHaveBeenCalled();
    expect(mockScore).toHaveBeenCalled();
  });

  it('should pass extras from options to analyze', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({ results: [] });
    const mockScore = vi.fn().mockReturnValue({ score: 90 });

    await runConfiguredToolCommand({
      directory: '/test',
      options: { customOption: 'value' },
      defaults: { maxDepth: 5 },
      analyze: mockAnalyze,
      getExtras: (options) => ({ customOption: options.customOption }),
      score: mockScore,
    });

    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        customOption: 'value',
      })
    );
  });
});

describe('warnIfGraphCapExceeded', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should not warn when nodes and edges are within limits', async () => {
    const report = {
      context: [{ relatedFiles: [1, 2], dependencies: [1] }],
      patterns: [],
    };
    await warnIfGraphCapExceeded(report, '/test');
    // Should not print warning
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should warn when nodes exceed limit', async () => {
    const { existsSync, readFileSync } = await import('fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        visualizer: { graph: { maxNodes: 10, maxEdges: 100 } },
      })
    );

    const report = {
      context: Array(20).fill({ relatedFiles: [1], dependencies: [1] }),
      patterns: [],
    };
    await warnIfGraphCapExceeded(report, '/test');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Graph may be truncated')
    );
  });

  it('should warn when edges exceed limit', async () => {
    const { existsSync, readFileSync } = await import('fs');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        visualizer: { graph: { maxNodes: 400, maxEdges: 10 } },
      })
    );

    const report = {
      context: [
        {
          relatedFiles: Array(20).fill('file'),
          dependencies: Array(20).fill('dep'),
        },
      ],
      patterns: [],
    };
    await warnIfGraphCapExceeded(report, '/test');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Graph may be truncated')
    );
  });
});
