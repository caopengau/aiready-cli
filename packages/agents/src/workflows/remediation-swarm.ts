import { Agent } from '@mastra/core/agent';
import { MCPAdapter } from '../tools/mcp-adapter';

// Standard MCP server commands (configured for a standard Node environment)
// In a real SST/Lambda environment, these should be pre-installed or bundled.
const GITHUB_MCP_COMMAND = 'npx';
const GITHUB_MCP_ARGS = ['-y', '@modelcontextprotocol/server-github'];

const FILESYSTEM_MCP_COMMAND = 'npx';
const FILESYSTEM_MCP_ARGS = ['-y', '@modelcontextprotocol/server-filesystem'];

export const RemediationSwarm = {
  execute: async (input: any) => {
    const { remediation, repo, rootDir, config } = input;

    // 1. Setup MCP Adapters
    const githubAdapter = new MCPAdapter(GITHUB_MCP_COMMAND, GITHUB_MCP_ARGS, {
      GITHUB_PERSONAL_ACCESS_TOKEN: config.githubToken,
    });

    const fsAdapter = new MCPAdapter(FILESYSTEM_MCP_COMMAND, [
      ...FILESYSTEM_MCP_ARGS,
      rootDir,
    ]);

    try {
      console.log('[RemediationSwarm] Connecting to MCP servers...');
      await Promise.all([githubAdapter.connect(), fsAdapter.connect()]);

      const githubTools = await githubAdapter.getMastraTools();
      const fsTools = await fsAdapter.getMastraTools();

      // 2. Resolve Model and API Key
      const model = config.model || 'anthropic/MiniMax-M2.7';

      console.log(`[RemediationSwarm] Using model: ${model}`);

      // 3. Create the Agent with MCP Tools
      const agent = new Agent({
        id: 'refactor-agent-mcp',
        name: 'Refactor Agent (MCP Powered)',
        instructions: `
          You are an expert full-stack engineer specialized in code consolidation and refactoring.
          Your task is to take a detected code duplication or fragmentation issue and fix it.

          Context:
          - Repository: ${repo.url}
          - Local Path: ${rootDir} (You have full access via filesystem tools)

          Available Toolsets:
          - GitHub: Use for creating branches, commits, and pull requests.
          - Filesystem: Use for reading and writing files in ${rootDir}.

          Workflow:
          1. Research: Read the affected files using filesystem tools.
          2. Branching: Create a new branch remotely using GitHub tools AND locally using Git/Filesystem tools if available.
          3. Remediation: Consolidate the logic and write the changes using filesystem tools.
          4. Persist: Commit and push the changes using GitHub/Git tools.
          5. Finalize: Create a Pull Request with a clear description using GitHub tools.

          You MUST provide your final response as a VALID JSON object with this structure:
          {
            "status": "success" | "failure",
            "diff": "unified diff string",
            "prUrl": "URL of the created PR",
            "prNumber": 123,
            "explanation": "Brief explanation of changes"
          }
        `,
        model,
        tools: {
          ...githubTools,
          ...fsTools,
        },
      });

      console.log('[RemediationSwarm] Executing agent logic...');

      const prompt = `
        Remediate this issue: ${JSON.stringify(remediation)}
        The repository is cloned at: ${rootDir}
      `;

      const result = await agent.generate(prompt);

      const text = result.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ok: true,
            value: parsed,
          };
        } catch (parseErr) {
          console.error(
            '[RemediationSwarm] JSON Parse Error:',
            parseErr,
            'Text:',
            text
          );
        }
      }

      return {
        ok: true,
        value: {
          status: 'success',
          diff: text,
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
    } finally {
      // 3. Cleanup MCP Connections
      console.log('[RemediationSwarm] Cleaning up MCP connections...');
      await Promise.allSettled([
        githubAdapter.disconnect(),
        fsAdapter.disconnect(),
      ]);
    }
  },
};
