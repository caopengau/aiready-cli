# @aiready/cli

Unified CLI for AIReady analysis tools. Provides both unified analysis and individual tool access.

## Installation

```bash
npm install -g @aiready/cli
# or
pnpm add -g @aiready/cli
# or
yarn global add @aiready/cli
```

## Usage

### Unified Analysis

Run both pattern detection and context analysis:

```bash
aiready scan <directory>
```

### Individual Tools

#### Pattern Detection

```bash
aiready patterns <directory> [options]
```

Options:
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

Options:
- `--max-depth <number>`: Maximum acceptable import depth (default: 5)
- `--max-context <number>`: Maximum acceptable context budget (tokens) (default: 10000)
- `--include <patterns>`: File patterns to include (comma-separated)
- `--exclude <patterns>`: File patterns to exclude (comma-separated)
- `-o, --output <format>`: Output format: console, json (default: console)
- `--output-file <path>`: Output file path (defaults to `.aiready/context-report-YYYY-MM-DD.json`)

### Unified Scan Options

```bash
aiready scan <directory> [options]
```

Options:
- `-t, --tools <tools>`: Tools to run (comma-separated: patterns,context) (default: patterns,context)
- `--include <patterns>`: File patterns to include (comma-separated)
- `--exclude <patterns>`: File patterns to exclude (comma-separated)
- `-o, --output <format>`: Output format: console, json (default: console)
- `--output-file <path>`: Output file path (defaults to `.aiready/aiready-scan-YYYY-MM-DD.json`)

> **📁 Output Files:** By default, all output files are saved to the `.aiready/` directory in your project root with timestamped filenames. You can override this with `--output-file`.

## Examples

### Quick Analysis

```bash
# Analyze current directory with both tools
aiready scan .

# Analyze only patterns
aiready patterns .

# Analyze only context costs
aiready context .
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
```

### Default Exclusions

By default, these common build and output directories are excluded from analysis:

- Dependencies: `**/node_modules/**`
- Build outputs: `**/dist/**`, `**/build/**`, `**/out/**`, `**/output/**`, etc.
- Framework caches: `**/.next/**`, `**/.nuxt/**`, `**/.cache/**`, `**/.turbo/**`
- Test/coverage: `**/coverage/**`, `**/.nyc_output/**`, `**/.jest/**`
- Version control/IDE: `**/.git/**`, `**/.vscode/**`, `**/.idea/**`
- Build artifacts: `**/*.min.js`, `**/*.bundle.js`, `**/*.tsbuildinfo`

Use `--include` and `--exclude` options to customize file selection.

### Configuration

AIReady supports configuration files to persist your settings. Create one of these files in your project root:

- `aiready.json`
- `aiready.config.json`
- `.aiready.json`
- `.aireadyrc.json`
- `aiready.config.js`
- `.aireadyrc.js`

#### Example Configuration

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

### CI/CD Integration

```bash
# JSON output for automated processing
aiready scan . --output json --output-file aiready-results.json

# Exit with error code if issues found
aiready scan . && echo "No issues found" || echo "Issues detected"
```

## Output Formats

### Console Output

Human-readable summary with key metrics and issue counts.

### JSON Output

Structured data including:
- Full analysis results
- Detailed metrics
- Issue breakdowns
- Execution timing

## Exit Codes

- `0`: Success, no critical issues
- `1`: Analysis failed or critical issues found

## Integration

The CLI is designed to integrate with:
- CI/CD pipelines
- Pre-commit hooks
- IDE extensions
- Automated workflows

For programmatic usage, see the individual packages:
- [@aiready/pattern-detect](../pattern-detect)
- [@aiready/context-analyzer](../context-analyzer)