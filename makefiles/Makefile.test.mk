###############################################################################
# Makefile.test: Testing-related targets
###############################################################################
# Resolve this makefile's directory to allow absolute invocation
MAKEFILE_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
include $(MAKEFILE_DIR)/Makefile.shared.mk

.PHONY: test test-core test-pattern-detect test-watch test-coverage test-verify-cli test-contract test-integration \
	test-landing-e2e test-platform-e2e test-platform test-landing test-platform-e2e-local test-landing-e2e-local \
	test-visualizer test-vscode-extension test-downstream

test: ## Run tests for all packages (noninteractive)
	@$(call log_step,Running tests for all packages (noninteractive)...) 
	@if command -v turbo >/dev/null 2>&1; then \
		CI=1 turbo run test test-contract; \
	else \
		CI=1 $(PNPM) --no-interactive $(SILENT_PNPM) test; \
	fi
	@$(call log_success,All tests passed)

test-core: ## Run tests for core package only
	@$(call log_info,Running tests for @aiready/core...)
	@$(PNPM) --filter @aiready/core test
	@$(call log_success,Core tests passed)

test-pattern-detect: ## Run tests for pattern-detect package only
	@$(call log_info,Running tests for @aiready/pattern-detect...)
	@$(PNPM) --filter @aiready/pattern-detect test
	@$(call log_success,Pattern-detect tests passed)

test-watch: ## Run tests in watch mode
	@$(call log_info,Running tests in watch mode...)
	@$(PNPM) test --watch

test-coverage: ## Run tests with coverage report
	@$(call log_step,Running tests with coverage...)
	@$(PNPM) test --coverage
	@$(call log_success,Coverage report generated)

test-landing: ## Run unit tests for landing page
	@$(call log_info,Running tests for @aiready/landing...)
	@cd landing && $(PNPM) lint || $(call log_warning,Landing lint had errors - continuing anyway)
	@$(call log_success,Landing tests checked)

test-platform: ## Run unit tests for platform
	@$(call log_info,Running tests for @aiready/platform...)
	@cd platform && $(PNPM) test
	@$(call log_success,Platform unit tests passed)

test-contract: ## Run Spoke-to-Hub contract tests (Tier 1)
	@$(call log_step,Running Tier 1 Contract Tests...)
	@if command -v turbo >/dev/null 2>&1; then \
		CI=1 turbo run test:contract; \
	else \
		$(PNPM) -r exec -- vitest run contract.test.ts --passWithNoTests; \
	fi
	@$(call log_success,Tier 1 Contract Tests passed)

test-integration: ## Run monorepo integration tests (Tier 2)
	@$(call log_step,Running Tier 2 Integration Tests...)
	@$(PNPM) --filter @aiready/integration-tests test
	@$(call log_success,Tier 2 Integration Tests passed)

test-verify-cli: ## Run a smoke scan and verify CLI output
	@$(call log_step,Running CLI smoke test...)
	@# Ensure CLI is built first
	@$(PNPM) --filter @aiready/cli build
	@# Run scan on a small subdirectory
	@node ./packages/cli/dist/cli.js scan packages/cli/src || { $(call log_error,CLI scan failed); exit 1; }
	@$(call log_step,Verifying scan output...)
	@LATEST_REPORT=$$(ls -t packages/cli/src/.aiready/aiready-report-*.json | head -n1); \
	node ./scripts/verify-aiready-output.js "$$LATEST_REPORT" || { $(call log_error,Output verification failed); exit 1; }
	@$(call log_success,CLI smoke test passed)

test-landing-e2e: ## Run E2E tests for landing page
	@$(call log_step,Running landing page E2E tests...)
	@cd landing && CI=1 $(PNPM) exec playwright test --reporter=list
	@$(call log_success,Landing page E2E tests passed)

test-landing-e2e-local: ## Run landing E2E tests against local dev server
	@$(call log_step,Running landing E2E tests against local dev server...)
	@cd landing && CI=1 $(PNPM) exec playwright test --reporter=list
	@$(call log_success,Landing local E2E tests passed)

test-platform-e2e: ## Run Playwright E2E tests for platform against dev endpoint
	@$(call log_step,Running platform E2E tests against https://dev.platform.getaiready.dev...)
	@cd platform && CI=1 PLAYWRIGHT_TEST_BASE_URL=https://dev.platform.getaiready.dev $(PNPM) test:e2e
	@$(call log_success,Platform E2E tests passed)

test-platform-e2e-local: ## Run platform E2E tests against local dev server
	@$(call log_step,Running platform E2E tests against local server...)
	@cd platform && CI=1 $(PNPM) test:e2e
	@$(call log_success,Platform local E2E tests passed)

test-visualizer: ## Build and test the visualizer
	@$(call log_step,Verifying @aiready/visualizer...)
	@$(PNPM) --filter @aiready/visualizer run typecheck || { $(call log_error,Visualizer typecheck failed); exit 1; }
	@$(PNPM) --filter @aiready/visualizer build || { $(call log_error,Visualizer build failed); exit 1; }
	@$(PNPM) --filter @aiready/visualizer test || { $(call log_error,Visualizer tests failed); exit 1; }
	@$(call log_success,Visualizer verified)

test-vscode-extension: ## Compile the VS Code extension to ensure no breaking changes
	@$(call log_step,Verifying aiready (VS Code extension)...)
	@cd packages/vscode-extension && $(PNPM) install && $(PNPM) exec tsc --noEmit && $(PNPM) run compile || { $(call log_error,VS Code extension verification failed); exit 1; }
	@$(call log_success,VS Code extension verified)

test-downstream: ## Run all downstream verification tests (platform, visualizer, vscode-extension)
	@$(call log_step,Running DOWNSTREAM verification (safety check for hubs)...)
	@$(MAKE) test-platform || exit 1
	@$(MAKE) test-visualizer || exit 1
	@$(MAKE) test-vscode-extension || exit 1
	@$(MAKE) test-landing || exit 1
	@$(call log_success,All downstream services verified)
