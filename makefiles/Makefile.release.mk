###############################################################################
# Makefile.release: One-command release orchestrator & deployment integration
#
# Automates deployment workflows combined with tests:
# - Release to staging endpoints (release-dev)
#
# Automates per-spoke release steps:
# - Version bump (patch/minor/major)
# - Commit package.json change
# - Create annotated git tag
# - Build + publish to npm (pnpm)
# - Sync GitHub spoke repo via subtree split
# - Push monorepo branch and tags
#
# Usage examples:
#   make release-one SPOKE=pattern-detect TYPE=minor
#   make release-one SPOKE=core TYPE=patch
#   make release-all TYPE=minor
#   make release-status

# Internal helper for parallel publishing (called by release-all)
.PHONY: release-spoke-%
release-spoke-%:
	@$(call log_info,Releasing spoke @aiready/$*...); \
	$(MAKE) npm-publish SPOKE=$* || exit 1; \
	$(MAKE) publish SPOKE=$* OWNER=$(OWNER) || exit 1; \
	$(call log_success,Released @aiready/$*)

#
# Notes:
# - Always uses pnpm for publish to resolve workspace:* dependencies
# - Tags use the form: <spoke>-v<version> (e.g., pattern-detect-v0.3.0)
# - Requires npm login for publish
###############################################################################

# Resolve this makefile's directory to allow absolute invocation
MAKEFILE_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
ROOT_DIR := $(abspath $(MAKEFILE_DIR)/..)
include $(MAKEFILE_DIR)/Makefile.shared.mk
include $(MAKEFILE_DIR)/Makefile.publish.mk

.PHONY: check-changes check-dependency-updates check-dependency-updates release-one release-all release-dev release-status \
	release-landing release-platform version-landing-patch version-landing-minor version-landing-major \
	version-platform-patch version-platform-minor version-platform-major help

# Default owner and branch (can be overridden)
OWNER ?= caopengau
TARGET_BRANCH ?= main
LANDING_DIR := $(ROOT_DIR)/landing
PLATFORM_DIR := $(ROOT_DIR)/platform

# Internal helper: resolve version bump target name from TYPE
define bump_target_for_type
$(if $(filter $(1),patch),version-patch,$(if $(filter $(1),minor),version-minor,$(if $(filter $(1),major),version-major,)))
endef

# Internal: commit + tag for a spoke after version bump
define commit_and_tag
	version=$$(node -p "require('$(ROOT_DIR)/packages/$(SPOKE)/package.json').version"); \
	$(call log_step,Committing @aiready/$(SPOKE) v$$version...); \
	cd $(ROOT_DIR) && git add packages/$(SPOKE)/package.json; \
	cd $(ROOT_DIR) && git commit -m "chore(release): @aiready/$(SPOKE) v$$version"; \
	tag_name="$(SPOKE)-v$$version"; \
	$(call log_step,Tagging $$tag_name...); \
	cd $(ROOT_DIR) && git tag -f -a "$$tag_name" -m "Release @aiready/$(SPOKE) v$$version"; \
	$(call log_success,Committed and tagged $$tag_name)
endef

# Internal: commit + tag for landing after version bump
define commit_and_tag_landing
	version=$$(node -p "require('$(LANDING_DIR)/package.json').version"); \
	$(call log_step,Committing @aiready/landing v$$version...); \
	cd $(ROOT_DIR) && git add landing/package.json; \
	cd $(ROOT_DIR) && git commit -m "chore(release): @aiready/landing v$$version"; \
	tag_name="landing-v$$version"; \
	$(call log_step,Tagging $$tag_name...); \
	cd $(ROOT_DIR) && git tag -a "$$tag_name" -m "Release @aiready/landing v$$version"; \
	$(call log_success,Committed and tagged $$tag_name)
endef

# Internal: commit + tag for platform after version bump
define commit_and_tag_platform
	version=$$(node -p "require('$(PLATFORM_DIR)/package.json').version"); \
	$(call log_step,Committing @aiready/platform v$$version...); \
	cd $(ROOT_DIR) && git add platform/package.json; \
	cd $(ROOT_DIR) && git commit -m "chore(release): @aiready/platform v$$version"; \
	tag_name="platform-v$$version"; \
	$(call log_step,Tagging $$tag_name...); \
	cd $(ROOT_DIR) && git tag -a "$$tag_name" -m "Release @aiready/platform v$$version"; \
	$(call log_success,Committed and tagged $$tag_name)
endef

# Internal: tag platform dev release (no version bump commit)
define tag_platform_dev
	version=$$(node -p "require('$(PLATFORM_DIR)/package.json').version"); \
	tag_name="platform-dev-v$$version"; \
	$(call log_step,Tagging dev release $$tag_name...); \
	cd $(ROOT_DIR) && git tag -f -a "$$tag_name" -m "Dev release @aiready/platform v$$version"; \
	$(call log_success,Tagged $$tag_name)
endef

# Internal: tag landing dev release
define tag_landing_dev
	version=$$(node -p "require('$(LANDING_DIR)/package.json').version"); \
	tag_name="landing-dev-v$$version"; \
	$(call log_step,Tagging dev release $$tag_name...); \
	cd $(ROOT_DIR) && git tag -f -a "$$tag_name" -m "Dev release @aiready/landing v$$version"; \
	$(call log_success,Tagged $$tag_name)
endef

##@ Landing Version Management

version-landing-patch: ## Bump landing version (patch)
	@$(call log_step,Bumping @aiready/landing version (patch)...)
	@cd $(LANDING_DIR) && npm version patch --no-git-tag-version
	@$(call log_success,Landing version bumped to $$(node -p "require('$(LANDING_DIR)/package.json').version"))

version-landing-minor: ## Bump landing version (minor)
	@$(call log_step,Bumping @aiready/landing version (minor)...)
	@cd $(LANDING_DIR) && npm version minor --no-git-tag-version
	@$(call log_success,Landing version bumped to $$(node -p "require('$(LANDING_DIR)/package.json').version"))

version-landing-major: ## Bump landing version (major)
	@$(call log_step,Bumping @aiready/landing version (major)...)
	@cd $(LANDING_DIR) && npm version major --no-git-tag-version
	@$(call log_success,Landing version bumped to $$(node -p "require('$(LANDING_DIR)/package.json').version"))

##@ Platform Version Management

version-platform-patch: ## Bump platform version (patch)
	@$(call log_step,Bumping @aiready/platform version (patch)...)
	@cd $(PLATFORM_DIR) && npm version patch --no-git-tag-version
	@$(call log_success,Platform version bumped to $$(node -p "require('$(PLATFORM_DIR)/package.json').version"))

version-platform-minor: ## Bump platform version (minor)
	@$(call log_step,Bumping @aiready/platform version (minor)...)
	@cd $(PLATFORM_DIR) && npm version minor --no-git-tag-version
	@$(call log_success,Platform version bumped to $$(node -p "require('$(PLATFORM_DIR)/package.json').version"))

version-platform-major: ## Bump platform version (major)
	@$(call log_step,Bumping @aiready/platform version (major)...)
	@cd $(PLATFORM_DIR) && npm version major --no-git-tag-version
	@$(call log_success,Platform version bumped to $$(node -p "require('$(PLATFORM_DIR)/package.json').version"))

##@ Landing Release

release-landing: ## Release landing page: TYPE=patch|minor|major
	@if [ -z "$(TYPE)" ]; then \
		$(call log_error,TYPE parameter required. Usage: make $@ TYPE=minor); \
		exit 1; \
	fi
	@bump_target="version-landing-$(TYPE)"; \
	if [ "$(TYPE)" != "patch" ] && [ "$(TYPE)" != "minor" ] && [ "$(TYPE)" != "major" ]; then \
		$(call log_error,Invalid TYPE '$(TYPE)'. Expected patch|minor|major); \
		exit 1; \
	fi; \
	$(MAKE) -C $(ROOT_DIR) $$bump_target; \
	$(call log_success,Version bump complete for @aiready/landing); \
	$(call commit_and_tag_landing); \
	$(call log_step,Running landing tests before release...); \
	$(MAKE) -C $(ROOT_DIR) test-landing || exit 1; \
	$(MAKE) -C $(ROOT_DIR) test-landing-e2e-local || exit 1; \
	$(call log_step,Building landing page...); \
	cd $(LANDING_DIR) && pnpm build || { \
		$(call log_error,Build failed for @aiready/landing. Aborting release.); \
		exit 1; \
	}; \
	$(call log_success,Build complete); \
	$(call log_step,Deploying to production...); \
	$(MAKE) -C $(ROOT_DIR) deploy-landing-prod || { \
		$(call log_error,Production deployment failed. Aborting release.); \
		$(call log_warning,Version was bumped and tagged locally. Run 'git reset --hard HEAD~1 && git tag -d landing-v'$$(node -p "require('$(LANDING_DIR)/package.json').version") to undo.); \
		exit 1; \
	}; \
	$(call log_success,Production deployment complete); \
	$(call log_step,Verifying deployment...); \
	$(MAKE) -C $(ROOT_DIR) landing-verify VERIFY_RETRIES=3 VERIFY_WAIT=10 || { \
		$(call log_warning,Deployment verification timed out - CloudFront may still be propagating); \
		$(call log_info,Continuing with release - check deployment status with: make landing-verify); \
	}; \
	$(call log_step,Syncing landing to GitHub sub-repo...); \
	$(MAKE) -C $(ROOT_DIR) publish-landing OWNER=$(OWNER); \
	$(call log_step,Pushing monorepo branch and tags...); \
	cd $(ROOT_DIR) && git push origin $(TARGET_BRANCH) --follow-tags; \
	$(call log_success,Release finished for @aiready/landing)

##@ Platform Release

release-platform: ## Release platform: TYPE=patch|minor|major
	@if [ -z "$(TYPE)" ]; then \
		$(call log_error,TYPE parameter required. Usage: make $@ TYPE=minor); \
		exit 1; \
	fi
	@bump_target="version-platform-$(TYPE)"; \
	if [ "$(TYPE)" != "patch" ] && [ "$(TYPE)" != "minor" ] && [ "$(TYPE)" != "major" ]; then \
		$(call log_error,Invalid TYPE '$(TYPE)'. Expected patch|minor|major); \
		exit 1; \
	fi; \
	$(MAKE) -C $(ROOT_DIR) $$bump_target; \
	$(call log_success,Version bump complete for @aiready/platform); \
	$(call commit_and_tag_platform); \
	$(call log_step,Running fullest range of tests for platform production release...); \
	$(MAKE) -C $(ROOT_DIR) build || exit 1; \
	CI=1 $(MAKE) -C $(ROOT_DIR) test || exit 1; \
	CI=1 $(MAKE) -C $(ROOT_DIR) test-contract || exit 1; \
	CI=1 $(MAKE) -C $(ROOT_DIR) test-integration || exit 1; \
	CI=1 $(MAKE) -C $(ROOT_DIR) test-verify-cli || exit 1; \
	CI=1 $(MAKE) -C $(ROOT_DIR) test-platform || exit 1; \
	CI=1 $(MAKE) -C $(ROOT_DIR) test-platform-e2e-local || exit 1; \
	$(call log_step,Building and deploying platform to production...); \
	$(MAKE) -C $(ROOT_DIR) deploy-platform-prod || { \
		$(call log_error,Production deployment failed. Aborting release.); \
		$(call log_warning,Version was bumped and tagged locally. Run 'git reset --hard HEAD~1 && git tag -d platform-v'$$(node -p "require('$(PLATFORM_DIR)/package.json').version") to undo.); \
		exit 1; \
	}; \
	$(call log_success,Platform production deployment complete); \
	$(call log_step,Verifying deployment...); \
	$(MAKE) -C $(ROOT_DIR) platform-verify || { \
		$(call log_warning,Deployment verification failed - platform may still be deploying); \
	}; \
	$(call log_step,Pushing monorepo branch and tags...); \
	cd $(ROOT_DIR) && git push origin $(TARGET_BRANCH) --follow-tags; \
	$(call log_success,Release finished for @aiready/platform)

##@ Package Release

# Check if a spoke has changes since its last release tag
check-changes: ## Check if SPOKE has changes since last release tag (returns: has_changes/no_changes)
	$(call require_spoke)
	@last_tag=$$(git for-each-ref 'refs/tags/$(SPOKE)-v*' --sort=-creatordate --format '%(refname:short)' | head -n1); \
	if [ -z "$$last_tag" ]; then \
		$(call log_info,No previous release tag found for @aiready/$(SPOKE)); \
		echo "has_changes"; \
		exit 0; \
	fi; \
	$(call log_step,Checking changes in packages/$(SPOKE) since $$last_tag...); \
	if git diff --quiet "$$last_tag" -- packages/$(SPOKE); then \
		$(call log_info,No code changes detected in packages/$(SPOKE) since $$last_tag); \
		$(call log_step,Checking for outdated dependencies...); \
		if $(MAKE) -s check-dependency-updates SPOKE=$(SPOKE) | grep -q "has_outdated_deps"; then \
			$(call log_info,Outdated dependencies detected, changes needed); \
			echo "has_changes"; \
			exit 0; \
		else \
			$(call log_info,No changes detected in packages/$(SPOKE) since $$last_tag); \
			echo "no_changes"; \
			exit 1; \
		fi; \
	else \
		$(call log_info,Code changes detected in packages/$(SPOKE) since $$last_tag); \
		echo "has_changes"; \
		exit 0; \
	fi

# Check if a spoke's published dependencies are outdated
check-dependency-updates: ## Check if SPOKE's published dependencies have newer versions
	$(call require_spoke)
	@./makefiles/scripts/check-dependency-updates.sh $(SPOKE)

# Release a single spoke end-to-end

release-one: ## Release one spoke: TYPE=patch|minor|major, SPOKE=core|pattern-detect
	$(call require_spoke)
	@if [ -z "$(TYPE)" ]; then \
		$(call log_error,TYPE parameter required. Usage: make $@ SPOKE=pattern-detect TYPE=minor); \
		exit 1; \
	fi; \
	bump_target="$(call bump_target_for_type,$(TYPE))"; \
	if [ -z "$$bump_target" ]; then \
		$(call log_error,Invalid TYPE '$(TYPE)'. Expected patch|minor|major); \
		exit 1; \
	fi; \
	$(MAKE) -C $(ROOT_DIR) $$bump_target SPOKE=$(SPOKE); \
	$(call log_success,Version bump complete for @aiready/$(SPOKE)); \
	$(call commit_and_tag); \
	$(call log_step,Building workspace...); \
	$(MAKE) -C $(ROOT_DIR) build; \
	$(call log_success,Build complete); \
	if ! $(MAKE) -C $(ROOT_DIR) test-contract SPOKE=$(SPOKE); then \
		$(call log_error,Contract Tests failed for @aiready/$(SPOKE). Aborting release.); \
		exit 1; \
	fi; \
	if ! $(MAKE) -C $(ROOT_DIR) test-integration; then \
		$(call log_error,Integration Tests failed for @aiready/$(SPOKE). Aborting release.); \
		exit 1; \
	fi; \
	@$(call log_success,Integration Tests passed); \
	if ! $(MAKE) -C $(ROOT_DIR) test-verify-cli; then \
		$(call log_error,CLI smoke test failed. Aborting release.); \
		exit 1; \
	fi; \
	$(call log_success,CLI smoke test passed); \
	@# If releasing a HUB (core or cli), verify downstream services
	@if [ "$(SPOKE)" = "core" ] || [ "$(SPOKE)" = "cli" ]; then \
		$(call log_step,HUB RELEASE DETECTED: Running mandatory downstream safety checks...); \
		if ! $(MAKE) -C $(ROOT_DIR) test-downstream; then \
			$(call log_error,Downstream verification failed for HUB release. Aborting release.); \
			exit 1; \
		fi; \
		$(call log_success,Downstream safety checks passed); \
	fi; \
	$(call log_step,Publishing @aiready/$(SPOKE) to npm...); \
	if ! $(MAKE) -C $(ROOT_DIR) npm-publish SPOKE=$(SPOKE); then \
		$(call log_error,NPM publish failed for @aiready/$(SPOKE). Aborting release.); \
		exit 1; \
	fi; \
	$(call log_step,Syncing GitHub spoke for @aiready/$(SPOKE)...); \
	$(MAKE) -C $(ROOT_DIR) publish SPOKE=$(SPOKE) OWNER=$(OWNER); \
	$(call log_step,Pushing monorepo branch and tags...); \
	cd $(ROOT_DIR) && git push origin $(TARGET_BRANCH) --follow-tags; \
	$(call log_success,Release finished for @aiready/$(SPOKE))

# Release all spokes with the same bump type
# Strategy: 
#   1. Version bump all packages (serial to avoid git conflicts)
#   2. Commit + tag all changes together (once)
#   3. Build + test (once)
#   4. Publish to npm + sync GitHub (serial for proper dependency order)
# Landing site is EXCLUDED - use 'make release-landing' separately
# ⚠️  CLI is ALWAYS released last because it depends on ALL spokes

release-all: ## Release all spokes: TYPE=patch|minor|major (excludes landing)
	@if [ -z "$(TYPE)" ]; then \
		$(call log_error,TYPE parameter required. Example: make $@ TYPE=minor); \
		exit 1; \
	fi; \
	bump_target="$(call bump_target_for_type,$(TYPE))"; \
	if [ -z "$$bump_target" ]; then \
		$(call log_error,Invalid TYPE '$(TYPE)'. Expected patch|minor|major); \
		exit 1; \
	fi; \
	$(call log_step,Phase 1: Building workspace ONCE...); \
	$(MAKE) -C $(ROOT_DIR) build || { \
		$(call log_error,Build failed. Aborting release-all.); \
		exit 1; \
	}; \
	$(call log_success,Build complete); \
	$(call log_step,Phase 2: Testing current state (Unit + Contract)...); \
	$(MAKE) -C $(ROOT_DIR) test || { \
		$(call log_error,Tests failed. Aborting release-all.); \
		exit 1; \
	}; \
	$(call log_step,Phase 2.1: Running explicit Spoke-to-Hub Contract Tests...); \
	$(MAKE) -C $(ROOT_DIR) test-contract || { \
		$(call log_error,Contract tests failed. Aborting release-all.); \
		exit 1; \
	}; \
	$(call log_step,Phase 2.2: Running Tier 2 Integration Tests...); \
	$(MAKE) -C $(ROOT_DIR) test-integration || { \
		$(call log_error,Integration tests failed. Aborting release-all.); \
		exit 1; \
	}; \
	$(call log_step,Phase 2.3: Running Tier 3 Local E2E Tests...); \
	$(MAKE) -C $(ROOT_DIR) test-platform-e2e-local || { \
		$(call log_error,Platform E2E tests failed locally. Aborting release-all.); \
		exit 1; \
	}; \
	@$(call log_success,All Tiers of contract and integration testing passed); \
	$(call log_success,CLI smoke test passed); \
	$(call log_step,Phase 2.6: Running mandatory downstream safety checks...); \
	$(MAKE) -C $(ROOT_DIR) test-downstream || { \
		$(call log_error,Downstream verification failed. Aborting release-all.); \
		exit 1; \
	}; \
	$(call log_success,Downstream safety checks passed); \
	$(call log_step,Phase 3: Version bumping all spokes...); \
	for spoke in $(CORE_SPOKE) $(MIDDLE_SPOKES) vscode-extension $(CLI_SPOKE); do \
		$(call log_info,Bumping @aiready/$$spoke...); \
		$(MAKE) -C $(ROOT_DIR) $$bump_target SPOKE=$$spoke || exit 1; \
		$(call log_success,Version bumped for @aiready/$$spoke); \
	done; \
	$(call log_step,Phase 4: Committing all version bumps...); \
	cd $(ROOT_DIR) && git add packages/*/package.json || true; \
	if [ -f "$(ROOT_DIR)/landing/package.json" ]; then git add landing/package.json; fi; \
	if [ -f "$(ROOT_DIR)/platform/package.json" ]; then git add platform/package.json; fi; \
	cd $(ROOT_DIR) && git commit -m "chore(release): version bumps across spokes" || $(call log_info,No changes to commit); \
	$(call log_step,Phase 4.5: Tagging each spoke...); \
	for spoke in $(CORE_SPOKE) $(MIDDLE_SPOKES) vscode-extension $(CLI_SPOKE); do \
		version=$$(node -p "require('$(ROOT_DIR)/packages/$$spoke/package.json').version"); \
		tag_name="$$spoke-v$$version"; \
		$(call log_step,Tagging $$tag_name...); \
		cd $(ROOT_DIR) && git tag -f -a "$$tag_name" -m "Release @aiready/$$spoke v$$version" || true; \
	done; \
	$(call log_step,Phase 5: Publishing core spoke first...); \
	$(MAKE) -C $(ROOT_DIR) npm-publish SPOKE=$(CORE_SPOKE) || exit 1; \
	$(MAKE) -C $(ROOT_DIR) publish SPOKE=$(CORE_SPOKE) OWNER=$(OWNER) || exit 1; \
	$(call log_success,Published @aiready/$(CORE_SPOKE)); \
	$(call log_step,Phase 6: Publishing middle spokes in parallel...); \
	$(MAKE) $(MAKE_PARALLEL) $(addprefix release-spoke-,$(MIDDLE_SPOKES)) || exit 1; \
	$(call log_step,Phase 7: Publishing CLI last...); \
	$(MAKE) -C $(ROOT_DIR) npm-publish SPOKE=$(CLI_SPOKE) || exit 1; \
	$(MAKE) -C $(ROOT_DIR) publish SPOKE=$(CLI_SPOKE) OWNER=$(OWNER) || exit 1; \
	$(call log_success,Published @aiready/$(CLI_SPOKE)); \
	$(call log_step,Phase 7.5: Syncing VS Code extension... (Not on NPM)); \
	$(MAKE) -C $(ROOT_DIR) publish SPOKE=vscode-extension OWNER=$(OWNER) || exit 1; \
	$(call log_success,Synced VS Code extension to GitHub); \
	$(call log_step,Phase 8: Pushing all changes to monorepo...); \
	cd $(ROOT_DIR) && git push origin $(TARGET_BRANCH) --follow-tags; \
	$(call log_success,🎉 All spokes released successfully in proper order: core → middle → cli)

# Status overview: local vs published versions

release-dev: ## Full dev deploy workflow: Build + Unit test + Contract test + Deploy dev + Plawright e2e tests
	@$(call log_step,Starting dev release pipeline...)
	@$(MAKE) -C $(ROOT_DIR) build || exit 1
	@$(MAKE) -C $(ROOT_DIR) test || exit 1
	@$(MAKE) -C $(ROOT_DIR) test-contract || exit 1
	@$(MAKE) -C $(ROOT_DIR) deploy-platform || exit 1
	@$(call tag_platform_dev)
	@$(call log_step,Running Platform E2E tests against Dev endpoint...)
	@$(MAKE) -C $(ROOT_DIR) test-platform-e2e || { \
		$(call log_error,Platform E2E tests failed on dev endpoint); \
		exit 1; \
	}
	@$(call log_step,Running Landing E2E tests...)
	@$(MAKE) -C $(ROOT_DIR) test-landing-e2e || { \
		$(call log_error,Landing E2E tests failed); \
		exit 1; \
	}
	@$(call log_step,Pushing tags...)
	@cd $(ROOT_DIR) && git push origin --follow-tags
	@$(call log_success,Dev release pipeline completed successfully!)


release-status: ## Show local and npm registry versions for all spokes + landing
	@$(call log_step,Reading local and npm registry versions...)
	@echo ""; \
	printf "%-30s %-15s %-15s %-10s\n" "Package" "Local" "npm" "Status"; \
	printf "%-30s %-15s %-15s %-10s\n" "-------" "-----" "---" "------"; \
	for spoke in $(ALL_SPOKES); do \
		if [ -f "$(ROOT_DIR)/packages/$$spoke/package.json" ]; then \
			local_ver=$$(node -p "require('$(ROOT_DIR)/packages/$$spoke/package.json').version" 2>/dev/null || echo "n/a"); \
			npm_ver=$$(npm view @aiready/$$spoke version 2>/dev/null || echo "n/a"); \
			if [ "$$local_ver" = "$$npm_ver" ]; then \
				status="$(GREEN)✓$(RESET_COLOR)"; \
			elif [ "$$npm_ver" = "n/a" ]; then \
				status="$(YELLOW)new$(RESET_COLOR)"; \
			else \
				status="$(CYAN)ahead$(RESET_COLOR)"; \
			fi; \
			printf "%-30s %-15s %-15s %-10b\n" "@aiready/$$spoke" "$$local_ver" "$$npm_ver" "$$status"; \
		fi; \
	done; \
	if [ -f "$(LANDING_DIR)/package.json" ]; then \
		local_ver=$$(node -p "require('$(LANDING_DIR)/package.json').version" 2>/dev/null || echo "n/a"); \
		last_tag=$$(git for-each-ref 'refs/tags/landing-v*' --sort=-creatordate --format '%(refname:short)' | head -n1 | sed 's/landing-v//'); \
		if [ -z "$$last_tag" ]; then \
			last_tag="n/a"; \
			status="$(YELLOW)new$(RESET_COLOR)"; \
		elif [ "$$local_ver" = "$$last_tag" ]; then \
			status="$(GREEN)✓$(RESET_COLOR)"; \
		else \
			status="$(CYAN)ahead$(RESET_COLOR)"; \
		fi; \
		printf "%-30s %-15s %-15s %-10b\n" "@aiready/landing" "$$local_ver" "$$last_tag" "$$status"; \
	fi; \
	echo ""; \
	$(call log_success,Status collected)

release-help: ## Show release help
	@echo "Available targets:"; \
	echo "  check-changes            - Check if SPOKE has changes since last release"; \
	echo "  check-dependency-updates - Check if SPOKE has outdated dependencies"; \
	echo "  release-one              - Release one spoke (TYPE, SPOKE, [FORCE])"; \
	echo "  release-all              - Release all spokes (TYPE, [FORCE])"; \
	echo "  release-landing          - Release landing page (TYPE)"; \
	echo "  release-status           - Show local vs npm/git tag versions"; \
	echo ""; \
	echo "Examples:"; \
	echo "  make check-changes SPOKE=cli"; \
	echo "  make check-dependency-updates SPOKE=cli"; \
	echo "  make release-one SPOKE=pattern-detect TYPE=minor"; \
	echo "  make release-all TYPE=minor"; \
	echo "  make release-landing TYPE=minor"; \
	echo "  make release-status";
