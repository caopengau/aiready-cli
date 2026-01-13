import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { ScanOptions } from '../types';

const DEFAULT_EXCLUDE = [
  // Dependencies
  '**/node_modules/**',

  // Build outputs
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/output/**',
  '**/target/**',
  '**/bin/**',
  '**/obj/**',

  // Framework-specific build dirs
  '**/.next/**',
  '**/.nuxt/**',
  '**/.vuepress/**',
  '**/.cache/**',
  '**/.turbo/**',

  // Test and coverage
  '**/coverage/**',
  '**/.nyc_output/**',
  '**/.jest/**',

  // Version control and IDE
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/*.swp',
  '**/*.swo',

  // Build artifacts and minified files
  '**/*.min.js',
  '**/*.min.css',
  '**/*.bundle.js',
  '**/*.tsbuildinfo',

  // Logs and temporary files
  '**/logs/**',
  '**/*.log',
  '**/.DS_Store',
];

export async function scanFiles(options: ScanOptions): Promise<string[]> {
  const {
    rootDir,
    include = ['**/*.{ts,tsx,js,jsx,py,java}'],
    exclude = DEFAULT_EXCLUDE,
  } = options;

  const files = await glob(include, {
    cwd: rootDir,
    ignore: exclude,
    absolute: true,
  });

  return files;
}

export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export function getFileExtension(filePath: string): string {
  return filePath.split('.').pop() || '';
}

export function isSourceFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs'].includes(ext);
}
