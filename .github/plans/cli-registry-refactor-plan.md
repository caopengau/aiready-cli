# CLI Tool Registry & Contract Enforcement Plan

> **Objective:** Decouple the Unified CLI from hardcoded spoke integrations by introducing a Registry-Based Tool Architecture and strict runtime contract validation. This will ensure long-term stability and easier onboarding of new tools.

---

## 🎯 The Vision

Currently, `analyzeUnified` and `scoreUnified` contain hardcoded `if/else` logic for every single tool. Every new tool requires changes to core CLI files, increasing merge conflict risks and maintenance overhead.

The new architecture will utilize a **Tool Registry**:
```typescript
interface ToolProvider {
  id: ToolName;
  alias: string[]; // e.g., ['ai-signal', 'hallucination']
  analyze: (options: ScanOptions) => Promise<SpokeOutput>;
  score: (output: SpokeOutput) => ToolScoringOutput;
}
```

The CLI will simply iterate over registered tools, dramatically simplifying `packages/cli/src/index.ts` and `packages/cli/src/commands/scan.ts`.

---

## 🏗️ Implementation Phases

### Phase 1: Foundation & Types (`@aiready/core`)
- [ ] Define `ToolProvider` interface in `@aiready/core/src/types/contract.ts`.
- [ ] Upgrade `SpokeOutput` Zod schema to be strict and comprehensive.
- [ ] Create a centralized `ToolRegistry` class or registry array to hold provider definitions.

### Phase 2: Refactoring Spokes to Providers (Iterative)
*Convert existing tools into standard providers without changing their internal logic. This can be done one by one.*
- [ ] Create Provider wrapper for `@aiready/pattern-detect`.
- [ ] Create Provider wrapper for `@aiready/context-analyzer`.
- [ ] Create Provider wrapper for `@aiready/consistency`.
- [ ] Create Provider wrappers for remaining tools (`doc-drift`, `deps-health`, `ai-signal-clarity`, `agent-grounding`, `testability`, `change-amplification`).

### Phase 3: CLI Migration (`@aiready/cli`)
- [x] Refactor `analyzeUnified` to map over `ToolRegistry` instead of hardcoded blocks.
- [x] Refactor `scoreUnified` to use the `score` function from each `ToolProvider`.
- [x] Simplify `packages/cli/src/commands/scan.ts` by removing manual output mapping and relying on the strict contract.

### Phase 4: Integration Testing & CI Enforcement
- [x] Update `integration-tests/src/cli-integration.test.ts` to dynamically test all registered providers.
- [x] Update `.github/sub-instructions/adding-new-tool.md` to reflect the new registry approach.
- [ ] Add CI check to ensure every spoke package exports a valid `ToolProvider`.

---

## 📉 Progress Tracker

| Component / Tool | Provider Defined | Strict Schema Validated | Integrated in CLI | Status |
| :--- | :---: | :---: | :---: | :--- |
| **Foundation (Core)** | ✅ | ✅ | ✅ | Completed |
| `pattern-detect` | ✅ | ✅ | ✅ | Completed |
| `context-analyzer` | ✅ | ✅ | ✅ | Completed |
| `consistency` | ✅ | ✅ | ✅ | Completed |
| `doc-drift` | ✅ | ✅ | ✅ | Completed |
| `deps-health` | ✅ | ✅ | ✅ | Completed |
| `ai-signal-clarity` | ✅ | ✅ | ✅ | Completed |
| `agent-grounding` | ✅ | ✅ | ✅ | Completed |
| `testability-index` | ✅ | ✅ | ✅ | Completed |
| `change-amplification` | ✅ | ✅ | ✅ | Completed |

---

## 📝 Change Log

- **2026-03-06:** Document created to track the transition from hardcoded CLI integration to a scalable registry-based architecture.
