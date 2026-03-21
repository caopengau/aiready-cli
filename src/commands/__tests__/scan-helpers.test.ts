import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProfileTools,
  getDefaultTools,
  createProgressCallback,
} from '../scan-helpers';
import { ToolName } from '@aiready/core';

describe('scan-helpers', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  describe('getProfileTools', () => {
    it('should return tools for agentic profile', () => {
      const result = getProfileTools('agentic');
      expect(result).toEqual([
        ToolName.AiSignalClarity,
        ToolName.AgentGrounding,
        ToolName.TestabilityIndex,
      ]);
    });

    it('should return tools for cost profile', () => {
      const result = getProfileTools('cost');
      expect(result).toEqual([
        ToolName.PatternDetect,
        ToolName.ContextAnalyzer,
      ]);
    });

    it('should return tools for logic profile', () => {
      const result = getProfileTools('logic');
      expect(result).toEqual([
        ToolName.TestabilityIndex,
        ToolName.NamingConsistency,
        ToolName.ContextAnalyzer,
        ToolName.PatternDetect,
        ToolName.ChangeAmplification,
      ]);
    });

    it('should return tools for ui profile', () => {
      const result = getProfileTools('ui');
      expect(result).toEqual([
        ToolName.NamingConsistency,
        ToolName.ContextAnalyzer,
        ToolName.PatternDetect,
        ToolName.DocDrift,
        ToolName.AiSignalClarity,
      ]);
    });

    it('should return tools for security profile', () => {
      const result = getProfileTools('security');
      expect(result).toEqual([
        ToolName.NamingConsistency,
        ToolName.TestabilityIndex,
      ]);
    });

    it('should return tools for onboarding profile', () => {
      const result = getProfileTools('onboarding');
      expect(result).toEqual([
        ToolName.ContextAnalyzer,
        ToolName.NamingConsistency,
        ToolName.AgentGrounding,
      ]);
    });

    it('should handle case-insensitive profile names', () => {
      const result = getProfileTools('AGENTIC');
      expect(result).toEqual([
        ToolName.AiSignalClarity,
        ToolName.AgentGrounding,
        ToolName.TestabilityIndex,
      ]);
    });

    it('should return undefined and warn for unknown profile', () => {
      const result = getProfileTools('unknown-profile');
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown profile 'unknown-profile'")
      );
    });
  });

  describe('getDefaultTools', () => {
    it('should return all default tools', () => {
      const result = getDefaultTools();
      expect(result).toContain('pattern-detect');
      expect(result).toContain('context-analyzer');
      expect(result).toContain('naming-consistency');
      expect(result).toContain('ai-signal-clarity');
      expect(result).toContain('agent-grounding');
      expect(result).toContain('testability-index');
      expect(result).toContain('doc-drift');
      expect(result).toContain('dependency-health');
      expect(result).toContain('change-amplification');
    });
  });

  describe('createProgressCallback', () => {
    it('should handle progress message event', () => {
      const callback = createProgressCallback();
      callback({ tool: 'test-tool', message: 'Processing file 1/10' });
      expect(process.stdout.write).toHaveBeenCalled();
    });

    it('should handle tool completion event with summary', () => {
      const callback = createProgressCallback();
      callback({
        tool: 'test-tool',
        data: {
          summary: {
            totalIssues: 5,
            score: 85,
            totalFiles: 10,
          },
        },
      });
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Issues found: 5')
      );
    });

    it('should handle tool completion event with partial summary', () => {
      const callback = createProgressCallback();
      callback({
        tool: 'test-tool',
        data: {
          summary: {
            score: 75,
          },
        },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tool Score: 75/100')
      );
    });

    it('should handle tool completion event with totalFiles', () => {
      const callback = createProgressCallback();
      callback({
        tool: 'test-tool',
        data: {
          summary: {
            totalFiles: 25,
          },
        },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files analyzed: 25')
      );
    });
  });
});
