# Contract & Type Tightening Plan

> **Objective:** Standardize core types (Enums) and validation (Zod) across the AIReady ecosystem (Spokes, CLI, VS Code, Visualizer, and Platform) to prevent breaking changes and improve maintainability.

---

## 🏗️ Strategy: Iterative Rollout

This work is divided into "Rounds" to ensure stability and allow for feedback at each stage.

### Round 1: The Foundation (@aiready/core)
- [x] **Centralize Enums:**
    - [x] `IssueType` (e.g., `duplicate-pattern`, `context-fragmentation`)
    - [x] `Severity` (`critical`, `major`, `minor`, `info`)
    - [x] `AnalysisStatus` (`processing`, `completed`, `failed`)
    - [x] `ModelTier` (`compact`, `frontier`, etc.)
- [x] **Define Zod Schemas:**
    - [x] `ZodLocation`
    - [x] `ZodIssue`
    - [x] `ZodMetrics`
    - [x] `ZodAnalysisResult`
    - [x] `ZodSpokeOutput` (Standard for all tool outputs)
    - [x] `ZodUnifiedReport` (Master contract for Platform/CLI)

### Round 2: Spoke & CLI Migration
- [ ] **Update Spokes (Tier 1):**
    - [ ] `@aiready/pattern-detect`
    - [ ] `@aiready/context-analyzer`
    - [ ] `@aiready/consistency`
    - [ ] *Other spokes...*
- [ ] **Update `@aiready/cli` (Tier 2):**
    - [ ] Use Zod for aggregating and validating unified reports.
    - [ ] Standardize internal scoring logic with new Enums.

### Round 3: The Consumers (Visualizer & Platform)
- [ ] **Update `@aiready/visualizer`:**
    - [ ] Migrate `GraphBuilder` to use shared Zod schemas for parsing reports.
- [ ] **Update `@aiready/platform`:**
    - [ ] Update API route handlers to validate incoming reports with Zod.
    - [ ] Synchronize DynamoDB types with core Enums.

### Round 4: IDE & Advanced Integration
- [ ] **Update `vscode-extension`:**
    - [ ] Ensure tree views and decorators use standardized Enums.
- [ ] **Enhance Integration Tests:**
    - [ ] Add "Schema Drift" tests that check for compatibility between CLI and Platform.

---

## 📈 Progress Tracker

| Package | Enums | Zod Schemas | Tests Updated | Status |
| :--- | :---: | :---: | :---: | :--- |
| **@aiready/core** | ✅ | ✅ | ✅ | Completed |
| **@aiready/cli** | ✅ | ✅ | ✅ | Completed |
| **pattern-detect** | ✅ | ✅ | ✅ | Completed |
| **context-analyzer** | ✅ | ✅ | ✅ | Completed |
| **consistency** | ✅ | ✅ | ✅ | Completed |
| **visualizer** | ⏳ | ⏳ | ⏳ | Not Started |
| **platform** | ⏳ | ⏳ | ⏳ | Not Started |
| **vscode-extension** | ⏳ | ⏳ | ⏳ | Not Started |

---

## 📝 Change Log

- **2026-03-06:** Initial plan created. Identified Enums for `Severity`, `IssueType`, and `AnalysisStatus`.
