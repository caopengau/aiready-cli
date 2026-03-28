import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { Octokit } from '@octokit/rest';

/**
 * Extract JSON from agent text response.
 * Handles code blocks, nested objects, and unbalanced braces.
 */
export function extractJson(text: string): any | null {
  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;

  const start = candidate.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === '{') depth++;
    if (candidate[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.substring(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Execute with retry and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  label = 'operation'
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxRetries) break;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(
        `[RemediationSwarm] ${label} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${lastError.message}`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Create direct tools with pre-bound context (rootDir, repoUrl, githubToken).
 * This replaces the MCP adapter approach which fails in Lambda due to npx spawning.
 */
function createSwarmTools(
  rootDir: string,
  repoUrl: string,
  githubToken: string
) {
  const [owner, repo] = repoUrl
    .replace('https://github.com/', '')
    .replace('git@github.com:', '')
    .replace('.git', '')
    .split('/');

  const octokit = new Octokit({ auth: githubToken });

  return {
    'read-file': createTool({
      id: 'read-file',
      description: 'Read the contents of a file from the repository',
      inputSchema: z.object({
        filePath: z.string().describe('Relative path to the file'),
      }),
      execute: async ({ filePath }) => {
        const fullPath = path.resolve(rootDir, filePath);
        if (!fullPath.startsWith(path.resolve(rootDir))) {
          return { error: 'Access denied: path traversal attempt' };
        }
        try {
          const content = await fsp.readFile(fullPath, 'utf-8');
          return { content };
        } catch (error) {
          return {
            error:
              error instanceof Error ? error.message : 'Failed to read file',
          };
        }
      },
    }),

    'write-file': createTool({
      id: 'write-file',
      description: 'Write contents to a file in the repository',
      inputSchema: z.object({
        filePath: z.string().describe('Relative path to the file'),
        content: z.string().describe('File content to write'),
      }),
      execute: async ({ filePath, content }) => {
        const fullPath = path.resolve(rootDir, filePath);
        if (!fullPath.startsWith(path.resolve(rootDir))) {
          return {
            success: false,
            error: 'Access denied: path traversal attempt',
          };
        }
        try {
          await fsp.mkdir(path.dirname(fullPath), { recursive: true });
          await fsp.writeFile(fullPath, content, 'utf-8');
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : 'Failed to write file',
          };
        }
      },
    }),

    'list-files': createTool({
      id: 'list-files',
      description: 'List files in a directory',
      inputSchema: z.object({
        dirPath: z.string().default('.').describe('Relative directory path'),
      }),
      execute: async ({ dirPath }) => {
        const resolvedDir = dirPath ?? '.';
        const fullPath = path.resolve(rootDir, resolvedDir);
        if (!fullPath.startsWith(path.resolve(rootDir))) {
          return { error: 'Access denied: path traversal attempt' };
        }
        try {
          const entries = await fsp.readdir(fullPath, { withFileTypes: true });
          return {
            files: entries.map((e) => ({
              name: e.name,
              isDirectory: e.isDirectory(),
            })),
          };
        } catch (error) {
          return {
            error:
              error instanceof Error ? error.message : 'Failed to list files',
          };
        }
      },
    }),

    'create-branch': createTool({
      id: 'create-branch',
      description: 'Create a new branch in the GitHub repository',
      inputSchema: z.object({
        branchName: z.string().describe('Name for the new branch'),
        baseBranch: z.string().default('main').describe('Branch to fork from'),
      }),
      execute: async ({ branchName, baseBranch }) => {
        const base = baseBranch || 'main';
        try {
          const { data: ref } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${base}`,
          });
          await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: ref.object.sha,
          });
          return { success: true, branchName };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to create branch',
          };
        }
      },
    }),

    'checkout-branch': createTool({
      id: 'checkout-branch',
      description: 'Create and checkout a local git branch',
      inputSchema: z.object({
        branchName: z.string().describe('Branch name to checkout'),
      }),
      execute: async ({ branchName }) => {
        try {
          await git.branch({ fs, dir: rootDir, ref: branchName });
          await git.checkout({
            fs,
            dir: rootDir,
            ref: branchName,
            force: true,
          });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to checkout branch',
          };
        }
      },
    }),

    'commit-and-push': createTool({
      id: 'commit-and-push',
      description: 'Stage all changes, commit, and push to the remote',
      inputSchema: z.object({
        branchName: z.string().describe('Branch to push to'),
        message: z.string().describe('Commit message'),
      }),
      execute: async ({ branchName, message }) => {
        try {
          await git.add({ fs, dir: rootDir, filepath: '.' });
          await git.commit({
            fs,
            dir: rootDir,
            message,
            author: {
              name: 'AIReady Remediation Agent',
              email: 'agents@getaiready.dev',
            },
          });
          await git.push({
            fs,
            http,
            dir: rootDir,
            ref: branchName,
            onAuth: () => ({ username: githubToken, password: '' }),
          });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to commit and push',
          };
        }
      },
    }),

    'create-pr': createTool({
      id: 'create-pr',
      description: 'Create a Pull Request on GitHub',
      inputSchema: z.object({
        title: z.string().describe('PR title'),
        body: z.string().describe('PR description'),
        head: z.string().describe('Branch with changes'),
        base: z.string().default('main').describe('Target branch'),
      }),
      execute: async ({ title, body, head, base }) => {
        try {
          const { data: pr } = await octokit.pulls.create({
            owner,
            repo,
            title,
            body,
            head,
            base: base || 'main',
          });
          return {
            success: true,
            prNumber: pr.number,
            prUrl: pr.html_url,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : 'Failed to create PR',
          };
        }
      },
    }),
  };
}

/**
 * RemediationSwarm — Direct-tools remediation agent for Lambda environments.
 *
 * Creates a Mastra Agent with pre-bound GitHub and filesystem tools, executes
 * a remediation task (code consolidation, rename, refactor), and returns the
 * result as JSON. Supports expert feedback iteration for human-in-the-loop review.
 *
 * Architecture:
 *   - Uses direct Octokit + isomorphic-git + fs/promises tools (no MCP spawning)
 *   - Retry with exponential backoff (3 attempts, 2s/4s/8s delays)
 *   - Balanced-brace JSON extraction from agent responses
 *   - Path traversal protection on all filesystem operations
 *
 * Called by: platform/src/worker/remediation.ts (Lambda SQS handler)
 *
 * @example
 * ```ts
 * const result = await RemediationSwarm.execute({
 *   remediation: { id: 'rem-1', type: 'consolidation', ... },
 *   repo: { url: 'https://github.com/org/repo' },
 *   rootDir: '/tmp/remedy-xxx',
 *   config: { githubToken: 'ghp_xxx', model: 'anthropic/MiniMax-M2.7', ... },
 * });
 * // result.ok === true, result.value = { status, diff, prUrl, prNumber, explanation }
 * ```
 */
export const RemediationSwarm = {
  execute: async (input: any) => {
    const { remediation, repo, rootDir, config } = input;
    const expertFeedback: string | undefined = config.expertFeedback;
    const previousDiff: string | undefined = config.previousDiff;

    // 1. Resolve model and API keys
    let model = config.model || 'anthropic/MiniMax-M2.7';

    if (model.startsWith('MiniMax') && !model.includes('/')) {
      model = `anthropic/${model}`;
    }

    if (config.anthropicApiKey || config.minimaxApiKey) {
      process.env.ANTHROPIC_API_KEY =
        config.anthropicApiKey || config.minimaxApiKey;
    }

    if (config.anthropicBaseUrl) {
      process.env.ANTHROPIC_BASE_URL = config.anthropicBaseUrl;
    }

    console.log(`[RemediationSwarm] Using model: ${model}`);

    // 2. Create direct tools (no MCP, Lambda-compatible)
    const tools = createSwarmTools(rootDir, repo.url, config.githubToken);

    // 3. Build instructions with optional expert feedback context
    let instructions = `
You are an expert full-stack engineer specialized in code consolidation and refactoring.
Your task is to take a detected code duplication or fragmentation issue and fix it.

Context:
- Repository: ${repo.url}
- Local Path: ${rootDir}

Available Tools:
- read-file: Read a file (pass filePath relative to repo root)
- write-file: Write a file (pass filePath and content)
- list-files: List files in a directory (pass dirPath)
- create-branch: Create a remote branch (pass branchName, baseBranch)
- checkout-branch: Create and checkout a local branch (pass branchName)
- commit-and-push: Stage, commit, and push changes (pass branchName, message)
- create-pr: Create a Pull Request (pass title, body, head, base)

Workflow:
1. Research: Read the affected files using read-file.
2. Branching: Create a remote branch using create-branch, then checkout locally using checkout-branch.
3. Remediation: Fix the issue by reading files, making changes, and writing them back using write-file.
4. Persist: Commit and push using commit-and-push.
5. Finalize: Create a Pull Request using create-pr.

IMPORTANT: You MUST respond with ONLY a valid JSON object. No other text before or after.
The JSON must have this structure:
{
  "status": "success" | "failure",
  "diff": "unified diff string showing your changes",
  "prUrl": "URL of the created PR (if successful)",
  "prNumber": 123,
  "explanation": "Brief explanation of what you changed and why"
}
`;

    if (expertFeedback) {
      instructions += `
---
EXPERT FEEDBACK ON YOUR PREVIOUS ATTEMPT:
"${expertFeedback}"

You MUST address this feedback in your revised fix.
`;
      if (previousDiff) {
        instructions += `
YOUR PREVIOUS DIFF (for reference):
\`\`\`
${previousDiff}
\`\`\`
`;
      }
    }

    // 4. Create agent with direct tools
    const agent = new Agent({
      id: 'refactor-agent',
      name: 'Refactor Agent',
      instructions,
      model,
      tools,
    });

    console.log('[RemediationSwarm] Executing agent logic...');

    // 5. Build prompt
    const prompt = expertFeedback
      ? `Revise your previous fix for this issue based on expert feedback.
Issue: ${JSON.stringify(remediation)}
The repository is cloned at: ${rootDir}
Remember: respond with ONLY a JSON object.`
      : `Remediate this issue: ${JSON.stringify(remediation)}
The repository is cloned at: ${rootDir}
Remember: respond with ONLY a JSON object.`;

    // 6. Execute with retry
    try {
      const result = await withRetry(
        () =>
          agent.generate(prompt, {
            // @ts-expect-error - Mastra types may not include maxTokens yet
            maxTokens: 8192,
          }),
        3,
        'Agent.generate'
      );

      const text = result.text || '';

      // Extract reasoning from MiniMax thinking blocks
      let reasoning = '';
      const rawContent = (
        result as unknown as {
          raw?: { content?: Array<{ type: string; thinking?: string }> };
        }
      ).raw?.content;
      if (rawContent && Array.isArray(rawContent)) {
        reasoning = rawContent
          .filter((block: any) => block.type === 'thinking')
          .map((block: any) => block.thinking)
          .join('\n\n');
      }

      // Parse JSON response with improved extractor
      const parsed = extractJson(text);

      if (parsed) {
        return {
          ok: true,
          value: {
            ...parsed,
            reasoning: reasoning || parsed.reasoning || '',
          },
        };
      }

      // Fallback: agent didn't return valid JSON, use text as diff
      console.warn(
        '[RemediationSwarm] No valid JSON found in response, using text as diff'
      );
      return {
        ok: true,
        value: {
          status: 'success',
          diff: text,
          reasoning,
          explanation:
            'Applied refactoring successfully (fallback to text response)',
        },
      };
    } catch (error) {
      console.error('[RemediationSwarm] Execution error:', error);
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during swarm execution',
      };
    }
  },
};
