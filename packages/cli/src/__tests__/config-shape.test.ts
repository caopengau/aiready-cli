import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyzeUnified } from '../index';
import { ToolRegistry, ToolName, SpokeOutputSchema } from '@aiready/core';

describe('CLI Configuration Shape', () => {
  beforeEach(() => {
    ToolRegistry.clear();

    // Register a mock provider that returns its input config in metadata
    ToolRegistry.register({
      id: ToolName.PatternDetect,
      alias: ['patterns'],
      analyze: async (options) =>
        SpokeOutputSchema.parse({
          results: [],
          summary: { config: options },
          metadata: {
            toolName: ToolName.PatternDetect,
            version: '1.0.0',
            config: options,
          },
        }),
      score: () => ({
        toolName: ToolName.PatternDetect,
        score: 80,
        factors: [],
        recommendations: [],
        rawMetrics: {},
      }),
      defaultWeight: 10,
    });
  });

  afterEach(() => {
    ToolRegistry.clear();
  });

  it('should generate a strictly portable AIReadyConfig in summary', async () => {
    const results = await analyzeUnified({
      rootDir: '/tmp/fake-repo',
      tools: [ToolName.PatternDetect],
      exclude: ['**/node_modules/**'],
      // Pass a tool-specific override
      toolConfigs: {
        [ToolName.PatternDetect]: {
          minSimilarity: 0.9,
          // This should be stripped
          rootDir: '/tmp/fake-repo',
        },
      },
    });

    const config = results.summary.config as Record<string, any>;

    // 1. Check top-level structure
    expect(config).toBeDefined();
    expect(config).toHaveProperty('scan');
    expect(config).toHaveProperty('tools');

    // 2. Ensure rootDir is STRIPPED from top level
    expect(config).not.toHaveProperty('rootDir');

    // 3. Ensure internal keys are stripped from scan section
    expect(config.scan).toHaveProperty('tools');
    expect(config.scan).toHaveProperty('exclude');
    expect(config.scan).not.toHaveProperty('rootDir');

    // 4. Ensure recursive stripping in tools section
    const patternConfig = config.tools[ToolName.PatternDetect] as Record<
      string,
      any
    >;
    expect(patternConfig).toHaveProperty('minSimilarity', 0.9);
    expect(patternConfig).not.toHaveProperty('rootDir');
    expect(patternConfig).not.toHaveProperty('onProgress');
  });

  it('should strip internal keys like useSmartDefaults and batchSize', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: [ToolName.PatternDetect],
      useSmartDefaults: true,
      batchSize: 50,
    });

    const config = results.summary.config as Record<string, any>;

    expect(config).not.toHaveProperty('useSmartDefaults');
    expect(config.scan).not.toHaveProperty('useSmartDefaults');

    // Check tool level too
    const patternConfig = config.tools[ToolName.PatternDetect] as Record<
      string,
      any
    >;
    expect(patternConfig).not.toHaveProperty('useSmartDefaults');
    expect(patternConfig).not.toHaveProperty('batchSize');
  });

  it('should produce a config that is compatible with tool specific collection', async () => {
    // This test ensures that the toolConfigs collected from individual tools
    // are also sanitized before being merged into the final report.
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: [ToolName.PatternDetect],
    });

    const toolConfigs = results.summary.toolConfigs;
    expect(toolConfigs).toBeDefined();
    expect(toolConfigs![ToolName.PatternDetect]).not.toHaveProperty('rootDir');
  });
});
