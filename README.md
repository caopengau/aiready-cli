# @aiready/cli

> Unified command-line interface for the AIReady framework.

## 🏛️ Architecture

```text
                    🎯 USER
                      │
                      ▼
         🎛️  @aiready/cli (orchestrator)  ← YOU ARE HERE
          │     │     │     │     │     │     │     │     │
          ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
        [PAT] [CTX] [CON] [AMP] [DEP] [DOC] [SIG] [AGT] [TST]
          │     │     │     │     │     │     │     │     │
          └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                             │
                             ▼
                    🏢 @aiready/core
```

Legend:

- PAT = pattern-detect | CTX = context-analyzer
- CON = consistency | AMP = change-amplification
- DEP = deps-health | DOC = doc-drift
- SIG = ai-signal-clarity | AGT = agent-grounding
- TST = testability

## 🌐 Language Support

Analyzes **TypeScript, JavaScript, Python, Java, Go, and C#** (95% market coverage).

## 🚀 Quick Start

```bash
# Install globally
npm install -g @aiready/cli

# Scan a codebase
aiready scan .

# Run a specific tool
aiready patterns . --similarity 0.6

# Run context analysis
aiready context .

# Check consistency
aiready consistency .
```

## 📋 Commands

### Unified Scan

Scan with multiple tools at once:

```bash
aiready scan . --output report.json
```

### Individual Tools

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `aiready patterns`    | Detect semantic duplicates and patterns    |
| `aiready context`     | Analyze context window cost & dependencies |
| `aiready consistency` | Check naming conventions                   |
| `aiready testability` | Assess code testability                    |
| `aiready visualize`   | Generate interactive visualizations        |

## 🔧 Options

- `--output, -o`: Output file path (JSON format)
- `--include`: Glob patterns to include
- `--exclude`: Glob patterns to exclude
- `--threshold`: Score threshold for pass/fail

## ☁️ Platform Integration

Connect your local scans to the [AIReady Dashboard](https://platform.getaiready.dev/dashboard).

### Automatic Upload

```bash
aiready scan . --upload --api-key ar_...
```

### Manual Upload

```bash
aiready upload .aiready/latest.json --api-key ar_...
```

### Options

- `--upload`: Automatically upload results after scan
- `--api-key <key>`: Your platform API key (or set `AIREADY_API_KEY`)
- `--server <url>`: Custom platform URL (optional)

## 🛠️ Building Your Own Tool

Want to build your own analysis tool that integrates with the AIReady ecosystem? Check out our [Spoke Development Guide](./docs/SPOKE_GUIDE.md).

## 📦 Installation

```bash
# Using npm
npm install -g @aiready/cli

# Using pnpm
pnpm add -g @aiready/cli

# Using yarn
yarn global add @aiready/cli
```

## 🔨 Build from Source

```bash
# Clone the repository
git clone https://github.com/caopengau/aiready-cli.git
cd aiready-cli

# Install dependencies
pnpm install

# Build
pnpm build
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🔗 Related Links

- [Website](https://getaiready.dev)
- [Documentation](https://docs.getaiready.dev)
- [GitHub Actions](https://github.com/caopengau/aiready-action)
- [VS Code Extension](https://github.com/caopengau/aiready-vscode)
