import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanFiles } from '../utils/file-scanner';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('File Scanner', () => {
  const tmpDir = join(tmpdir(), 'aiready-scanner-tests');

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    // Create some test files
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    mkdirSync(join(tmpDir, 'dist'), { recursive: true });
    mkdirSync(join(tmpDir, 'node_modules'), { recursive: true });

    writeFileSync(join(tmpDir, 'src/main.ts'), 'console.log(1)');
    writeFileSync(join(tmpDir, 'src/utils.js'), 'module.exports = {}');
    writeFileSync(join(tmpDir, 'dist/bundle.js'), 'minified code');
    writeFileSync(join(tmpDir, 'node_modules/dep.ts'), 'dependency code');
    writeFileSync(join(tmpDir, '.aireadyignore'), '**/secret.ts');
    writeFileSync(join(tmpDir, 'src/secret.ts'), 'top secret');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should find source files while respecting default ignores', async () => {
    const files = await scanFiles({ rootDir: tmpDir });

    const relativeFiles = files.map((f) =>
      join(f)
        .replace(tmpDir, '')
        .replace(/^[\/\\]/, '')
    );

    expect(relativeFiles).toContain('src/main.ts');
    expect(relativeFiles).toContain('src/utils.js');
    expect(relativeFiles).not.toContain('dist/bundle.js');
    expect(relativeFiles).not.toContain('node_modules/dep.ts');
  });

  it('should respect .aireadyignore', async () => {
    const files = await scanFiles({ rootDir: tmpDir });
    const relativeFiles = files.map((f) =>
      join(f)
        .replace(tmpDir, '')
        .replace(/^[\/\\]/, '')
    );

    expect(relativeFiles).not.toContain('src/secret.ts');
  });

  it('should include tests when includeTests is true', async () => {
    writeFileSync(join(tmpDir, 'src/main.test.ts'), 'test()');

    const filesWithoutTests = await scanFiles({
      rootDir: tmpDir,
      includeTests: false,
    });
    expect(filesWithoutTests.some((f) => f.endsWith('main.test.ts'))).toBe(
      false
    );

    const filesWithTests = await scanFiles({
      rootDir: tmpDir,
      includeTests: true,
    });
    expect(filesWithTests.some((f) => f.endsWith('main.test.ts'))).toBe(true);
  });
});
