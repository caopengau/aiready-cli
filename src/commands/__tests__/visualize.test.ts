import { describe, it, expect, vi, beforeEach } from 'vitest';
import { visualizeAction } from '../visualize';
import * as fs from 'fs';
import * as core from '@aiready/core';
import { spawn } from 'child_process';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({ on: vi.fn(), kill: vi.fn() }),
}));

vi.mock('@aiready/visualizer', () => ({
  GraphBuilder: {
    buildFromReport: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  },
}));

vi.mock('@aiready/core', () => ({
  handleCLIError: vi.fn(),
  generateHTML: vi.fn().mockReturnValue('<html></html>'),
  findLatestReport: vi.fn(),
  ensureDir: vi.fn(),
}));

describe('Visualize CLI Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );
  });

  it('should generate HTML from specified report', async () => {
    await visualizeAction('.', { report: 'report.json' });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('visualization.html'),
      '<html></html>',
      'utf8'
    );
  });

  it('should find latest report if none specified', async () => {
    vi.mocked(core.findLatestReport).mockReturnValue('latest.json');
    await visualizeAction('.', {});
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('latest.json'),
      'utf8'
    );
  });

  it('should handle missing reports', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.mocked(core.findLatestReport).mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await visualizeAction('.', { report: 'missing.json' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No AI readiness report found')
    );
    consoleSpy.mockRestore();
  });

  it('should attempt to open visualization if requested', async () => {
    await visualizeAction('.', { report: 'report.json', open: true });
    expect(spawn).toHaveBeenCalled();
  });
});
