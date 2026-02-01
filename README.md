# @aiready/cli

> **Unified CLI for AIReady analysis tools - Run all AI-readiness checks from a single command**

The CLI provides both unified analysis (scan multiple tools at once) and individual tool access for pattern detection, context analysis, and consistency checking.

## �️ Architecture

```
                           🎯 USER
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   🎛️  CLI (@aiready/cli) ⬅ YOU ARE HERE        │
│                Unified Interface & Orchestration                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
             🏢 HUB (core)
                  │
      ┌───────────┼───────────┬───────────┐
      ▼           ▼           ▼           ▼
  📊 PATTERN  📦 CONTEXT  🔧 CONSIST  📚 DOC
   DETECT      ANALYZER    ENCY        DRIFT
   ✅ Ready    ✅ Ready    ✅ Ready    🔜 Soon
```

## �🌍 Language Support

**Currently Supported (64% market coverage):**
- ✅ **TypeScript** (`.ts`, `.tsx`)
- ✅ **JavaScript** (`.js`, `.jsx`)
- ✅ **Python** (`.py`) - PEP 8 conventions, import analysis, pattern detection

**Roadmap:**
- 🔜 **Java** (Q3 2026) - Maven/Gradle, Spring Framework
- 🔜 **Go** (Q4 2026) - Go modules, concurrency patterns
- 🔜 **Rust** (Q4 2026) - Cargo, ownership patterns
- 🔜 **C#** (Q1 2027) - .NET, LINQ patterns

Mixed-language projects are fully supported - the tool automatically detects and analyzes each file type appropriately.

## 🚀 Quick Start

**Zero config, works out of the box:**

```bash
# Run without installation (recommended)
npx @aiready/cli scan ./src

# Or install globally for simpler command and faster runs
npm install -g @aiready/cli
aiready scan ./src
```

### 🎯 Input & Output

**Input:** Path to your source code directory
```bash
aiready scan ./src
```

**Output:** Terminal report + optional JSON file (saved to `.aiready/` directory)
```
📊 AIReady Scan Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Pattern Detection
   📁 Files analyzed: 47
   ⚠️  Duplicate patterns: 12 files with 23 issues
   💰 Wasted tokens: 8,450

📦 Context Analysis
   📁 Files analyzed: 47
   ⚠️  High context cost: 8 files
   🔗 Deep import chains: 5 files
```

### ✨ Smart Defaults (Zero Config)

- ✅ **Auto-excludes** test files (`**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`)
- ✅ **Auto-excludes** build outputs (`dist/`, `build/`, `.next/`, `cdk.out/`)
- ✅ **Auto-excludes** dependencies (`node_modules/`)
- ✅ **Adaptive thresholds**: Adjusts issue detection based on codebase size
- ✅ **Unified reporting**: Combines results from all tools into one view

> Override defaults with `--include` or `--exclude` options as needed

## 📦 Commands

### Unified Scan

Run multiple analysis tools in one command:

```bash
aiready scan <directory>
```

**Options:**
- `-t, --tools <tools>`: Tools to run (comma-separated: patterns,context,consistency) (default: patterns,context)
- `--include <patterns>`: File patterns to include (comma-separated)
- `--exclude <patterns>`: File patterns to exclude (comma-separated)
- `-o, --output <format>`: Output format: console, json (default: console)
- `--output-file <path>`: Output file path (defaults to `.aiready/aiready-scan-YYYY-MM-DD.json`)

### Individual Tools

Access each tool directly for focused analysis:

#### Pattern Detection

```bash
aiready patterns <directory> [options]
```

**Options:**
- `-s, --similarity <number>`: Minimum similarity score (0-1) (default: 0.40)
- `-l, --min-lines <number>`: Minimum lines to consider (default: 5)
- `--include <patterns>`: File patterns to include (comma-separated)
- `--exclude <patterns>`: File patterns to exclude (comma-separated)
- `-o, --output <format>`: Output format: console, json (default: console)
- `--output-file <path>`: Output file path (defaults to `.aiready/pattern-report-YYYY-MM-DD.json`)

#### Context Analysis

```bash
aiready context <directory> [options]
```

**Options:**
- `--max-depth <number>`: Maximum acceptable import depth (default: 5)
- `--max-context <number>`: Maximum acceptable context budget (tokens) (default: 10000)
- `--include <patterns>`: File patterns to include (comma-separated)
- `--exclude <patterns>`: File patterns to exclude (comma-separated)
- `-o, --output <format>`: Output format: console, json (default: console)
- `--output-file <path>`: Output file path (defaults to `.aiready/context-report-YYYY-MM-DD.json`)

#### Consistency Analysis

```bash
aiready consistency <directory> [options]
```

**Options:**
- `--include <patterns>`: File patterns to include (comma-separated)
- `--exclude <patterns>`: File patterns to exclude (comma-separated)
- `-o, --output <format>`: Output format: console, json (default: console)
- `--output-file <path>`: Output file path (defaults to `.aiready/consistency-report-YYYY-MM-DD.json`)

> **📁 Output Files:** By default, all output files are saved to the `.aiready/` directory in your project root with timestamped filenames. You can override this with `--output-file`.

## 💡 Examples

### Basic Usage

```bash
# Analyze current directory with all tools
aiready scan .

# Run specific tools only
aiready scan . --tools patterns,context

# Analyze only patterns
aiready patterns .

# Analyze only context costs
aiready context .

# Analyze only consistency
aiready consistency .
```

### Advanced Usage

```bash
# Analyze specific file types
aiready scan ./src --include "**/*.ts,**/*.js"

# Exclude test files
aiready scan . --exclude "**/*.test.*,**/*.spec.*"

# Save results to JSON file (.aiready/ directory by default)
aiready scan . --output json

# Save to custom location
aiready scan . --output json --output-file custom-results.json

# Run only pattern analysis with custom similarity threshold
aiready patterns . --similarity 0.6 --min-lines 10

# Run context analysis with custom thresholds
aiready context . --max-depth 3 --max-context 5000
```

## ⚙️ Configuration

AIReady supports configuration files to persist your settings. Create one of these files in your project root:

- `aiready.json`
- `aiready.config.json`
- `.aiready.json`
- `.aireadyrc.json`
- `aiready.config.js`
- `.aireadyrc.js`

### Example Configuration

```json
{
  "scan": {
    "include": ["**/*.{ts,tsx,js,jsx}"],
    "exclude": ["**/test/**", "**/*.test.*", "**/*.spec.*"]
  },
  "tools": {
    "pattern-detect": {
      "minSimilarity": 0.5,
      "minLines": 8,
      "approx": false
    },
    "context-analyzer": {
      "maxDepth": 4,
      "maxContextBudget": 8000,
      "includeNodeModules": false
    }
  },
  "output": {
    "format": "console",
    "file": "aiready-report.json"
  }
}
```

Configuration values are merged with defaults, and CLI options take precedence over config file settings.

## 🔄 CI/CD Integration

```bash
# JSON output for automated processing
aiready scan . --output json --output-file aiready-results.json

# Exit with error code if issues found
aiready scan . && echo "No issues found" || echo "Issues detected"
```

## 📊 Output Formats

### Console Output

Human-readable summary with key metrics and issue counts.

### JSON Output

Structured data including:
- Full analysis results
- Detailed metrics
- Issue breakdowns
- Execution timing

## 🚦 Exit Codes

- `0`: Success, no critical issues
- `1`: Analysis failed or critical issues found

## 🔗 Integration

The CLI is designed to integrate with:
- CI/CD pipelines
- Pre-commit hooks
- IDE extensions
- Automated workflows

For programmatic usage, see the individual packages:
- [@aiready/pattern-detect](https://www.npmjs.com/package/@aiready/pattern-detect)
- [@aiready/context-analyzer](https://www.npmjs.com/package/@aiready/context-analyzer)
- [@aiready/consistency](https://www.npmjs.com/package/@aiready/consistency)

## 🌐 Visit Our Website

**Try AIReady tools online and learn more:** [getaiready.dev](https://getaiready.dev)