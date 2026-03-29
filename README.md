# @aiready/cli

> Assess and improve your codebase's AI-readiness. Get an AI Readiness Score (0-100) and detect issues that confuse AI models.

[![npm version](https://img.shields.io/npm/v/@aiready/cli)](https://www.npmjs.com/package/@aiready/cli)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/pengcao.aiready?label=VS%20Code)](https://marketplace.visualstudio.com/items?itemName=pengcao.aiready)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Actions](https://github.com/getaiready/aiready-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/getaiready/aiready-cli/actions)

## 🚀 Quick Start

```bash
# Install globally
npm install -g @aiready/cli

# Scan your codebase
aiready scan .

# Get detailed analysis
aiready scan . --output report.json
```

## 🤖 Why AIReady?

As AI becomes deeply integrated into software development, codebases become harder for AI models to understand due to:

- **Knowledge cutoff limitations** in AI models
- **Context fragmentation** that breaks AI understanding
- **Duplicated patterns** AI doesn't recognize
- **Inconsistent naming** across the codebase

AIReady helps teams **assess, visualize, and prepare** repositories for better AI adoption.

## 🌟 The AIReady Ecosystem

| Integration           | Package                                                                          | Description                                                    |
| --------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **CLI**               | [`@aiready/cli`](https://www.npmjs.com/package/@aiready/cli)                     | Unified command-line interface                                 |
| **MCP Server**        | [`@aiready/mcp-server`](https://www.npmjs.com/package/@aiready/mcp-server)       | **Cursor-Ready**: Bridge AI agents to the Platform Swarm       |
| **Remediation Swarm** | [Platform](https://platform.getaiready.dev)                                      | **AI-to-AI Fixes**: Automated refactors via specialized agents |
| **GitHub Action**     | [`aiready-action`](https://github.com/marketplace/actions/aiready-action)        | **No-Regression**: CI/CD gate for AI leverage                  |
| **VS Code**           | [`aiready`](https://marketplace.visualstudio.com/items?itemName=pengcao.aiready) | Real-time AI readiness analysis in VS Code                     |

## ✨ Features

- **AI Readiness Score** - Get a 0-100 score indicating how AI-ready your codebase is.
- **🛡️ AI-Regression Guardrail** - Block PRs that reduce your AI leverage (GitHub Action).
- **🤖 Remediation Swarm** - Automatically fix AI-readiness issues using the platform's specialized agents.
- **🔌 Cursor-Ready MCP Server** - Let your AI assistant (Cursor, Windsurf, Claude) find and _remediate_ code issues directly in your IDE.
- **Semantic Duplicate Detection** - Find duplicate patterns that waste AI context window tokens.
- **Context Analysis** - Analyze context window costs, import depth, and dependency fragmentation.
- **Consistency Checks** - Ensure naming conventions and pattern consistency.
- **Agent Grounding** - Evaluate how well code aids AI agents and autonomous workflows.

## 📋 Commands

### Unified Scan

Run all analysis tools at once:

```bash
aiready scan .
aiready scan . --output report.json
aiready scan . --threshold 70
```

### Remediation

See suggested fixes for detected issues:

```bash
aiready remediate                  # Show remediation options for latest report
aiready remediate --tool patterns  # Focus on pattern consolidation fixes
```

> **Note:** Advanced automated remediation requires an [AIReady Platform](https://platform.getaiready.dev) subscription and an API key.

### Individual Tools

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `aiready patterns`    | Detect semantic duplicates and patterns    |
| `aiready context`     | Analyze context window cost & dependencies |
| `aiready consistency` | Check naming conventions                   |
| `aiready testability` | Assess code testability                    |
| `aiready contract`    | Analyze structural type safety & contracts |
| `aiready visualize`   | Generate interactive visualizations        |
| `aiready upload`      | Upload results to AIReady platform         |

## 📦 Installation

### npm / pnpm / yarn

```bash
# npm
npm install -g @aiready/cli

# pnpm
pnpm add -g @aiready/cli

# yarn
yarn global add @aiready/cli
```

### Docker

```bash
# Pull from Docker Hub
docker pull aiready/cli

# Run
docker run aiready/cli scan .

# Or use the image directly
docker run -v $(pwd):/app aiready/cli scan /app
```

### Homebrew

```bash
brew install caopengau/aiready/aiready
```

### VS Code Extension

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=pengcao.aiready) or search for "AIReady" in VS Code extensions.

### GitHub Action

```yaml
- name: AIReady Code Analysis
  uses: caopengau/aiready-action@v1
  with:
    threshold: 70
```

### MCP Server

```bash
npm install -g @aiready/mcp-server
aiready-mcp
```

## 🔧 Configuration

Create an `aiready.json` config file:

```json
{
  "scan": {
    "exclude": ["**/dist/**", "**/node_modules/**"]
  },
  "tools": {
    "pattern-detect": { "minSimilarity": 0.5 },
    "context-analyzer": { "maxContextBudget": 15000 }
  },
  "output": { "format": "json", "directory": ".aiready" }
}
```

## 🌐 Language Support

**Currently Supported (95% market coverage):**

- ✅ TypeScript / JavaScript
- ✅ Python
- ✅ Java
- ✅ Go
- ✅ C#

## 🏗️ Architecture

```text
                    🎯 USER
                      │
                      ▼
         🎛️  @aiready/cli (orchestrator)
          │     │     │     │     │     │     │     │     │     │
          ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
        [PAT] [CTX] [CON] [AMP] [DEP] [DOC] [SIG] [AGT] [TST] [CTR]
          │     │     │     │     │     │     │     │     │     │
          └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                               │
                               ▼
                        🏢 @aiready/core
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🔗 Related Links

- 🌐 [Website](https://getaiready.dev)
- 📖 [Documentation](https://docs.getaiready.dev)
- 📦 [npm](https://www.npmjs.com/package/@aiready/cli)
- 📊 [GitHub Actions](https://github.com/marketplace/actions/aiready-action)
- 🔌 [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=pengcao.aiready)
