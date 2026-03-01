# @aiready/cli

> Unified command-line interface for the AIReady framework.

## 🏛️ Architecture

```markdown
# @aiready/cli

> Unified command-line interface for the AIReady framework.

## 🏛️ Architecture
```

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

Legend:
PAT = pattern-detect CTX = context-analyzer
CON = consistency AMP = change-amplification
DEP = deps-health DOC = doc-drift
SIG = ai-signal-clarity AGT = agent-grounding
TST = testability

````

## Overview

The CLI provides both unified analysis (scan multiple tools at once) and individual tool access for pattern detection, context analysis, and consistency checking.

## Usage

```bash
# Scan a codebase
aiready scan .

# Run a specific tool
aiready patterns . --similarity 0.6
````

## 🌐 Platform Integration

Connect your local scans to the [AIReady Dashboard](https://getaiready.dev/dashboard).

### Automatic Upload

Scan and upload results in one step:

```bash
aiready scan . --upload --api-key ar_...
```

### Manual Upload

Upload an existing report JSON:

```bash
aiready upload .aiready/latest.json --api-key ar_...
```

### Options

- `--upload`: Automatically upload results after scan
- `--api-key <key>`: Your platform API key (or set `AIREADY_API_KEY`)
- `--server <url>`: Custom platform URL (optional)

## License

MIT

```

```
