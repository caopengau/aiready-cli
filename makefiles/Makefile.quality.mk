###############################################################################
# Makefile.quality: Linting, formatting, and type-checking targets
###############################################################################
include makefiles/Makefile.shared.mk

.PHONY: \
	check-all fix \
	lint lint-fix format format-check \
	type-check type-check-all

# Dynamically generate leaf targets from ALL_SPOKES
# NOTE: Do NOT add these to .PHONY — GNU Make 3.81 breaks pattern rules when
# combined with .PHONY, causing "Nothing to be done" instead of running the recipe.
FORMAT_LEAF := $(foreach spoke,$(ALL_SPOKES),format-check-$(spoke))
FORMAT_FIX_LEAF := $(foreach spoke,$(ALL_SPOKES),format-$(spoke))
LINT_LEAF := $(foreach spoke,$(ALL_SPOKES),lint-$(spoke))
LINT_FIX_LEAF := $(foreach spoke,$(ALL_SPOKES),lint-fix-$(spoke))
TYPE_LEAF := $(foreach spoke,$(ALL_SPOKES),type-check-$(spoke))

# Combined quality checks
check-all: ## Run format-check, lint, and type-check across the repo
	@$(call log_step,Running format check on all packages...)
	@$(MAKE) $(MAKE_PARALLEL) $(FORMAT_LEAF) $(LINT_LEAF) $(TYPE_LEAF)
	@$(call log_success,All checks passed)

check: check-all ## Alias for check-all

# Combined quality fixes
fix: ## Run ESLint --fix and Prettier format
	@$(call log_step,Applying ESLint fixes and formatting...)
	@$(MAKE) lint-fix
	@$(MAKE) format
	@$(call log_success,Codebase fixed and formatted)

# Lint targets
lint: ## Run ESLint on all packages
	@$(call log_info,Running ESLint on all packages...)
	@if command -v turbo >/dev/null 2>&1; then \
		turbo run lint; \
	else \
		$(MAKE) $(MAKE_PARALLEL) $(LINT_LEAF); \
	fi
	@$(call log_success,All lint checks passed.)

lint-%:
	@$(call log_info,Linting $* (ESLint)...)
	@$(PNPM) $(SILENT_PNPM) --filter @aiready/$* lint
	@$(call log_success,$* lint passed)

# Lint fixes
lint-fix: ## Run ESLint --fix on all packages
	@$(call log_info,Auto-fixing lint issues on all packages...)
	@$(MAKE) $(MAKE_PARALLEL) $(LINT_FIX_LEAF)
	@$(call log_success,All lint fixes completed)

lint-fix-%:
	@$(call log_info,Auto-fixing lint issues ($*)...)
	@$(PNPM) $(SILENT_PNPM) --filter @aiready/$* exec eslint . --ext .ts --fix
	@$(call log_success,$* ESLint auto-fix completed)

# Format checks
format-check: ## Check formatting across all packages
	@$(call log_step,Checking formatting with Prettier...)
	@$(MAKE) $(MAKE_PARALLEL) $(FORMAT_LEAF)
	@$(call log_success,Formatting checks passed)

format-check-%:
	@$(call log_info,Checking formatting $*...)
	@$(PNPM) $(SILENT_PNPM) exec prettier --check ./packages/$* --ignore-path ./.prettierignore || { $(call log_error,$* formatting issues); exit 1; }

# Format fixes
format: ## Format all packages with Prettier
	@$(call log_step,Formatting code with Prettier...)
	@$(MAKE) $(MAKE_PARALLEL) $(FORMAT_FIX_LEAF)
	@$(call log_success,All packages formatted)

format-%:
	@$(call log_info,Formatting $*...)
	@$(PNPM) $(SILENT_PNPM) exec prettier --write ./packages/$* --ignore-path ./.prettierignore
	@$(call log_success,$* formatted)

# Type checking
type-check: ## Run TypeScript type-check on all packages
	@$(call log_step,Type-checking all packages...)
	@$(MAKE) $(MAKE_PARALLEL) $(TYPE_LEAF)
	@$(call log_success,All type checks passed)

type-check-%:
	@$(call log_info,Type-checking $*...)
	@$(PNPM) $(SILENT_PNPM) --filter @aiready/$* exec tsc --noEmit
	@$(call log_success,$* type-check passed)

type-check-all: type-check ## Alias for type-check
