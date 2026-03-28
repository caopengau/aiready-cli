import { createTool } from '@mastra/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/**
 * MCPAdapter allows connecting to external MCP servers and exposing their tools to Mastra agents.
 */
export class MCPAdapter {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(
    command: string,
    args: string[] = [],
    env: Record<string, string> = {}
  ) {
    this.transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env } as Record<string, string>,
    });

    this.client = new Client({ name: 'aiready-mcp-adapter', version: '1.0.0' });
  }

  async connect() {
    await this.client.connect(this.transport);
  }

  async disconnect() {
    await this.transport.close();
  }

  /**
   * Discovers tools from the MCP server and wraps them as Mastra tools.
   */
  async getMastraTools(): Promise<Record<string, any>> {
    const response = await (
      this.client as unknown as {
        request: (schema: typeof ListToolsRequestSchema) => Promise<{
          tools: Array<{
            name: string;
            description?: string;
            inputSchema?: any;
          }>;
        }>;
      }
    ).request(ListToolsRequestSchema);
    const mastraTools: Record<string, any> = {};

    for (const tool of response.tools) {
      const toolName = tool.name;
      const toolDescription = tool.description;
      const toolInputSchema = tool.inputSchema;
      mastraTools[toolName] = createTool({
        id: toolName,
        description: toolDescription || `MCP Tool: ${toolName}`,
        inputSchema: this.mapJsonSchemaToZod(toolInputSchema),
        execute: async (args) => {
          const result = await (
            this.client as unknown as {
              request: (
                schema: typeof CallToolRequestSchema,
                params: { name: string; arguments: unknown }
              ) => Promise<unknown>;
            }
          ).request(CallToolRequestSchema, {
            name: toolName,
            arguments: args,
          });
          return result;
        },
      });
    }

    return mastraTools;
  }

  /**
   * Simple mapper from JSON Schema (MCP) to Zod (Mastra)
   * Note: This is a basic implementation and might need enhancement for complex schemas.
   */
  private mapJsonSchemaToZod(schema: any): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    if (schema.type === 'object' && schema.properties) {
      for (const [key, value] of Object.entries<any>(schema.properties)) {
        let zodType: z.ZodTypeAny = z.any();

        if (value.type === 'string') {
          zodType = z.string();
        } else if (value.type === 'number') {
          zodType = z.number();
        } else if (value.type === 'boolean') {
          zodType = z.boolean();
        } else if (value.type === 'array') {
          zodType = z.array(z.any());
        }

        if (value.description) {
          zodType = zodType.describe(value.description);
        }

        if (schema.required?.includes(key)) {
          shape[key] = zodType;
        } else {
          shape[key] = zodType.optional();
        }
      }
    }

    return z.object(shape);
  }
}
