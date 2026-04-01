# AIReady MCP Server

The AIReady MCP Server provides an integration point for AI agents (like Claude Desktop, Cursor, Windsurf, etc.) to assess AI-readiness and improve AI leverage directly within their conversational interfaces using the Model Context Protocol (MCP).

## Installation & Distribution Channels

You can install and use the AIReady MCP server through several supported channels.

### 1. Dedicated MCP Registries

- **[Smithery](https://smithery.ai)**: Discover and install our server directly via the Smithery CLI:
  ```bash
  npx @smithery/cli install @aiready/mcp-server
  ```
- **[Glama](https://glama.ai/mcp)**: View our listing and integration options on the Glama directory.
- **[Pulsar](https://gotopulsar.com)**: Find us on the Pulsar registry for MCP servers.

### 2. Direct IDE / Assistant Integrations

#### Claude Desktop App

To use the AIReady MCP server in the Claude Desktop app, add the following configuration to your `claude_desktop_config.json`:

```json
"mcpServers": {
  "aiready": {
    "command": "npx",
    "args": ["-y", "@aiready/mcp-server"]
  }
}
```

#### Cursor IDE

1. Open Cursor Settings.
2. Navigate to **Features** -> **MCP Servers**.
3. Add a new server.
4. Set the command to: `npx -y @aiready/mcp-server`

#### Windsurf IDE

1. Open Windsurf Settings or local environment configuration.
2. Add a new MCP Server integration.
3. Configure the execution command: `npx -y @aiready/mcp-server`

### 3. Containerized Distribution (Docker)

If you prefer running MCP servers in isolated environments, you can use our Docker image:

```bash
docker run -i --rm ghcr.io/getaiready/aiready-mcp-server
```

_(Note: Docker image distribution is currently being set up. Use the command above once published.)_

### 4. Existing AIReady Channels

We are also integrating the MCP server with our existing distribution methods:

- **Homebrew**: `brew install aiready-mcp` (Coming soon)
- **VS Code Extension**: Bundled within the AIReady extension for editor-native AI chats. (Coming soon)

## Quick Start

To test the server locally, you can run:

```bash
npx @aiready/mcp-server
```

For more details on AIReady, visit [getaiready.dev](https://getaiready.dev).
