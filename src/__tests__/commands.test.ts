import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patternsAction } from '../commands/patterns';
import { consistencyAction } from '../commands/consistency';
import { contextAction } from '../commands/context';
import { testabilityAction } from '../commands/testability';
import { agentGroundingAction } from '../commands/agent-grounding';
import { bugAction } from '../commands/bug';
import { remediateAction } from '../commands/remediate';
import { visualizeAction } from '../commands/visualize';
import { uploadAction } from '../commands/upload';
import { executeToolAction } from '../commands/scan-helpers';
import * as fs from 'fs';
import * as core from '@aiready/core';

vi.mock('../commands/scan-helpers', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../commands/scan-helpers')>();
  return {
    ...actual,
    executeToolAction: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const m = {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    copyFileSync: vi.fn(),
  };
  return {
    ...m,
    default: m,
  };
});

vi.mock('@aiready/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...actual,
    findLatestReport: vi.fn(),
    generateHTML: vi.fn(),
    ensureDir: vi.fn(),
    printTerminalHeader: vi.fn(),
    getSeverityColor: vi.fn().mockReturnValue((s: any) => s),
    getSafetyIcon: vi.fn().mockReturnValue(''),
    getScoreBar: vi.fn().mockReturnValue(''),
    handleCLIError: vi.fn(),
  };
});

// Mock global fetch
global.fetch = vi.fn() as any;

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(core.findLatestReport).mockReturnValue('report.json');
    vi.mocked(core.generateHTML).mockReturnValue('<html></html>');

    // Make printTerminalHeader log to console so we can spy on it
    vi.mocked(core.printTerminalHeader).mockImplementation((text) =>
      console.log(text)
    );
  });

  describe('patterns command', () => {
    it('should call executeToolAction with correct parameters', async () => {
      const options = { similarity: '0.5', minLines: '10' };
      await patternsAction('.', options as any);

      expect(executeToolAction).toHaveBeenCalledWith(
        '.',
        options,
        expect.objectContaining({
          toolName: 'pattern-detect',
          label: 'Pattern analysis',
        })
      );
    });

    it('should pass correct defaults and getCliOptions', async () => {
      const options = { similarity: '0.8' };
      await patternsAction('src', options as any);

      const call = vi.mocked(executeToolAction).mock.calls[0];
      const config = call[2];

      const cliOptions = config.getCliOptions(options);
      expect(cliOptions.minSimilarity).toBe(0.8);
    });
  });

  describe('consistency command', () => {
    it('should call executeToolAction for consistency', async () => {
      const options = { naming: true, patterns: false };
      await consistencyAction('src', options as any);

      expect(executeToolAction).toHaveBeenCalledWith(
        'src',
        options,
        expect.objectContaining({
          toolName: 'naming-consistency',
          label: 'Consistency analysis',
        })
      );
    });
  });

  describe('context command', () => {
    it('should call executeToolAction for context', async () => {
      const options = { threshold: '1000' };
      await contextAction('src', options as any);

      expect(executeToolAction).toHaveBeenCalledWith(
        'src',
        options,
        expect.objectContaining({
          toolName: 'context-analyzer',
          label: 'Context analysis',
        })
      );
    });
  });

  describe('testability command', () => {
    it('should call executeToolAction for testability', async () => {
      const options = { ci: true };
      await testabilityAction('src', options as any);

      expect(executeToolAction).toHaveBeenCalledWith(
        'src',
        options,
        expect.objectContaining({
          toolName: 'testability-index',
          label: 'Testability analysis',
        })
      );
    });
  });

  describe('agent-grounding command', () => {
    it('should call executeToolAction for agent-grounding', async () => {
      await agentGroundingAction('src', {} as any);

      expect(executeToolAction).toHaveBeenCalledWith(
        'src',
        {},
        expect.objectContaining({
          toolName: 'agent-grounding',
          label: 'Agent grounding',
        })
      );
    });
  });

  describe('bug command', () => {
    it('should log feedback links when no message is provided', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      await bugAction(undefined, {});
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feedback & Bug Reports')
      );
      consoleLogSpy.mockRestore();
    });

    it('should prepare a report when message is provided with different types', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      await bugAction('Test bug', { type: 'bug' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BUG]')
      );

      await bugAction('Test feature', { type: 'feature' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FEATURE]')
      );

      await bugAction('Test metric', { type: 'metric' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[METRIC]')
      );

      consoleLogSpy.mockRestore();
    });

    it('should attempt to submit via gh CLI when --submit is passed', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await bugAction('Test submit', { submit: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Submitting issue via GitHub CLI')
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('remediate command', () => {
    it('should log remediation options', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      await remediateAction('.', { report: 'r.json' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('AIREADY REMEDIATION SWARM')
      );
      consoleLogSpy.mockRestore();
    });

    it('should handle specific tool remediation', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      await remediateAction('.', { tool: 'patterns', report: 'r.json' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pattern Consolidation')
      );
      consoleLogSpy.mockRestore();
    });
  });

  describe('visualize command', () => {
    it('should generate visualization HTML', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ results: [], summary: {} })
      );

      await visualizeAction('.', { report: 'r.json' });

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Visualization written to')
      );
      consoleLogSpy.mockRestore();
    });

    it('should handle missing report', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(core.findLatestReport).mockReturnValue(null);

      await visualizeAction('.', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No AI readiness report found')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('upload command', () => {
    it('should upload report to server', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ repository: { repoId: '123' } })
      );

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ analysis: { id: 'a1', aiScore: 88 } }),
      } as any);

      await uploadAction('r.json', { apiKey: 'k1' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analysis/upload'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Upload successful')
      );
      consoleLogSpy.mockRestore();
    });

    it('should require API key', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const processExitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('exit');
        });

      await expect(uploadAction('r.json', {})).rejects.toThrow('exit');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Key is required')
      );
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});
