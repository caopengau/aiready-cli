# Quick Start: Type Escape Hatch Fixes

## 🎯 Top 5 Priority Files to Fix (in order)

### 1️⃣ **typescript-adapter.ts** ⭐ HIGHEST COMPLEXITY BUT HIGHEST IMPACT

```
File: packages/ast-mcp-server/src/adapters/typescript-adapter.ts
Escape Hatches: 21 parameter 'any' types
Affected: AST MCP server core functionality
Effort: 4-6 hours
Impact: +3 scoring points
```

**Action**: Replace all `(node: any)`, `(visitor: any)` with discriminated union types

---

### 2️⃣ **report.ts** ⭐ MODERATE COMPLEXITY, GOOD IMPACT

```
File: apps/vscode-extension/src/utils/report.ts
Escape Hatches: 10 'as any' casts + 15 parameter 'any' types (25 total)
Lines: L211-213, L228-229, L302-304, L317-318
Affected: VS Code extension report parsing
Effort: 2-3 hours
Impact: +2 scoring points
```

**Action**: Create union type for all report result shapes with typed accessors

---

### 3️⃣ **file-classifiers.ts** ⭐ QUICK WIN, CORE LOGIC

```
File: packages/context-analyzer/src/classify/file-classifiers.ts
Escape Hatches: 13 parameter 'any' types (in 8+ arrow functions)
Pattern: (exp: any) => exp.type === 'type'
Affected: File classification for dependency analysis
Effort: 2-3 hours
Impact: +2 scoring points
```

**Action**: Create `Export` interface and type guard functions

---

### 4️⃣ **stripe/route.ts** ⭐ PAYMENT CRITICAL

```
File: apps/clawmore/app/api/webhooks/stripe/route.ts
Escape Hatches: 9 'as any' casts + 6 parameter 'any' types (15 total)
Lines: L26-27, L142, L173-177, L276, L317
Affected: Payment processing webhooks
Effort: 3-4 hours
Impact: +2 scoring points
```

**Action**: Create Resource type wrappers, use Stripe's native types

---

### 5️⃣ **GraphCanvas.tsx** ⭐ VISUALIZATION CORE

```
File: apps/platform/src/components/visualizer/GraphCanvas.tsx
Escape Hatches: 2 'as any' casts + 22 parameter 'any' types (24 total)
Lines: L50 (forceSimulation), L129 (event handler)
Affected: Force-directed graph visualization
Effort: 2-3 hours
Impact: +2 scoring points
```

**Action**: Install proper d3 TypeScript types (@types/d3-force, @types/d3-selection)

---

## 📋 Quick Reference: All High-Priority Files

### 🔴 CRITICAL (Fix First)

| #   | File                  | Escapes | Type         | Effort |
| --- | --------------------- | ------- | ------------ | ------ |
| 1   | typescript-adapter.ts | 21      | `any` params | 5h     |
| 2   | report.ts             | 25      | mixed        | 3h     |
| 3   | file-classifiers.ts   | 13      | `any` params | 3h     |
| 4   | stripe/route.ts       | 15      | mixed        | 4h     |
| 5   | GraphCanvas.tsx       | 24      | mixed        | 3h     |

### 🟠 HIGH (Secondary)

| File                 | Escapes | Type         | Effort |
| -------------------- | ------- | ------------ | ------ |
| report-formatter.ts  | 14      | `any` params | 2h     |
| consistency.ts       | 12      | `any` params | 2h     |
| processors.ts        | 11      | `any` params | 2h     |
| cli.ts (consistency) | 11      | `any` params | 2h     |
| scan.ts (landing)    | 11      | `any` params | 2h     |
| cli-action.ts        | 10      | `any` params | 2h     |

### 🟡 MEDIUM (Error handling - EASY WINS)

- ~50 `catch (error: any)` → `catch (error: unknown)` replacements across codebase
- Effort: 1 hour total
- Impact: +1 scoring point

---

## 🚀 PR Template for Each Fix

```markdown
# Fix: Remove type escape hatches from [FILE]

## Problem

[FILE] contains [N] type escape hatches:

- [Count] parameter `any` types
- [Count] `as any` casts
- [Count] `Record<string, any>` patterns

This impacts contract-enforcement scoring and reduces AI signal clarity.

## Solution

1. Created typed interfaces/unions for [pattern]
2. Replaced unsafe casts with proper typing
3. Added type guard functions for [use case]

## Testing

- ✅ `tsc --noEmit` passes (no new type errors)
- ✅ Related tests updated
- ✅ contract-enforcement scoring improved by ~[X] points
- ✅ ai-signal-clarity unaffected

## Files Changed

- [FILE]
- [TEST FILE] (if updated)

## Before/After

### Before

\`\`\`typescript
function analyze(exp: any) {
if (exp.type === 'class') { ... }
}
\`\`\`

### After

\`\`\`typescript
interface Export { type: 'class' | 'interface' | ... }
function isClassExport(exp: Export): exp is { type: 'class' } { ... }
function analyze(exp: Export) { ... }
\`\`\`
```

---

## 💡 Common Patterns & Fixes

### Pattern 1: Callback Parameters

**Before**:

```typescript
exports.forEach((exp: any) => {
  if (exp.type === 'class') { ... }
})
```

**After**:

```typescript
interface Export { type: string; /* other props */ }
exports.forEach((exp: Export) => {
  if (exp.type === 'class') { ... }
})
```

### Pattern 2: Error Handling (QUICK WIN)

**Before**:

```typescript
catch (error: any) {
  console.error(error.message)
}
```

**After**:

```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
}
```

### Pattern 3: Discriminated Union

**Before**:

```typescript
function process(result: any) {
  if (result['ai-signal-clarity']) { ... }
  if (result.aiSignalClarity) { ... }
}
```

**After**:

```typescript
type ReportResult =
  | { 'ai-signal-clarity': AiSignalType }
  | { aiSignalClarity: AiSignalType };

function process(result: ReportResult) {
  // Now properly typed
}
```

### Pattern 4: Type Guards for External APIs

**Before**:

```typescript
const stripe = new Stripe((Resource as any).StripeSecretKey.value, {
  apiVersion: '2025-01-27-acacia' as any,
});
```

**After**:

```typescript
interface ResourceConfig {
  StripeSecretKey: { value: string };
  // ... other properties
}

const getStripeKey = (resources: ResourceConfig): string => {
  return resources.StripeSecretKey.value;
};

const stripe = new Stripe(getStripeKey(Resource), {
  apiVersion: '2025-01-27-acacia' as const, // Use 'as const' not 'as any'
});
```

---

## ✅ Verification Checklist Before Committing

- [ ] `tsc --noEmit` passes locally
- [ ] No new ESLint errors
- [ ] Related test suite passes
- [ ] Run: `pnpm contract-enforcement` on modified file
- [ ] Run: `pnpm ai-signal-clarity` for regression check
- [ ] Escape hatchs reduced by published count
- [ ] PR description documents pattern and fix

---

## 📊 Scoring Impact Summary

**Completing all 5 critical files**:

- +2 to +3 points per file
- Total: **+12-15 points possible**
- Realistic (conservative): **+8-10 points**

**Easy wins** (error handling):

- +1 point for ~1 hour of work

---

## 🔗 Related Commands

```bash
# Check type errors before fixing
tsc --noEmit packages/ast-mcp-server/src/adapters/typescript-adapter.ts

# Test a specific file
pnpm test packages/context-analyzer/src/classify/file-classifiers.ts

# Run contract enforcement
pnpm contract-enforcement

# Full scan on a directory
pnpm ai-signal-clarity packages/context-analyzer
```

---

## 📞 When You Get Stuck

1. **Check existing patterns**: Search codebase for similar fixes
2. **Look at types from lib**: Many interfaces already exist in `core/src`
3. **Use discriminated unions**: Almost always the right choice over `any`
4. **Ask TypeScript**: Let the compiler guide you - remove `as any`, fix the errors
