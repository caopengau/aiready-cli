# Git Workflow Sub-Instructions

## Hub-and-Spoke Git Architecture

AIReady uses a **hub-and-spoke git architecture** where:

- **Public Entry Point:** `https://github.com/getaiready/aiready-cli` - The CLI tool users install
- **Spokes:** Individual GitHub repos for each package (e.g., `aiready-cli`, `aiready-core`)

### Why This Architecture?

- **Independent Releases:** Each spoke can be versioned and released independently
- **Focused Contributions:** Contributors can work on individual tools without monorepo complexity
- **NPM Publishing:** Each spoke is a separate npm package with its own lifecycle
- **Clean Dependencies:** Spokes only depend on core, no spoke-to-spoke dependencies

## Git Practices (COMPULSORY)

### Always Use Makefiles for Git Operations

**❌ NEVER do this:**

```bash
git add .
git commit -m "changes"
git push origin main
```

**✅ ALWAYS do this:**

```bash
# After making changes
make push  # Syncs monorepo + all spokes

# Or for individual spokes
make push SPOKE=cli
```

### Subtree Split Process

When you run `make push`, this happens automatically:

1. **Monorepo Push:** Changes pushed to `aiready` main branch
2. **Subtree Split:** Each package is extracted into separate branches
3. **Spoke Sync:** Each spoke repo is updated with its package code
4. **Tagging:** Version tags are created and pushed to spoke repos

### Repository Structure

```
Monorepo: aiready/
├── packages/
│   ├── cli/           → Spoke: aiready-cli
│   ├── core/          → Spoke: aiready-core
│   ├── pattern-detect/ → Spoke: aiready-pattern-detect
│   └── context-analyzer/ → Spoke: aiready-context-analyzer

Spoke Repos:
├── aiready-cli (https://github.com/getaiready/aiready-cli)
├── aiready-core (https://github.com/getaiready/aiready-core)
├── aiready-pattern-detect (https://github.com/getaiready/aiready-pattern-detect)
└── aiready-context-analyzer (https://github.com/getaiready/aiready-context-analyzer)
```

### Critical Rules

#### 1. Never Commit Directly to Spoke Repos

- All development happens in the monorepo
- Spoke repos are read-only mirrors (auto-updated)
- External contributions must be synced back using `make sync-from-spoke`

#### 2. Always Use `make push` After Commits

```bash
# Workflow:
git add .
git commit -m "feat: add new feature"
make push  # ← This syncs everything
```

#### 3. Check Repository Status Regularly

```bash
# See all repo statuses
make release-status

# See git status
git status
```

#### 4. Handle External Contributions

```bash
# When someone contributes to a spoke repo directly:
make sync-from-spoke SPOKE=cli
```

### Common Git Scenarios

#### New Feature Development

```bash
# 1. Work in monorepo
cd packages/cli
# Make changes...

# 2. Commit in monorepo
git add .
git commit -m "feat: add config file support"

# 3. Sync all repos
make push
```

#### Bug Fix

```bash
# 1. Fix in monorepo
# 2. Test: make test
# 3. Commit: git commit -m "fix: resolve async issue"
# 4. Sync: make push
```

#### Release Process

```bash
# 1. Check status
make release-status

# 2. Release spoke
make release-one SPOKE=cli TYPE=patch

# 3. This automatically handles git tags and spoke sync
```

### Troubleshooting Git Issues

#### "Repository not found" Error

```bash
# Create the missing spoke repo first
gh repo create getaiready/aiready-{spoke-name} --public

# Then retry
make publish SPOKE={spoke-name}
```

#### Out of Sync Repos

```bash
# Force sync all spokes
make push

# Or check individual
make push SPOKE=cli
```

#### External Changes in Spoke

```bash
# Pull changes back to monorepo
make sync-from-spoke SPOKE=cli
```

### Verification Commands

```bash
# Check all repo statuses
make release-status

# Verify spoke repos are up to date
git ls-remote --heads aiready-cli
git ls-remote --heads aiready-core

# Check for uncommitted changes
git status
```

## Remember: Hub-and-Spoke is Sacred

- **Hub:** Where all development happens
- **Spokes:** Auto-generated mirrors for independent publishing
- **Never:** Commit directly to spoke repos
- **Always:** Use `make push` after monorepo commits
- **Check:** `make release-status` regularly

This architecture enables independent package releases while maintaining a single source of truth for development.
