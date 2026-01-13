# @aiready/context-analyzer

> **AI context window cost analysis - Detect fragmented code, deep import chains, and expensive context budgets**

When AI tools try to help with your code, they need to load files into their context window. Fragmented code structures make this expensive and sometimes impossible. This tool analyzes your codebase to identify:

- Deep import chains that require loading dozens of files
- Fragmented modules scattered across many directories
- Low-cohesion files mixing unrelated concerns
- Files with excessive context budgets

## 🎯 Why This Tool?

### The AI Context Cost Problem

AI coding assistants are limited by context windows, but teams unknowingly structure code in ways that maximize context consumption:

```typescript
// Scattered user management across 8 files = 12,450 tokens
src/user/get.ts          // 850 tokens
src/api/user.ts          // 1,200 tokens  
src/services/user.ts     // 2,100 tokens
src/helpers/user.ts      // 900 tokens
src/utils/user.ts        // 750 tokens
src/lib/user-validation.ts   // 1,800 tokens
src/models/user.ts       // 2,100 tokens
src/types/user.ts        // 2,750 tokens

Result: AI hits context limit, gives incomplete answers ❌

// Consolidated into 2 cohesive files = 2,100 tokens  
src/user/user.ts         // 1,400 tokens (core logic)
src/user/types.ts        // 700 tokens (types)

Result: AI sees everything, gives complete answers ✅
```

### What Makes Us Different?

| Feature | madge | dependency-cruiser | @aiready/context-analyzer |
|---------|-------|-------------------|--------------------------|
| Focus | Circular dependencies | Dependency rules | AI context cost |
| Metrics | Graph visualization | Rule violations | Token cost, fragmentation |
| AI-Specific | ❌ No | ❌ No | ✅ Yes - quantifies AI impact |
| Cohesion Analysis | ❌ No | ❌ No | ✅ Yes - detects mixed concerns |
| Recommendations | Generic | Rule-based | AI context optimization |

**Recommended Workflow:**
- Use **dependency-cruiser** to enforce architecture rules (blocking)
- Use **@aiready/context-analyzer** to optimize for AI tools (advisory)
- Track improvements over time with SaaS tier

## 🚀 Installation

```bash
npm install -g @aiready/context-analyzer

# Or use directly with npx
npx @aiready/context-analyzer ./src
```

## 📊 Usage

### CLI

```bash
# Basic usage
aiready-context ./src

# Focus on specific concerns
aiready-context ./src --focus fragmentation
aiready-context ./src --focus cohesion  
aiready-context ./src --focus depth

# Set thresholds
aiready-context ./src --max-depth 5 --max-context 10000 --min-cohesion 0.6

# Export to JSON
aiready-context ./src --output json --output-file report.json

# Generate HTML report
aiready-context ./src --output html --output-file report.html

# Include/exclude patterns
aiready-context ./src --exclude "**/test/**,**/*.test.ts"
```

### Configuration

Create an `aiready.json` or `aiready.config.json` file in your project root:

```json
{
  "scan": {
    "include": ["**/*.{ts,tsx,js,jsx}"],
    "exclude": ["**/test/**", "**/*.test.*"]
  },
  "tools": {
    "context-analyzer": {
      "maxDepth": 4,
      "maxContextBudget": 8000,
      "minCohesion": 0.7,
      "includeNodeModules": false
    }
  }
}
```

### Sample Output

```bash
🔍 Analyzing context window costs...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONTEXT ANALYSIS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Files analyzed: 127
📊 Total tokens: 145,680
💰 Avg context budget: 1,147 tokens/file
⏱  Analysis time: 0.52s

⚠️  Issues Found:

   🔴 Critical: 3
   🟡 Major: 12
   🔵 Minor: 8

   💡 Potential savings: 28,450 tokens

📏 Deep Import Chains:

   Average depth: 3.2
   Maximum depth: 8

   → src/services/order.ts (depth: 8)
   → src/api/payment.ts (depth: 7)
   → src/lib/validation.ts (depth: 6)

🧩 Fragmented Modules:

   Average fragmentation: 42%

   ● user-management - 8 files, 67% scattered
     Token cost: 12,450, Cohesion: 45%
   ● order-processing - 12 files, 58% scattered
     Token cost: 18,200, Cohesion: 52%

🔀 Low Cohesion Files:

   Average cohesion: 68%

   ○ src/utils/helpers.ts (35% cohesion)
   ○ src/lib/shared.ts (42% cohesion)

💸 Most Expensive Files (Context Budget):

   ● src/services/order.ts - 8,450 tokens
   ● src/api/payment.ts - 6,200 tokens
   ● src/utils/helpers.ts - 5,100 tokens

💡 Top Recommendations:

   1. src/services/order.ts
      • Flatten dependency tree or use facade pattern
      • Split file by domain - separate unrelated functionality

   2. src/utils/helpers.ts
      • Very low cohesion (35%) - mixed concerns
      • Split file by domain - separate unrelated functionality

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💎 Want historical trends and refactoring plans? → aiready.dev/pro
💼 Enterprise: CI/CD integration → aiready.dev/demo
```

### Programmatic API

```typescript
import { analyzeContext, generateSummary } from '@aiready/context-analyzer';

// Analyze entire project
const results = await analyzeContext({
  rootDir: './src',
  maxDepth: 5,
  maxContextBudget: 10000,
  minCohesion: 0.6,
  maxFragmentation: 0.5,
});

// Generate summary
const summary = generateSummary(results);

console.log(`Total files: ${summary.totalFiles}`);
console.log(`Total tokens: ${summary.totalTokens}`);
console.log(`Avg context budget: ${summary.avgContextBudget}`);
console.log(`Critical issues: ${summary.criticalIssues}`);

// Find high-cost files
const expensiveFiles = results.filter(r => r.contextBudget > 5000);
console.log(`Files with >5000 token budgets: ${expensiveFiles.length}`);

// Find fragmented modules
const fragmented = summary.fragmentedModules.filter(m => m.fragmentationScore > 0.5);
console.log(`Highly fragmented modules: ${fragmented.length}`);

// Get refactoring recommendations
for (const result of results) {
  if (result.severity === 'critical') {
    console.log(`${result.file}:`);
    result.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
}
```

## 📊 Metrics Explained

### Import Depth
**What:** Maximum chain length of transitive dependencies  
**Impact:** Deeper chains = more files to load = higher context cost  
**Threshold:** >5 is concerning, >8 is critical  
**Fix:** Flatten dependency tree, use facade pattern, break circular deps

### Context Budget
**What:** Total tokens AI needs to load to understand this file  
**Impact:** Higher budget = more expensive AI assistance  
**Threshold:** >10,000 tokens often hits context limits  
**Fix:** Split files, reduce dependencies, extract interfaces

### Fragmentation Score
**What:** How scattered related code is across directories (0-100%)  
**Impact:** Higher = more files to load for domain understanding  
**Threshold:** >50% indicates poor organization  
**Fix:** Consolidate related code into cohesive modules

### Cohesion Score
**What:** How related exports are within a file (0-100%)  
**Impact:** Lower = mixed concerns = wasted context  
**Threshold:** <60% indicates low cohesion  
**Fix:** Split by domain, separate unrelated functionality

## 🎯 Configuration

### CLI Options

```bash
--max-depth <number>           # Maximum acceptable import depth (default: 5)
--max-context <number>         # Maximum acceptable context budget in tokens (default: 10000)
--min-cohesion <number>        # Minimum acceptable cohesion score 0-1 (default: 0.6)
--max-fragmentation <number>   # Maximum acceptable fragmentation 0-1 (default: 0.5)
--focus <type>                 # Analysis focus: fragmentation|cohesion|depth|all (default: all)
--include-node-modules         # Include node_modules in analysis (default: false)
--include <patterns>           # File patterns to include (comma-separated)
--exclude <patterns>           # File patterns to exclude (comma-separated)
-o, --output <format>          # Output format: console|json|html (default: console)
--output-file <path>           # Output file path (for json/html)
```

### Default Exclusions

By default, these patterns are excluded (unless `--include-node-modules` is used):
```bash
# Dependencies (excluded by default, override with --include-node-modules)
**/node_modules/**

# Build outputs
**/dist/**, **/build/**, **/out/**, **/output/**, **/target/**, **/bin/**, **/obj/**, **/cdk.out/**

# Framework-specific build dirs
**/.next/**, **/.nuxt/**, **/.vuepress/**, **/.cache/**, **/.turbo/**

# Test and coverage
**/coverage/**, **/.nyc_output/**, **/.jest/**

# Version control and IDE
**/.git/**, **/.svn/**, **/.hg/**, **/.vscode/**, **/.idea/**, **/*.swp, **/*.swo

# Build artifacts and minified files
**/*.min.js, **/*.min.css, **/*.bundle.js, **/*.tsbuildinfo

# Logs and temporary files
**/logs/**, **/*.log, **/.DS_Store
```

### API Options

```typescript
interface ContextAnalyzerOptions {
  rootDir: string;                    // Root directory to analyze
  maxDepth?: number;                  // Maximum acceptable import depth (default: 5)
  maxContextBudget?: number;          // Maximum acceptable token budget (default: 10000)
  minCohesion?: number;               // Minimum acceptable cohesion score (default: 0.6)
  maxFragmentation?: number;          // Maximum acceptable fragmentation (default: 0.5)
  focus?: 'fragmentation' | 'cohesion' | 'depth' | 'all'; // Analysis focus (default: 'all')
  includeNodeModules?: boolean;       // Include node_modules (default: false)
  include?: string[];                 // File patterns to include
  exclude?: string[];                 // File patterns to exclude
}
```

## 🔬 How It Works

### 1. Dependency Graph Builder
Parses imports and exports to build a complete dependency graph of your codebase.

### 2. Depth Calculator
Calculates maximum import chain depth using graph traversal, identifying circular dependencies.

### 3. Domain Classifier
Infers domains from export names (e.g., "user", "order", "payment") to detect module boundaries.

### 4. Fragmentation Detector
Groups files by domain and calculates how scattered they are across directories.

### 5. Cohesion Analyzer
Uses entropy to measure how related exports are within each file (low entropy = high cohesion).

### 6. Context Budget Calculator
Sums tokens across entire dependency tree to estimate AI context cost for each file.

## 🎨 Output Formats

### Console (Default)
Rich formatted output with colors, emojis, and actionable recommendations.

### JSON
Machine-readable output for CI/CD integration:

```json
{
  "summary": {
    "totalFiles": 127,
    "totalTokens": 145680,
    "avgContextBudget": 1147,
    "criticalIssues": 3,
    "majorIssues": 12,
    "totalPotentialSavings": 28450
  },
  "results": [
    {
      "file": "src/services/order.ts",
      "tokenCost": 2100,
      "importDepth": 8,
      "contextBudget": 8450,
      "severity": "critical",
      "recommendations": ["Flatten dependency tree"]
    }
  ]
}
```

### HTML
Shareable report with tables and visualizations. Perfect for stakeholders:

```bash
aiready-context ./src --output html --output-file context-report.html
```

## 🧭 Interactive Mode

For first-time users, enable interactive guidance to apply smart defaults and focus areas:

```bash
# Suggest excludes for common frameworks (Next.js, AWS CDK) and choose focus
aiready-context ./src --interactive
```

Interactive mode:
- Detects frameworks and recommends excludes (e.g., .next, cdk.out)
- Lets you choose focus areas: frontend, backend, or both
- Applies configuration without modifying your files

## 🔗 Integration

### CI/CD

```yaml
# .github/workflows/code-quality.yml
- name: Analyze context costs
  run: npx @aiready/context-analyzer ./src --output json --output-file context-report.json
  
- name: Check critical issues
  run: |
    CRITICAL=$(jq '.summary.criticalIssues' context-report.json)
    if [ $CRITICAL -gt 0 ]; then
      echo "❌ $CRITICAL critical context issues found"
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx @aiready/context-analyzer ./src --max-depth 6 --max-context 8000 --output json > /tmp/context.json
CRITICAL=$(jq '.summary.criticalIssues' /tmp/context.json)
if [ $CRITICAL -gt 0 ]; then
  echo "❌ Critical context issues detected. Fix before committing."
  exit 1
fi
```

### With Other Tools

```bash
# Run all quality checks
npm run lint                    # ESLint for code quality
npm run type-check             # TypeScript for type safety
dependency-cruiser src         # Architecture rules
aiready-context src            # AI context optimization
aiready-patterns src           # Duplicate pattern detection
```

## 💰 SaaS Features (Coming Soon)

### Free Tier (CLI)
✅ One-time snapshot analysis  
✅ All metrics and recommendations  
✅ JSON/HTML export

### Pro ($49/month)
📈 Historical trend tracking  
📊 Team benchmarks  
🎯 Automated refactoring plans (5/month)  
🔌 Integration API

### Enterprise (Custom Pricing)
🔄 CI/CD integration  
💰 AI usage correlation (show $ waste)  
⚙️ Custom rules engine  
👥 Team analytics  
🎯 Unlimited refactoring plans

**Want to track improvements over time?** Visit [aiready.dev](https://aiready.dev)

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/caopengau/aiready.git
cd aiready
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm --filter @aiready/context-analyzer test

# Dev mode (watch)
pnpm --filter @aiready/context-analyzer dev
```

## 📝 License

MIT © AIReady Team

## 🔗 Related Tools

- **[@aiready/pattern-detect](https://www.npmjs.com/package/@aiready/pattern-detect)** - Find semantic duplicate patterns
- **[@aiready/doc-drift](https://github.com/caopengau/aiready)** - Detect stale documentation
- **[@aiready/consistency](https://github.com/caopengau/aiready)** - Check naming consistency

---

**Made with ❤️ for AI-assisted development**

*Stop wasting context tokens on fragmented code.*
