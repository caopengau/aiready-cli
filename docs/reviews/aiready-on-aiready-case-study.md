# Case Study: AIReady on AIReady

**Date:** March 26, 2026
**Repository:** `getaiready/aiready-cli` (Monorepo)
**Goal:** Assess and improve the AI-readiness of the tool that measures AI-readiness.

## 📊 Summary of Findings

| Metric                | Score  | Key Insights                                                                                            |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| **AI Signal Clarity** | 85/100 | Good usage of named constants, but documentation for public exports is inconsistent.                    |
| **Agent Grounding**   | 95/100 | Strong directory structure and naming conventions; agents can navigate easily.                          |
| **Testability Index** | 56/100 | The monorepo has complex inter-dependencies that make unit testing individual modules difficult for AI. |

### Total Issues Found: 4,483

- 🔴 **Critical:** 0
- 🟡 **Major:** 231
- 🔵 **Minor/Info:** 4,252

---

## 🔍 Deep Dive: Top Issues

### 1. The "Magic Literal" Problem (AI Signal Clarity)

**Finding:** Over 3,000 minor issues related to magic strings and numbers.
**Example:** `vitest.base.config.ts` uses literal strings like `"v8"`, `"text"`, and `"json"`.
**AI Impact:** When an AI model generates a test or a refactor, it might misinterpret these literals without a named constant explaining the context.
**Fix:** Consolidate these into a `Constants.ts` file within each package.

### 2. Documentation Gap

**Finding:** Many public functions lack docstrings.
**Example:** `createAireadyVitestAliases` in `vitest-aliases.ts`.
**AI Impact:** AI models "fabricate" behavior based on the function name alone. If the name is slightly ambiguous, the AI will make incorrect assumptions about parameters and side effects.
**Fix:** Apply `@aiready/remediation-swarm` to automatically generate TSDoc comments for all exported functions.

### 3. Testability & Dependency Coupling

**Finding:** Low Testability Score (56/100).
**Insight:** The `packages/consistency` package has high coupling with `naming-constants.ts`, leading to 346 detected issues in a single file.
**AI Impact:** An AI agent trying to fix a bug in naming consistency would need to load 5+ files into its context window, potentially exceeding token limits or losing focus.
**Fix:** Decouple naming rules from the core analysis engine using a plugin-based architecture.

---

## 🚀 ROI Prediction: The "Navigation Tax"

By addressing the **Agent Grounding** and **Testability** issues, we estimate:

- **Reduced AI Token Waste:** -22% (by reducing the number of files an agent needs to "read" to understand a change).
- **Faster PR Reviews:** AI-generated summaries will be 15% more accurate due to better documentation.
- **Estimated Monthly Savings:** ~$450/dev (based on average AI assistant token usage and developer time).

---

## 🛠️ Action Plan (Next 30 Days)

1.  **Phase 1:** Auto-remediate Documentation for `@aiready/core` (using `aiready fix`).
2.  **Phase 2:** Refactor `packages/consistency` to improve the Testability Index.
3.  **Phase 3:** Re-scan and publish updated "Readiness Scorecard".

---

**"Your code is AI-ready. Is it?"**
Run your own scan: `npx @aiready/cli scan .`
Full report available at: [platform.getaiready.dev](https://platform.getaiready.dev)
