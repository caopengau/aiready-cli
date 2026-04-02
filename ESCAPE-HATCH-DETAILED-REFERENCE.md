# Type Escape Hatch: Detailed Line-by-Line Reference

## 📍 CRITICAL FILES - Exact Locations

---

## File 1: report.ts (VS Code Extension)

**Path**: `apps/vscode-extension/src/utils/report.ts`  
**Escapes**: 10 `as any` + 15 `any` params = **25 total**  
**Priority**: 🔴 CRITICAL - Parse logic for AI results

### Lines with escape hatches:

#### Group 1: ai-signal-clarity property fallback (L211-213)

```typescript
// L211-213
(result as any)['ai-signal-clarity'] ||
  (result as any)['ai-signal'] ||
  (result as any)['aiSignalClarity'];
```

**Problem**: Multiple property names suggest schema versioning  
**Fix**: Create union type with all possible property names

#### Group 2: contract-enforcement fallback (L228-229)

```typescript
// L228-229
(result as any)['contract-enforcement'] ||
  (result as any)['contractEnforcement'];
```

**Problem**: Inconsistent naming between kebab-case and camelCase  
**Fix**: Normalize schema or create typed aliases

#### Group 3: Duplicate patterns in different function (L302-304)

```typescript
// L302-304 (identical to L211-213)
(result as any)['ai-signal-clarity'] ||
  (result as any)['ai-signal'] ||
  (result as any)['aiSignalClarity'];
```

#### Group 4: Duplicate pattern (L317-318)

```typescript
// L317-318 (identical to L228-229)
(result as any)['contract-enforcement'] ||
  (result as any)['contractEnforcement'];
```

#### Group 5: Parameter any types (15 more instances)

- Various callback functions and object destructuring patterns

**Recommended Fix**:

```typescript
type ToolResult<T = any> =
  | { 'ai-signal-clarity': T }
  | { 'ai-signal': T }
  | { aiSignalClarity: T }

type ContractResult<T = any> =
  | { 'contract-enforcement': T }
  | { contractEnforcement: T }

type UnifiedResult = ToolResult | ContractResult | /* ... others */

function getToolResult(result: UnifiedResult, tool: string) {
  // Type narrowing approach
}
```

---

## File 2: file-classifiers.ts (Context Analyzer)

**Path**: `packages/context-analyzer/src/classify/file-classifiers.ts`  
**Escapes**: **13 parameter `any` types** (in arrow functions)  
**Priority**: 🔴 CRITICAL - Core file classification logic

### Pattern appearing 8+ times:

```typescript
// L26: isPurelyReexports
const isPurelyReexports = exports.every((exp: any) => !!exp.source);

// L34: sources collection
const sources = new Set(exports.map((exp: any) => exp.source));

// L66: isConfigFile check
(exports || []).every((exp: any) =>
  // ...
)

// L89: type/interface filtering
(exp: any) => exp.type === 'type' || exp.type === 'interface'

// L127: factory function check
(exp: any) =>
  // complex condition
```

**All instances use same pattern**: `(exp: any) => exp.property`

**Root cause**: `exports` array type is unknown/dynamic  
**Solution**: Create proper `Export` interface

**Recommended Fix**:

```typescript
interface Export {
  type:
    | 'class'
    | 'interface'
    | 'type'
    | 'function'
    | 'default'
    | 'default-export'
    | 'reexport';
  name?: string;
  source?: string;
  // Add other properties as needed
}

// Replace all patterns with:
const isPurelyReexports = exports.every((exp: Export) => !!exp.source);

// Add type guard functions:
const isTypeExport = (exp: Export): exp is Export & { type: 'type' } =>
  exp.type === 'type';
const isInterfaceExport = (
  exp: Export
): exp is Export & { type: 'interface' } => exp.type === 'interface';
```

---

## File 3: GraphCanvas.tsx (Platform Visualization)

**Path**: `apps/platform/src/components/visualizer/GraphCanvas.tsx`  
**Escapes**: 2 `as any` casts + 22 `any` params = **24 total**  
**Priority**: 🔴 CRITICAL - D3.js visualization core

### Line 50: forceSimulation cast

```typescript
// L50 - D3 force simulation type incompatibility
.forceSimulation(nodes as any)
```

**Problem**: D3 accepts `d3.SimulationNodeDatum[]` but nodes have custom properties  
**Fix**: Ensure nodes extend `d3.SimulationNodeDatum`

### Line 129: event handler cast

```typescript
// L129 - Event handler typing
          .on('end', dragended) as any
```

**Problem**: D3 selection typing doesn't match event handler signature  
**Fix**: Create proper typed event handler wrapper

### Parameter `any` patterns (22 instances):

```typescript
// Event handlers with any params
(event: any, node: SimulationNode) => {
  // ...
};

// Callback handlers
(event: any) => {
  // ...
};
```

**Recommended Fix**:

```typescript
// Install types: npm install --save-dev @types/d3-force @types/d3-selection

import { Simulation, SimulationNodeDatum } from 'd3-force';
import { Selection } from 'd3-selection';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  // other properties
}

// Type event handlers properly:
const handleDragStarted = (
  event: D3DragEvent<any, GraphNode, any>,
  node: GraphNode
) => {
  // Now properly typed
};
```

---

## File 4: stripe/route.ts (Clawmore Webhooks)

**Path**: `apps/clawmore/app/api/webhooks/stripe/route.ts`  
**Escapes**: 9 `as any` + 6 `any` params = **15 total**  
**Priority**: 🔴 CRITICAL - Payment processing

### Line 26-27: Stripe initialization with type casts

```typescript
// L26-27
const stripe = new Stripe((Resource as any).StripeSecretKey.value, {
  apiVersion: '2025-01-27-acacia' as any,
});
```

**Problem**: SST Resource object not typed; Stripe apiVersion requires exact literal type  
**Fix**: Create Resource type interface and use `as const` not `as any`

### Line 142: GitHub token access

```typescript
// L142
const githubToken = (Resource as any).GithubServiceToken.value;
```

**Problem**: Unsafe property access  
**Fix**: Create Resource wrapper with type-safe getters

### Lines 173-177: Multiple Resource accesses in loop

```typescript
// L173-177
TelegramBotToken: (Resource as any).SpokeTelegramBotToken
MiniMaxApiKey: (Resource as any).SpokeMiniMaxApiKey.value,
OpenAIApiKey: (Resource as any).SpokeOpenAIApiKey.value,
GitHubToken: (Resource as any).SpokeGithubToken.value,
```

**Problem**: Repeated unsafe casts  
**Fix**: Extract to configuration function with proper typing

### Lines 276, 317: Invoice object casts

```typescript
// L276
const invoice = event.data.object as any;

// L317 (similar)
const invoice = event.data.object as any;
```

**Problem**: Stripe webhook object typing available directly  
**Fix**: Use Stripe's native `Stripe.Invoice` type

### Line 48: Catch error

```typescript
// L48
} catch (err: any) {
```

**Problem**: Should use `unknown`  
**Fix**: Change to `catch (err: unknown)`

**Recommended Fix**:

```typescript
// Create Resource interface
interface StripeResources {
  StripeSecretKey: { value: string };
  GithubServiceToken: { value: string };
  StripePrice?: { id: string };
  // ... other resources
}

// Type-safe getter
function getResourceValue<K extends keyof StripeResources>(
  resource: StripeResources,
  key: K
): string {
  const value = resource[key];
  return typeof value === 'string' ? value : value.value;
}

// Use in code
const stripe = new Stripe(getResourceValue(Resource, 'StripeSecretKey'), {
  apiVersion: '2025-01-27-acacia' as const, // use 'as const' for literal type
});
```

---

## File 5: typescript-adapter.ts (AST MCP Server)

**Path**: `packages/ast-mcp-server/src/adapters/typescript-adapter.ts`  
**Escapes**: **21 parameter `any` types**  
**Priority**: 🔴 CRITICAL - AST core, highest complexity

### Pattern: Visitor methods with `any` params (21 instances across file)

```typescript
// Multiple visitor patterns like:
visitNode(node: any) { }
visit(visitor: any) { }
// ... etc
```

**Root cause**: TypeScript AST nodes have deep inheritance hierarchy  
**Solution**: Import actual TypeScript AST types from `typescript` package

**Key AST Node Types Available**:

```typescript
import * as ts from 'typescript';

// Use discriminated union:
type ASTNode = ts.Declaration | ts.Statement | ts.Expression | ts.Type;
// ... others

// Or use generic constraint:
function visitNode<T extends ts.Node>(node: T): void {
  if (ts.isClassDeclaration(node)) {
    /* ... */
  }
  if (ts.isFunctionDeclaration(node)) {
    /* ... */
  }
}
```

**Recommended Strategy**:

1. Check which ts.\* types are actually used
2. Create discriminated union from those types
3. Replace all `(node: any)` with concrete types
4. Use `ts.isXXX()` guards for narrowing

**Example fix**:

```typescript
// Before
export function analyze(node: any): void {
  if (node.kind === 1) { /* function */ }
  if (node.kind === 2) { /* class */ }
}

// After
type AnalyzableNode = ts.FunctionDeclaration | ts.ClassDeclaration | /* ... */

export function analyze(node: AnalyzableNode): void {
  if (ts.isFunctionDeclaration(node)) { /* function */ }
  if (ts.isClassDeclaration(node)) { /* class */ }
}
```

---

## Quick Fix Priority Order

### Do First (Highest ROI):

1. **stripe/route.ts** - Payment critical, contained scope (~4h)
2. **report.ts** - AI signal parsing, quick wins (~3h)
3. **file-classifiers.ts** - Core logic, repeatable pattern (~3h)

### Do Second (Higher Complexity):

4. **GraphCanvas.tsx** - D3.js patterns, library dependent (~3h)
5. **typescript-adapter.ts** - AST complexity, highest effort (~6h)

---

## Test Coverage Mapping

For each file, check:

- `packages/contract-enforcement/src/__tests__/` - Detects your fixes
- `packages/ai-signal-clarity/src/__tests__/` - Verify no regression
- File-specific `__tests__/` or `.test.ts` siblings

---

## Commands to Validate Fixes

```bash
# Type check the specific file
tsc --noEmit apps/vscode-extension/src/utils/report.ts

# Run contract enforcement on changed files
pnpm contract-enforcement --files="apps/vscode-extension/src/utils/report.ts"

# Run AI signal clarity check
pnpm ai-signal-clarity --files="apps/vscode-extension/src/utils/report.ts"

# Full type check
cd /Users/pengcao/projects/aiready && tsc --noEmit
```

---

## Documentation to Update After Fixes

- Type definitions in `packages/core/src/` (if new types added)
- README in affected package if patterns are now exemplars
- This analysis doc if patterns change
