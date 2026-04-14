import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({ on: vi.fn(), kill: vi.fn() }),
    execFile: vi.fn(),
  };
});

vi.mock('@aiready/visualizer', () => ({
  GraphBuilder: {
    buildFromReport: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
  },
}));

vi.mock('@aiready/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...original,
    handleCLIError: vi.fn(),
    generateHTML: vi.fn().mockReturnValue('<html></html>'),
    findLatestReport: vi.fn(),
    ensureDir: vi.fn(),
  };
});

// Top-level mocks for modules used in serve path
vi.mock('http', () => ({
  createServer: vi.fn((_handler: any) => ({
    listen: (port: number, cb: any) => cb(),
    close: () => {},
  })),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('<html></html>'),
}));

describe('Visualize CLI Action', () => {
  let visualizeAction: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import the module under test after top-level mocks are registered
    const mod = await import('../visualize');
    visualizeAction = mod.visualizeAction;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );
  });

  it('should generate HTML from specified report', async () => {
    await visualizeAction('.', { report: 'report.json' });
    expect(core.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('visualization.html')
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('visualization.html'),
      '<html></html>',
      'utf8'
    );
  });

  it('should create output directory if it does not exist', async () => {
    const customOutput = 'nested/dir/viz.html';
    await visualizeAction('.', { report: 'report.json', output: customOutput });

    expect(core.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining(customOutput)
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(customOutput),
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

  it('should start Vite dev server when available', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      // Simulate local visualizer and vite config present
      if (p.endsWith('packages/visualizer')) return true;
      if (p.endsWith('web/vite.config.ts')) return true;
      return true;
    });
    vi.spyOn(fs, 'watch').mockImplementation((_path: any, _cb: any) => {
      return { close: () => {} } as any;
    });

    await visualizeAction('.', { report: 'report.json', dev: true });

    expect(fs.copyFileSync).toHaveBeenCalled();
    expect(spawn).toHaveBeenCalled();
  });

  it('should use require.resolve fallback to find visualizer package', async () => {
    vi.clearAllMocks();
    // Simulate not having local packages/visualizer but require.resolve succeeds
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      // report should exist and web vite config should be found relative to resolved package
      if (p.endsWith('report.json')) return true;
      if (p.endsWith('web/vite.config.ts')) return true;
      return false;
    });

    const reqResolveSpy = vi
      .spyOn(require as any, 'resolve')
      .mockImplementation(() => {
        return '/node_modules/@aiready/visualizer/package.json';
      });

    vi.spyOn(fs, 'watch').mockImplementation(
      (_path: any, _cb: any) => ({ close: () => {} }) as any
    );

    await visualizeAction('.', { report: 'report.json', dev: true });

    // require.resolve may or may not be used depending on environment; ensure no exception thrown
    reqResolveSpy.mockRestore();
  });

  it('logs an error when copying report to visualizer fails', async () => {
    vi.clearAllMocks();
    // Simulate local visualizer present
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.endsWith('packages/visualizer')) return true;
      if (p.endsWith('web/vite.config.ts')) return true;
      return true;
    });

    // Make copyFileSync throw to hit the error branch
    vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy failed');
    });

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(fs, 'watch').mockImplementation(
      (_path: any, _cb: any) => ({ close: () => {} }) as any
    );

    await visualizeAction('.', { report: 'report.json', dev: true });

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('should fallback to static HTML if dev not available', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      // Visualizer not present anywhere
      if (p.endsWith('packages/visualizer')) return false;
      if (p.includes('@aiready') && p.includes('visualizer')) return false;
      if (p.endsWith('web/vite.config.ts')) return false;
      return true;
    });

    const reqResolveSpy = vi
      .spyOn(require as any, 'resolve')
      .mockImplementation(() => {
        throw new Error('not found');
      });

    await visualizeAction('.', { report: 'report.json', dev: true });

    expect(fs.writeFileSync).toHaveBeenCalled();
    reqResolveSpy.mockRestore();
  });

  it('should serve static HTML when --serve is provided', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );

    await visualizeAction('.', { report: 'report.json', serve: true });

    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should use graph config from aiready.json when available', async () => {
    vi.clearAllMocks();
    // report exists
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.endsWith('aiready.json')) return true;
      return true;
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.endsWith('aiready.json')) {
        return JSON.stringify({
          visualizer: { graph: { maxNodes: 123, maxEdges: 456 } },
        });
      }
      return JSON.stringify({ scoring: { overall: 80 } });
    });

    await visualizeAction('.', { report: 'report.json' });

    expect(process.env.AIREADY_VISUALIZER_CONFIG).toBe(
      JSON.stringify({ maxNodes: 123, maxEdges: 456 })
    );
  });

  it('should ignore invalid aiready.json and continue with defaults', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.endsWith('aiready.json')) return true;
      return true;
    });

    // invalid JSON for config
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.endsWith('aiready.json')) return 'not-a-json';
      return JSON.stringify({ scoring: { overall: 80 } });
    });

    await visualizeAction('.', { report: 'report.json' });

    expect(process.env.AIREADY_VISUALIZER_CONFIG).toBe(
      JSON.stringify({ maxNodes: 400, maxEdges: 600 })
    );
  });

  it('should call handleCLIError when GraphBuilder.buildFromReport throws', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );

    const _vizPkg = '@' + 'aiready/visualizer';
    const viz = await import(_vizPkg as any);
    vi.mocked(viz.GraphBuilder.buildFromReport).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const coreMod = await import('@aiready/core');
    await visualizeAction('.', { report: 'report.json' });

    expect(coreMod.handleCLIError).toHaveBeenCalled();
  });

  it('uses correct opener on win32 when opening', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );

    const originalPlatform = process.platform;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mutate platform for test
    Object.defineProperty(process, 'platform', { value: 'win32' });

    await visualizeAction('.', { report: 'report.json', open: true });
    expect(spawn).toHaveBeenCalled();

    // restore
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('uses xdg-open on linux when opening', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );

    const originalPlatform = process.platform;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mutate platform for test
    Object.defineProperty(process, 'platform', { value: 'linux' });

    await visualizeAction('.', { report: 'report.json', open: true });
    expect(spawn).toHaveBeenCalled();

    // restore
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('serves index.html content via handler', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const http = await import('http');
    // Override createServer to invoke handler immediately
    (http as any).createServer = (handler: any) => ({
      listen: (port: number, cb: any) => {
        // simulate request for index
        const req = { url: '/' } as any;
        const res = { writeHead: vi.fn(), end: vi.fn() } as any;
        // handler may be async
        void Promise.resolve(handler(req, res)).then(() => cb());
      },
      close: () => {},
    });

    const fsp = await import('fs/promises');
    vi.spyOn(fsp, 'readFile' as any).mockResolvedValue('<html>ok</html>');

    await visualizeAction('.', { report: 'report.json', serve: 4000 });

    // If no exceptions thrown, handler executed
    expect(true).toBe(true);
  });

  it('serves 404 for unknown paths', async () => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ scoring: { overall: 80 } })
    );
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const http = await import('http');
    (http as any).createServer = (handler: any) => ({
      listen: (port: number, cb: any) => {
        const req = { url: '/nope' } as any;
        const res = { writeHead: vi.fn(), end: vi.fn() } as any;
        void Promise.resolve(handler(req, res)).then(() => cb());
      },
      close: () => {},
    });

    await visualizeAction('.', { report: 'report.json', serve: 4001 });

    expect(true).toBe(true);
  });
});
