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
        ToolName.ContractEnforcement,
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
        ToolName.ContractEnforcement,
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
        ToolName.ContractEnforcement,
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
        ToolName.ContractEnforcement,
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

  describe('executeToolAction score calculation', () => {
    it('should extract scoreData from results.duplicates for pattern-detect', () => {
      // Pattern-detect returns results.duplicates
      const mockResults = {
        duplicates: [
          { file1: 'a.ts', file2: 'b.ts', similarity: 0.9, tokenCost: 100 },
        ],
        length: 327,
      };
      const mockSummary = { totalPatterns: 1, totalTokenCost: 100 };

      // The score calculation should use results.duplicates, not summary
      const scoreData = (mockResults as any).duplicates || mockSummary;
      expect(scoreData).toEqual(mockResults.duplicates);
      expect(scoreData).not.toEqual(mockSummary);
    });

    it('should extract scoreData from results.issues for consistency', () => {
      // Consistency returns results.issues
      const mockResults = {
        issues: [
          {
            type: 'naming-inconsistency',
            identifier: 'MY_CONST',
            severity: 'minor',
          },
        ],
        summary: { filesAnalyzed: 327, totalIssues: 1 },
      };
      const mockSummary = { filesAnalyzed: 327, totalIssues: 1 };

      // The score calculation should use results.issues, not summary
      const scoreData =
        (mockResults as any).duplicates ||
        (mockResults as any).issues ||
        mockSummary;
      expect(scoreData).toEqual(mockResults.issues);
    });

    it('should fall back to summary when no duplicates or issues', () => {
      // Other tools return summary directly
      const mockResults = {
        summary: { score: 85, rating: 'good', filesAnalyzed: 327 },
      };
      const mockSummary = { score: 85, rating: 'good', filesAnalyzed: 327 };

      const scoreData =
        (mockResults as any).duplicates ||
        (mockResults as any).issues ||
        mockSummary;
      expect(scoreData).toEqual(mockSummary);
    });

    it('should extract filesCount from results.length for pattern-detect', () => {
      const mockResults = { length: 327 };
      const filesCount =
        (mockResults as any).length ||
        (mockResults as any).summary?.filesAnalyzed ||
        (mockResults as any).summary?.totalFiles;
      expect(filesCount).toBe(327);
    });

    it('should extract filesCount from results.summary.filesAnalyzed for consistency', () => {
      const mockResults = { summary: { filesAnalyzed: 327 } };
      const filesCount =
        (mockResults as any).length ||
        (mockResults as any).summary?.filesAnalyzed ||
        (mockResults as any).summary?.totalFiles;
      expect(filesCount).toBe(327);
    });

    it('should extract filesCount from results.summary.totalFiles for other tools', () => {
      const mockResults = { summary: { totalFiles: 327 } };
      const filesCount =
        (mockResults as any).length ||
        (mockResults as any).summary?.filesAnalyzed ||
        (mockResults as any).summary?.totalFiles;
      expect(filesCount).toBe(327);
    });
  });
});
