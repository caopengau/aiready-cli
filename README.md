# @aiready/pattern-detect

> **Semantic duplicate pattern detection for AI-generated code**

When AI tools generate code without awareness of existing patterns in your codebase, you end up with semantically similar but syntactically different implementations. This tool finds those patterns and quantifies their cost.

## 🎯 Why This Tool?

### The AI Code Problem

AI coding assistants (GitHub Copilot, ChatGPT, Claude) generate functionally similar code in different ways because:
- No awareness of existing patterns in your codebase
- Different AI models have different coding styles
- Team members use AI tools with varying contexts
- AI can't see your full codebase (context window limits)

### What Makes Us Different?

| Feature | jscpd | @aiready/pattern-detect |
|---------|-------|------------------------|
| Detection Method | Byte-level exact matching | Semantic similarity |
| Pattern Types | Generic blocks | Categorized (API, validators, utils, etc.) |
| Token Cost | ❌ No | ✅ Yes - shows AI context waste |
| Refactoring Suggestions | ❌ Generic | ✅ Specific to pattern type |
| Output Formats | Text/JSON | Console/JSON/HTML with rich formatting |

## 🚀 Installation

```bash
npm install -g @aiready/pattern-detect

# Or use directly with npx
npx @aiready/pattern-detect ./src
```

## 📊 Usage

### CLI

```bash
# Basic usage
aiready-patterns ./src

# Adjust sensitivity
aiready-patterns ./src --similarity 0.9

# Only look at larger patterns
aiready-patterns ./src --min-lines 10

# Memory optimization for large codebases
aiready-patterns ./src --max-blocks 1000 --batch-size 200

# Export to JSON
aiready-patterns ./src --output json --output-file report.json

# Generate HTML report
aiready-patterns ./src --output html
```

### Programmatic API

```typescript
import { analyzePatterns, generateSummary } from '@aiready/pattern-detect';

const results = await analyzePatterns({
  rootDir: './src',
  minSimilarity: 0.85, // 85% similar
  minLines: 5,
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['**/*.test.ts', '**/node_modules/**'],
});

const summary = generateSummary(results);

console.log(`Found ${summary.totalPatterns} duplicate patterns`);
console.log(`Token cost: ${summary.totalTokenCost} tokens wasted`);
console.log(`Pattern breakdown:`, summary.patternsByType);
```

## 🔍 Real-World Example

### Before Analysis

Two API handlers that were written by AI on different days:

```typescript
// File: src/api/users.ts
app.get('/api/users/:id', async (request, response) => {
  const user = await db.users.findOne({ id: request.params.id });
  if (!user) {
    return response.status(404).json({ error: 'User not found' });
  }
  response.json(user);
});

// File: src/api/posts.ts
router.get('/posts/:id', async (req, res) => {
  const post = await database.posts.findOne({ id: req.params.id });
  if (!post) {
    res.status(404).send({ message: 'Post not found' });
    return;
  }
  res.json(post);
});
```

### Analysis Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PATTERN ANALYSIS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Files analyzed: 47
⚠  Duplicate patterns found: 23
💰 Token cost (wasted): 8,450

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PATTERNS BY TYPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 api-handler      12
✓  validator        8
🔧 utility          3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOP DUPLICATE PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 87% 🌐 api-handler
   src/api/users.ts:15
   ↔ src/api/posts.ts:22
   432 tokens wasted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CRITICAL ISSUES (>95% similar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● src/utils/validators.ts:15
  validator pattern 97% similar to src/utils/checks.ts (125 tokens wasted)
  → Consolidate validation logic into shared schema validators (Zod/Yup) (CRITICAL: Nearly identical code)
```

### Suggested Refactoring

Create a generic handler:

```typescript
// utils/apiHandler.ts
export const createResourceHandler = (resourceName: string, findFn: Function) => {
  return async (req: Request, res: Response) => {
    const item = await findFn({ id: req.params.id });
    if (!item) {
      return res.status(404).json({ error: `${resourceName} not found` });
    }
    res.json(item);
  };
};

// src/api/users.ts
app.get('/api/users/:id', createResourceHandler('User', db.users.findOne));

// src/api/posts.ts
router.get('/posts/:id', createResourceHandler('Post', database.posts.findOne));
```

**Result:** Reduced from 432 tokens to ~100 tokens in AI context.

## ⚙️ Configuration

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `minSimilarity` | Similarity threshold (0-1). Use 0.65 for Jaccard (default), 0.85+ for Levenshtein | `0.65` |
| `minLines` | Minimum lines to consider a pattern | `5` |
| `maxBlocks` | Maximum code blocks to analyze (prevents OOM) | `500` |
| `include` | File patterns to include | `['**/*.{ts,tsx,js,jsx,py,java}']` |
| `exclude` | File patterns to exclude | See below |

### Exclude Patterns (Default)

By default, these patterns are excluded:
```bash
**/node_modules/**
**/dist/**
**/build/**
**/.git/**
**/coverage/**
**/*.min.js
**/*.bundle.js
```

Override with `--exclude` flag:
```bash
# Exclude test files and generated code
aiready-patterns ./src --exclude "**/test/**,**/generated/**,**/__snapshots__/**"

# Add to defaults (comma-separated)
aiready-patterns ./src --exclude "**/node_modules/**,**/dist/**,**/build/**,**/*.spec.ts"
```

## 📈 Understanding the Output

### Severity Levels

- **CRITICAL (>95% similar)**: Nearly identical code - refactor immediately
- **MAJOR (>90% similar)**: Very similar - refactor soon
- **MINOR (>85% similar)**: Similar - consider refactoring

### Pattern Types

- **🌐 api-handler**: REST API endpoints, route handlers
- **✓ validator**: Input validation, schema checks
- **🔧 utility**: Pure utility functions
- **📦 class-method**: Class methods with similar logic
- **⚛️ component**: UI components (React, Vue, etc.)
- **ƒ function**: Generic functions

### Token Cost

Estimated tokens wasted when AI tools process duplicate code:
- Increases context window usage
- Higher API costs for AI-powered tools
- Slower analysis and generation
- More potential for AI confusion

## 🎓 Best Practices

1. **Run regularly**: Integrate into CI/CD to catch new duplicates early
2. **Start with high similarity**: Use `--similarity 0.9` to find obvious wins
3. **Focus on critical issues**: Fix >95% similar patterns first
4. **Use pattern types**: Prioritize refactoring by category (API handlers → validators → utilities)
5. **Export reports**: Generate HTML reports for team reviews

## ⚠️ Performance & Memory

### Algorithm Complexity

**Fast Mode (default)**: **O(B × C × T)** where:
- B = number of blocks
- C = average candidates per block (~100)  
- T = average tokens per block (~50)
- **Jaccard similarity** is O(T) instead of O(N²) Levenshtein
- **Default threshold: 0.65** (Jaccard scores 20-25% lower than Levenshtein)

**Exact Mode** (`--no-approx --no-fast-mode`): **O(B² × N²)** where:
- B = number of blocks
- N = average characters per block
- **Levenshtein similarity** - more accurate, much slower
- **Recommended threshold: 0.85+**
- **Not recommended for >100 files**

### Performance Benchmarks

| Repo Size | Blocks | Fast Mode | Exact Mode |
|-----------|--------|-----------|------------|
| Small (<100 files) | ~50 | <1s | ~10s |
| Medium (100-500 files) | ~500 | ~2s | ~8 min |
| Large (500+ files) | ~500 (capped) | ~2s | ~76 min |

**Example:** 828 code blocks → limited to 500 → **2.4s** (fast) vs **76 min** (exact)

### Tuning Options

```bash
# Default (fast Jaccard mode, 65% threshold - good balance)
aiready-patterns ./src

# Higher threshold for fewer, more similar matches
aiready-patterns ./src --similarity 0.75

# Lower threshold for more potential duplicates
aiready-patterns ./src --similarity 0.55

# Increase quality at cost of speed  
aiready-patterns ./src --no-fast-mode --max-comparisons 100000

# Exact mode with progress tracking (slowest, shows % and ETA)
aiready-patterns ./src --no-approx --no-fast-mode --stream-results --max-blocks 100

# Maximum speed (aggressive filtering)
aiready-patterns ./src --max-blocks 200 --min-shared-tokens 12

# Exact mode (slowest, most accurate)
aiready-patterns ./src --no-approx --no-fast-mode --max-comparisons 500000
```

**CLI Options:**
- `--stream-results` - Output duplicates as found (useful for long analysis)
- `--no-fast-mode` - Use Levenshtein instead of Jaccard (more accurate, much slower)
- `--no-approx` - Disable candidate filtering (enables progress % and ETA)
- `--max-comparisons N` - Cap total comparisons (default 50K)
- `--max-blocks N` - Limit blocks analyzed (default 500)

**Progress Indicators:**
- **Approx mode**: Shows blocks processed + duplicates found
- **Exact mode**: Shows % complete, ETA, and comparisons processed
- **Stream mode**: Prints each duplicate immediately when found

**Recommendations:**
- **< 100 files**: Use defaults, or try `--no-fast-mode` for higher accuracy
- **100-500 files**: Use defaults with fast mode (2-5s typical)
- **500-1000 files**: Use `--max-blocks 500 --min-lines 10` (~3-10s)
- **1000+ files**: Use `--max-blocks 300 --min-lines 15` or analyze by module
- **Slow analysis**: Add `--stream-results` to see progress in real-time

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
name: Pattern Detection

on: [pull_request]

jobs:
  detect-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npx @aiready/pattern-detect ./src --output json --output-file patterns.json
      - name: Check for critical issues
        run: |
          CRITICAL=$(jq '.summary.topDuplicates | map(select(.similarity > 0.95)) | length' patterns.json)
          if [ "$CRITICAL" -gt "0" ]; then
            echo "Found $CRITICAL critical duplicate patterns"
            exit 1
          fi
```

## 🤝 Contributing

We welcome contributions! This tool is part of the [AIReady](https://github.com/aiready/aiready) ecosystem.

## 📝 License

MIT - See LICENSE file

## 🔗 Related Tools (Coming Soon)

- **@aiready/context-analyzer** - Analyze token costs and context fragmentation
- **@aiready/doc-drift** - Track documentation freshness
- **@aiready/consistency** - Check naming pattern consistency

---

**Made with 💙 by the AIReady team** | [Docs](https://aiready.dev/docs) | [GitHub](https://github.com/aiready/aiready)
