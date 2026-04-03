import { execFile } from 'child_process';
import { promisify } from 'util';
import { rgPath } from '@vscode/ripgrep';
import { validateWorkspacePath } from '../security.js';

const execFileAsync = promisify(execFile);

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
}

export async function searchCode(
  pattern: string,
  searchPath: string,
  filePattern?: string,
  limit: number = 50,
  regex: boolean = true,
  offset: number = 0
): Promise<SearchResult[]> {
  const safePath = validateWorkspacePath(searchPath);

  const args = ['--json', '--max-columns', '500'];

  if (!regex) {
    args.push('--fixed-strings');
  }

  args.push(pattern, safePath);

  if (filePattern) {
    args.push('--glob', filePattern);
  }

  // Common exclusions
  args.push('--glob', '!**/node_modules/**');
  args.push('--glob', '!**/dist/**');
  args.push('--glob', '!**/.git/**');

  try {
    const { stdout } = await execFileAsync(rgPath, args);
    const lines = stdout.split('\n').filter(Boolean);
    const results: SearchResult[] = [];

    for (const line of lines) {
      const data = JSON.parse(line);
      if (data.type === 'match') {
        const file = data.data.path.text;
        const lineNumber = data.data.line_number;
        const submatches = data.data.submatches;

        for (const submatch of submatches) {
          results.push({
            file,
            line: lineNumber,
            column: submatch.start,
            text: data.data.lines.text.trim(),
          });
        }
      }
    }

    return results.slice(offset, offset + limit);
  } catch (error: any) {
    if (error.code === 1) {
      // rg returns 1 if no matches found
      return [];
    }
    throw error;
  }
}
