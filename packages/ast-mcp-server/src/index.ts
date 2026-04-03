import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  ResolveDefinitionSchema,
  FindReferencesSchema,
  FindImplementationsSchema,
  GetFileStructureSchema,
  SearchCodeSchema,
  GetSymbolDocsSchema,
  BuildSymbolIndexSchema,
} from './schemas.js';
import { resolveDefinition } from './tools/resolve-definition.js';
import { findReferences } from './tools/find-references.js';
import { findImplementations } from './tools/find-implementations.js';
import { getFileStructure } from './tools/get-file-structure.js';
import { searchCode } from './tools/search-code.js';
import { getSymbolDocs } from './tools/get-symbol-docs.js';
import { buildSymbolIndex } from './tools/build-symbol-index.js';

/**
 * AST-aware Code Exploration MCP Server
 */
export class ASTExplorerServer {
  private server: Server;
  private version: string = '0.1.0';

  constructor() {
    this.server = new Server(
      {
        name: 'ast-explorer-server',
        version: this.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();

    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'resolve_definition',
            description: 'Find where a symbol is defined using TypeScript AST.',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: {
                  type: 'string',
                  description: 'Symbol name (e.g., function, class)',
                },
                path: {
                  type: 'string',
                  description: 'Project root or target directory',
                },
              },
              required: ['symbol', 'path'],
            },
          },
          {
            name: 'find_references',
            description: 'Find all usages of a symbol across the project.',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: { type: 'string', description: 'Symbol name' },
                path: { type: 'string', description: 'Project root' },
                limit: { type: 'number', default: 50 },
                offset: { type: 'number', default: 0 },
              },
              required: ['symbol', 'path'],
            },
          },
          {
            name: 'find_implementations',
            description:
              'Find implementations of interfaces or abstract classes.',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: { type: 'string', description: 'Interface/Class name' },
                path: { type: 'string', description: 'Project root' },
                limit: { type: 'number', default: 50 },
                offset: { type: 'number', default: 0 },
              },
              required: ['symbol', 'path'],
            },
          },
          {
            name: 'get_file_structure',
            description:
              'Get structural overview of a file (imports, exports, symbols).',
            inputSchema: {
              type: 'object',
              properties: {
                file: { type: 'string', description: 'Absolute path to file' },
              },
              required: ['file'],
            },
          },
          {
            name: 'search_code',
            description: 'Fast regex search via bundled ripgrep.',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: { type: 'string', description: 'Search pattern' },
                path: { type: 'string', description: 'Directory to search' },
                filePattern: { type: 'string', description: 'Glob filter' },
                limit: { type: 'number', default: 50 },
                offset: { type: 'number', default: 0 },
                regex: { type: 'boolean', default: true },
              },
              required: ['pattern', 'path'],
            },
          },
          {
            name: 'get_symbol_docs',
            description: 'Get JSDoc/TSDoc for a specific symbol.',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: { type: 'string', description: 'Symbol name' },
                path: { type: 'string', description: 'Project root' },
              },
              required: ['symbol', 'path'],
            },
          },
          {
            name: 'build_symbol_index',
            description: 'Warm the symbol index for faster navigation.',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Project root to index' },
              },
              required: ['path'],
            },
          },
        ],
      };
    });

    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'resolve_definition': {
            const { symbol, path } = ResolveDefinitionSchema.parse(args);
            const results = await resolveDefinition(symbol, path);
            return {
              content: [
                { type: 'text', text: JSON.stringify(results, null, 2) },
              ],
            };
          }
          case 'find_references': {
            const { symbol, path, limit, offset } =
              FindReferencesSchema.parse(args);
            const results = await findReferences(symbol, path, limit, offset);
            return {
              content: [
                { type: 'text', text: JSON.stringify(results, null, 2) },
              ],
            };
          }
          case 'find_implementations': {
            const { symbol, path, limit, offset } =
              FindImplementationsSchema.parse(args);
            const results = await findImplementations(
              symbol,
              path,
              limit,
              offset
            );
            return {
              content: [
                { type: 'text', text: JSON.stringify(results, null, 2) },
              ],
            };
          }
          case 'get_file_structure': {
            const { file } = GetFileStructureSchema.parse(args);
            const structure = await getFileStructure(file);
            return {
              content: [
                { type: 'text', text: JSON.stringify(structure, null, 2) },
              ],
            };
          }
          case 'search_code': {
            const { pattern, path, filePattern, limit, offset, regex } =
              SearchCodeSchema.parse(args);
            const results = await searchCode(
              pattern,
              path,
              filePattern,
              limit,
              regex,
              offset
            );
            return {
              content: [
                { type: 'text', text: JSON.stringify(results, null, 2) },
              ],
            };
          }
          case 'get_symbol_docs': {
            const { symbol, path } = GetSymbolDocsSchema.parse(args);
            const docs = await getSymbolDocs(symbol, path);
            return {
              content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }],
            };
          }
          case 'build_symbol_index': {
            const { path } = BuildSymbolIndexSchema.parse(args);
            const stats = await buildSymbolIndex(path);
            return {
              content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
            };
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AST Explorer MCP Server started');
  }
}

// Start the server
const server = new ASTExplorerServer();
server.run().catch((error) => {
  console.error('Fatal error starting AST Explorer MCP Server:', error);
  process.exit(1);
});
