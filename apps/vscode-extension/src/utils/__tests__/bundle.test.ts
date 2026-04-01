/**
 * Bundle integrity test
 *
 * Regression guard for: https://github.com/getaiready/aiready-vscode-extension/issues
 * Bug: @aiready/core was in `dependencies` so tsup externalized it.
 * The VSIX ships without node_modules, so VS Code couldn't resolve the module
 * at runtime → extension activation threw → all 3 panels showed
 * "There is no data provider registered that can provide view data."
 *
 * This test ensures the built dist/extension.js never contains a bare require()
 * for any package that isn't explicitly allowed (vscode + Node built-ins).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DIST_PATH = join(__dirname, '../../../dist/extension.js');

/** Packages that are legitimately external in a VS Code extension bundle */
const ALLOWED_EXTERNALS = new Set([
  'vscode',
  // Node built-ins
  'fs',
  'path',
  'os',
  'child_process',
  'util',
  'url',
  'http',
  'https',
  'stream',
  'events',
  'crypto',
  'net',
  'tls',
  'assert',
  'buffer',
  'process',
  'module',
  'querystring',
  'readline',
  'string_decoder',
  'timers',
  'zlib',
]);

describe('VSIX bundle integrity', () => {
  it('dist/extension.js must exist (run pnpm compile first)', () => {
    expect(existsSync(DIST_PATH), `Missing ${DIST_PATH}`).toBe(true);
  });

  it('must not require any non-whitelisted external package', () => {
    expect(existsSync(DIST_PATH)).toBe(true);

    const source = readFileSync(DIST_PATH, 'utf8');

    // Match both: require("pkg") and require('pkg')
    const requireRegex = /require\(["']([^"']+)["']\)/g;
    const forbidden: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = requireRegex.exec(source)) !== null) {
      const pkg = match[1];
      // Skip relative requires and Node built-ins / allowed externals
      if (
        !pkg.startsWith('.') &&
        !pkg.startsWith('/') &&
        !ALLOWED_EXTERNALS.has(pkg)
      ) {
        forbidden.push(pkg);
      }
    }

    expect(
      forbidden,
      `Bundle contains forbidden external require() calls. ` +
        `These packages are not packaged in the VSIX and will cause ` +
        `"no data provider registered" at runtime:\n  ${[...new Set(forbidden)].join('\n  ')}`
    ).toEqual([]);
  });

  it('must not require @aiready/core (the original regression)', () => {
    expect(existsSync(DIST_PATH)).toBe(true);
    const source = readFileSync(DIST_PATH, 'utf8');
    expect(source).not.toContain('require("@aiready/core")');
    expect(source).not.toContain("require('@aiready/core')");
  });
});
