import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyzeUnified } from '../index';
import { ToolRegistry, ToolName, SpokeOutputSchema } from '@aiready/core';

describe('CLI Unified Analysis', () => {
  beforeEach(() => {
    ToolRegistry.clear();

    // Register mock providers
    ToolRegistry.register({
      id: ToolName.PatternDetect,
      alias: ['patterns'],
      analyze: async () =>
        SpokeOutputSchema.parse({
          results: [],
          summary: {},
          metadata: { toolName: ToolName.PatternDetect, version: '1.0.0' },
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

    ToolRegistry.register({
      id: ToolName.ContextAnalyzer,
      alias: ['context'],
      analyze: async () =>
        SpokeOutputSchema.parse({
          results: [],
          summary: {},
          metadata: { toolName: ToolName.ContextAnalyzer, version: '1.0.0' },
        }),
      score: () => ({
        toolName: ToolName.ContextAnalyzer,
        score: 70,
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

  it('should run unified analysis with both tools', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: ['patterns', 'context'],
    });

    expect(results).toHaveProperty(ToolName.PatternDetect);
    expect(results).toHaveProperty(ToolName.ContextAnalyzer);
    expect(results).toHaveProperty('summary');
  });

  it('should run analysis with only patterns tool', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: ['patterns'],
    });

    expect(results).toHaveProperty(ToolName.PatternDetect);
    expect(results).not.toHaveProperty(ToolName.ContextAnalyzer);
    expect(results).toHaveProperty('summary');
  });

  it('should run analysis with only context tool', async () => {
    const results = await analyzeUnified({
      rootDir: '/test',
      tools: ['context'],
    });

    expect(results).not.toHaveProperty(ToolName.PatternDetect);
    expect(results).toHaveProperty(ToolName.ContextAnalyzer);
    expect(results).toHaveProperty('summary');
  });
});
