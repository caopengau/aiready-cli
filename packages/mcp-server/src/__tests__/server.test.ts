import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Point to the built JS to ensure we are testing the actual distribution
const serverPath = path.resolve(__dirname, '../../dist/index.js');

type ToolCallResponse = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

describe('AIReady MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    // StdioClientTransport doesn't have an explicit close, but we should clear references
  });

  it('should list available tools', async () => {
    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThan(0);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('pattern-detect');
    expect(toolNames).toContain('context-analyzer');
    expect(toolNames).toContain('naming-consistency');
  });

  it('should expose correct input schema for tools including summary_only', async () => {
    const result = await client.listTools();

    const patternDetect = result.tools.find((t) => t.name === 'pattern-detect');
    expect(patternDetect?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        path: { type: 'string' },
        summary_only: { type: 'boolean' },
      },
      required: ['path'],
    });
  });

  it('should execute pattern-detect with summary_only: true and return only summary', async () => {
    const result = await client.callTool({
      name: 'pattern-detect',
      arguments: {
        path: path.resolve(__dirname, '../../../core'),
        summary_only: true,
      },
    });
    const typedResult = result as ToolCallResponse;

    expect(typedResult.content).toBeDefined();
    const data = JSON.parse((typedResult.content[0] as any).text);

    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('metadata');
    expect(data).toHaveProperty('notice');
    expect(data).not.toHaveProperty('results');
  }, 20000);

  it('should execute pattern-detect and return results', async () => {
    const result = await client.callTool({
      name: 'pattern-detect',
      arguments: {
        path: path.resolve(__dirname, '../../../core'), // Test on core package
      },
    });
    const typedResult = result as ToolCallResponse;

    // Check if result has content
    expect(typedResult.content).toBeDefined();

    const firstContent = typedResult.content[0];
    expect(firstContent.type).toBe('text');

    const data = JSON.parse((firstContent as any).text);
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('summary');
  }, 20000); // Higher timeout for analysis

  it('should return error for unknown tool', async () => {
    const result = await client.callTool({
      name: 'non-existent-tool',
      arguments: { path: '.' },
    });
    const typedResult = result as ToolCallResponse;

    expect(typedResult.isError).toBe(true);
    expect((typedResult.content[0] as any).text).toContain(
      'Tool non-existent-tool not found'
    );
  });

  it('should return error for missing arguments', async () => {
    // Note: The server handles missing arguments and returns isError: true
    const result = await client.callTool({
      name: 'pattern-detect',
      arguments: {},
    });
    const typedResult = result as ToolCallResponse;

    expect(typedResult.isError).toBe(true);
    expect(typedResult.content[0].type).toBe('text');
    expect((typedResult.content[0] as any).text).toContain(
      'Invalid arguments for pattern-detect'
    );
  });
});
