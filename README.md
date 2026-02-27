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
  PAT = pattern-detect        CTX = context-analyzer
  CON = consistency           AMP = change-amplification
  DEP = deps-health           DOC = doc-drift
  SIG = ai-signal-clarity     AGT = agent-grounding
  TST = testability
```

## Overview

The CLI provides both unified analysis (scan multiple tools at once) and individual tool access for pattern detection, context analysis, and consistency checking.

## Usage

```bash
# Scan a codebase
aiready scan .

# Run a specific tool
aiready pattern-detect .
```

## License

MIT
