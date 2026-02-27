# @aiready/cli

> Unified command-line interface for the AIReady framework.

## 🏛️ Architecture

```
                    🎯 USER
                      │
                      ▼
      🎛️  @aiready/cli (orchestrator)  ← YOU ARE HERE
           │   │   │   │   │   │   │   │   │   │   │   │
           ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼
         ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐
         │A│ │B│ │C│ │D│ │E│ │F│ │G│ │H│ │I│ │J│ │K│ │L│
         └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘
         ALL SPOKES — flat peers, imported directly by CLI:
         A=pattern-detect    B=context-analyzer  C=consistency
         D=change-amp        E=deps-health        F=doc-drift
         G=ai-signal-clarity H=agent-grounding    I=testability
         J=visualizer        K=skills             L=components
           │   │   │   │   │   │   │   │   │   │   │   │
           └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
                               │
                               ▼
                      🏢 @aiready/core
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
