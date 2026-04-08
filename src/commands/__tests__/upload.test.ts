import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadAction } from '../upload';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('{"test": true}'),
  },
}));

vi.mock('@aiready/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...original,
    handleCLIError: vi.fn(),
  };
});

describe('Upload CLI Action', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            success: true,
            analysis: { id: '123', aiScore: 80 },
          }),
      })
    );
    vi.stubGlobal('process', {
      ...process,
      exit: vi.fn(),
    });
  });

  it('should upload report successfully', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await uploadAction('report.json', { apiKey: 'test-key' });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Upload successful')
    );
    consoleSpy.mockRestore();
  });

  it('should fail if API key is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await uploadAction('report.json', {});
    expect(process.exit).toHaveBeenCalledWith(1);
    consoleSpy.mockRestore();
  });

  it('should fail if report file does not exist', async () => {
    const fsMod = await import('fs');
    // the fs mock is exported under default in the module mock
    const target = (fsMod as any).default || fsMod;
    vi.spyOn(target, 'existsSync').mockReturnValueOnce(false);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await uploadAction('missing.json', { apiKey: 'test-key' });
    expect(process.exit).toHaveBeenCalledWith(1);
    consoleSpy.mockRestore();
  });

  it('should handle non-ok HTML response and print hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve('Redirecting to login'),
        status: 302,
        statusText: 'Found',
      })
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await uploadAction('report.json', { apiKey: 'test-key' });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
