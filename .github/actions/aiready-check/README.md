# AIReady GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-AIReady%20Check-blue?logo=github)](https://github.com/marketplace/actions/aiready-check)
[![Version](https://img.shields.io/github/v/release/getaiready/aiready-action?include_prereleases)](https://github.com/getaiready/aiready-action/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node 24](https://img.shields.io/badge/Node.js-24+-green?logo=node.js)](https://nodejs.org/)

> Block PRs that break your AI context budget

This GitHub Action runs AI readiness analysis on your codebase and blocks PRs that don't meet your quality threshold.

## Why AIReady?

As AI coding assistants become ubiquitous, your codebase needs to be optimized for AI comprehension:

- **🧠 Context Budget** - AI models have limited context windows; bloated code exhausts them
- **🔍 Semantic Duplicates** - Confusingly similar code fragments that AI can't distinguish
- **📦 Import Chains** - Deep dependency trees that fragment context
- **🏷️ Naming Consistency** - Inconsistent naming confuses AI models

## Features

- 🚫 **PR Gatekeeper** - Block merges that break your AI context budget
- 📊 **AI Readiness Score** - Get a 0-100 score for your codebase
- ⚡ **Configurable Thresholds** - Set minimum score requirements
- 🔍 **Issue Detection** - Find semantic duplicates, context fragmentation, naming inconsistencies
- 📈 **Historical Tracking** - Track score trends over time (Team plan)

## Usage

### Basic Usage

Add this workflow to `.github/workflows/aiready.yml`:

```yaml
name: AI Readiness Check

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: AI Readiness Check
        uses: getaiready/aiready-action@v1
        with:
          threshold: 70
          fail-on: critical
```

### With Historical Tracking (Team Plan)

```yaml
name: AI Readiness Check

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: AI Readiness Check
        uses: getaiready/aiready-action@v1
        with:
          threshold: 70
          fail-on: major
          upload-to-saas: true
          api-key: ${{ secrets.AIREADY_API_KEY }}
          repo-id: ${{ secrets.AIREADY_REPO_ID }}
```

### Using Local Action (Monorepo)

If you're using this from within the AIReady monorepo:

```yaml
- name: AI Readiness Check
  uses: ./.github/actions/aiready-check
  with:
    threshold: 70
```

## Inputs

| Input            | Description                                  | Required | Default                        |
| ---------------- | -------------------------------------------- | -------- | ------------------------------ |
| `directory`      | Directory to analyze                         | No       | `.`                            |
| `threshold`      | Minimum AI readiness score (0-100)           | No       | `70`                           |
| `fail-on`        | Fail on issues: `critical`, `major`, `any`   | No       | `critical`                     |
| `tools`          | Tools to run: `patterns,context,consistency` | No       | `patterns,context,consistency` |
| `upload-to-saas` | Upload to AIReady SaaS                       | No       | `false`                        |
| `api-key`        | AIReady API key                              | No       | -                              |
| `repo-id`        | Repository ID in SaaS                        | No       | -                              |

## Outputs

| Output     | Description                               |
| ---------- | ----------------------------------------- |
| `score`    | Overall AI readiness score (0-100)        |
| `passed`   | Whether the check passed (`true`/`false`) |
| `issues`   | Total number of issues found              |
| `critical` | Number of critical issues                 |
| `major`    | Number of major issues                    |

## Example Output

```
🚀 AIReady Check starting...
   Directory: .
   Threshold: 70
   Fail on: critical

📦 Running: npx @aiready/cli scan "." --tools patterns,context,consistency --output json

✅ AI Readiness Check passed with score 82/100
   Issues: 3 (2 major, 1 minor)
```

## What Gets Checked

### 🔍 Semantic Duplicate Detection

Finds code fragments that are semantically similar but syntactically different - confusing for AI models.

### 📦 Context Window Analysis

Measures the "context cost" of your imports and dependency chains.

### 🏷️ Naming Consistency

Detects inconsistent naming patterns across your codebase.

### 📊 Visualizations

Generates interactive graphs showing code relationships and problem areas.

## Requirements

- **Node.js**: 24+ (action uses Node 24 runtime)
- **Permissions**: Read access to repository contents

## Installation Alternatives

### npm CLI

```bash
npm install -g @aiready/cli
aiready scan . --threshold 70
```

### Docker

```bash
docker run --rm -v $(pwd):/workspace aiready/cli:latest
```

### npx (no install)

```bash
npx @aiready/cli scan .
```

## Pricing

| Plan           | Price    | Features                               |
| -------------- | -------- | -------------------------------------- |
| **Free**       | $0       | CLI, local analysis                    |
| **Team**       | $99/mo   | CI/CD integration, historical tracking |
| **Enterprise** | $299+/mo | Custom rules, SSO, dedicated support   |

Visit [getaiready.dev/pricing](https://getaiready.dev/pricing) for more details.

## Links

- 📚 [Documentation](https://getaiready.dev/docs)
- 🐛 [Report Bug](https://github.com/getaiready/aiready-cli/issues)
- 💡 [Request Feature](https://github.com/getaiready/aiready-cli/issues)
- 📦 [npm Package](https://www.npmjs.com/package/@aiready/cli)

## License

MIT © [AIReady](https://getaiready.dev)

---

_Made with ❤️ for the AI-assisted coding community_
