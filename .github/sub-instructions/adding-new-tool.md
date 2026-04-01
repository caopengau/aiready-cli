# Adding a New Tool Sub-Instructions

Follow these steps to add a new analysis tool (spoke) to the AIReady monorepo.

---

### Step 1: Create Package Structure

```bash
mkdir -p packages/your-tool/src
```

---

### Step 2: Create `package.json`

```json
{
  "name": "@aiready/your-tool",
  "version": "0.1.0",
  "description": "Brief description of what this tool does",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "bin": {
    "aiready-yourtool": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup src/index.ts src/cli.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts src/cli.ts --format cjs,esm --dts --watch",
    "test": "vitest run",
    "lint": "eslint src",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@aiready/core": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "tsup": "^8.3.5"
  },
  "keywords": ["aiready", "your-keywords"],
  "license": "MIT"
}
```

---

### Step 3: Create `src/index.ts` (Analyzer)

```typescript
import { scanFiles, readFileContent } from '@aiready/core';
import type { AnalysisResult, Issue, ScanOptions } from '@aiready/core';

export interface YourToolOptions extends ScanOptions {
  // Your specific options
}

export async function analyzeYourTool(
  options: YourToolOptions
): Promise<AnalysisResult[]> {
  const files = await scanFiles(options);
  const results: AnalysisResult[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    // Your analysis logic here
  }

  return results;
}
```

---

### Step 4: Implement ToolProvider and Register with ToolRegistry

Every spoke must implement the `ToolProvider` interface and register with the global `ToolRegistry` so that it is automatically discovered by the unified CLI.

**Create `src/provider.ts`:**

```typescript
import {
  ToolProvider,
  ToolName,
  SpokeOutput,
  ScanOptions,
  ToolScoringOutput
} from '@aiready/core';
import { analyzeYourTool } from './analyzer';
import { calculateYourToolScore } from './scoring';

export const YourToolProvider: ToolProvider = {
  id: ToolName.YourToolID, // Add to ToolName enum in @aiready/core if new
  alias: ['your-alias'],

  async analyze(options: ScanOptions): Promise<SpokeOutput> {
    const result = await analyzeYourTool(options);
    return {
      results: result.results,
      summary: result.summary,
      metadata: { toolName: ToolName.YourToolID, version: '0.1.0' }
    };
  },

  score(output: SpokeOutput, options: ScanOptions): ToolScoringOutput {
    return calculateYourToolScore(output.summary, (options as any).costConfig);
  },

  defaultWeight: 10
};
```

**Register in `src/index.ts`:**

```typescript
import { ToolRegistry } from '@aiready/core';
import { YourToolProvider } from './provider';

// Register with global registry for automatic CLI discovery
ToolRegistry.register(YourToolProvider);

export { YourToolProvider };
// ... other exports
```

---

### Step 5: Create `src/cli.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { analyzeYourTool } from './index';
import chalk from 'chalk';

const program = new Command();

program
  .name('aiready-yourtool')
  .description('Description of your tool')
  .version('0.1.0')
  .argument('<directory>', 'Directory to analyze')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing...\n'));
    const results = await analyzeYourTool({ rootDir: directory });
    // Display results
  });

program.parse();
```

---

### Step 6: Create `tsconfig.json`

```json
{
  "extends": "../core/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

### Step 7: Create `README.md`

Document:

- What problem it solves
- Why it exists (vs alternatives)
- Installation
- Usage (CLI + programmatic)
- Configuration options

Use the architecture diagram from another spoke README as a template and mark `★ = YOU ARE HERE`.

---

### Step 8: Build and Test

```bash
make build
# or build only this package in watch mode:
pnpm --filter @aiready/your-tool dev
```

---

### Step 9: Publish (After Implementation)

```bash
# Commit and sync
git add .
git commit -m "feat: add @aiready/your-tool"
make push  # Syncs monorepo + all spoke repos

# Create GitHub repo for the spoke
gh repo create getaiready/aiready-your-tool --public

# Release first version
make release-one SPOKE=your-tool TYPE=minor
# ALWAYS re-release CLI after adding a new spoke:
make release-one SPOKE=cli TYPE=patch
```

---

### Step 10: Update doc-mapping.json

Add your new tool to `.github/doc-mapping.json` under `OSS_SPOKES`:

```json
"your-tool": "packages/your-tool/README.md"
```

Also update `copilot-instructions.md` and `GEMINI.md` package tables.
