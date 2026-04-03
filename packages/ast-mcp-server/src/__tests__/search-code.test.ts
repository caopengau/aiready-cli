import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCode } from '../tools/search-code.js';

const { execFileAsyncMock, validateWorkspacePathMock } = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn(),
  validateWorkspacePathMock: vi.fn((p: string) => `/safe${p}`),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => execFileAsyncMock),
}));

vi.mock('@vscode/ripgrep', () => ({
  rgPath: '/mock/rg',
}));

vi.mock('../security.js', () => ({
  validateWorkspacePath: validateWorkspacePathMock,
}));

describe('searchCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses ripgrep JSON matches into flattened results', async () => {
    execFileAsyncMock.mockResolvedValueOnce({
      stdout: [
        JSON.stringify({
          type: 'match',
          data: {
            path: { text: '/safe/repo/src/a.ts' },
            line_number: 10,
            lines: { text: 'const target = 1;\n' },
            submatches: [{ start: 6 }, { start: 13 }],
          },
        }),
        JSON.stringify({ type: 'summary', data: {} }),
      ].join('\n'),
    });

    const results = await searchCode('target', '/repo', '*.ts', 50, true, 0);

    expect(validateWorkspacePathMock).toHaveBeenCalledWith('/repo');
    expect(execFileAsyncMock).toHaveBeenCalledWith(
      '/mock/rg',
      expect.arrayContaining([
        '--json',
        'target',
        '/safe/repo',
        '--glob',
        '*.ts',
      ])
    );
    expect(results).toEqual([
      {
        file: '/safe/repo/src/a.ts',
        line: 10,
        column: 6,
        text: 'const target = 1;',
      },
      {
        file: '/safe/repo/src/a.ts',
        line: 10,
        column: 13,
        text: 'const target = 1;',
      },
    ]);
  });

  it('uses fixed string flag when regex is disabled', async () => {
    execFileAsyncMock.mockResolvedValueOnce({ stdout: '' });

    await searchCode('literal.value', '/repo', undefined, 25, false);

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      '/mock/rg',
      expect.arrayContaining(['--fixed-strings', 'literal.value', '/safe/repo'])
    );
  });

  it('respects limit and offset by slicing parsed matches', async () => {
    execFileAsyncMock.mockResolvedValueOnce({
      stdout: [
        JSON.stringify({
          type: 'match',
          data: {
            path: { text: 'a.ts' },
            line_number: 1,
            lines: { text: 'abc\n' },
            submatches: [{ start: 0 }, { start: 1 }, { start: 2 }], // a, b, c
          },
        }),
      ].join('\n'),
    });

    // Get 2nd match only
    const results = await searchCode('x', '/repo', undefined, 1, true, 1);

    expect(results).toHaveLength(1);
    expect(results[0].column).toBe(1); // 'b'
  });

  it('returns empty array when ripgrep reports no matches', async () => {
    execFileAsyncMock.mockRejectedValueOnce({ code: 1 });

    const results = await searchCode('nope', '/repo');

    expect(results).toEqual([]);
  });

  it('rethrows non-no-match errors', async () => {
    execFileAsyncMock.mockRejectedValueOnce(new Error('spawn failed'));

    await expect(searchCode('x', '/repo')).rejects.toThrow('spawn failed');
  });
});
