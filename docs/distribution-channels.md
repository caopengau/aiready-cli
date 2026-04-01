# AIReady Distribution Channels

This document outlines the distribution strategy for AIReady tools and the status of each channel.

## Quick Status

| Channel                | Status            | Package                      | Priority |
| ---------------------- | ----------------- | ---------------------------- | -------- |
| **npm**                | ✅ Published      | `@aiready/cli`               | Done     |
| **Docker Hub**         | 🟡 Ready          | `aiready/cli`                | High     |
| **ghcr.io**            | 🟡 Ready          | `ghcr.io/getaiready/aiready` | High     |
| **GitHub Marketplace** | ✅ Published      | `getaiready/aiready-action`  | Done     |
| **VS Code Extension**  | 🟡 Scaffold Ready | `aiready.aiready`            | Medium   |
| **Homebrew**           | 🟡 Formula Ready  | `aiready`                    | Medium   |

## Makefile Commands

```bash
# View all distribution channels status
make distribution-status

# Docker
make docker-build      # Build Docker image
make docker-push       # Push to Docker Hub and ghcr.io
make docker-test       # Test Docker image

# VS Code Extension
make vscode-package    # Package as VSIX
make vscode-publish    # Publish to Marketplace

# GitHub Action
make action-build      # Build action
make action-publish    # Show publishing instructions

# Homebrew
make homebrew-test     # Test formula
make homebrew-publish  # Show publishing instructions

# Build all packages
make distribution-all
```

---

## 1. npm Packages ✅

### Current Status

All packages are published to npm:

| Package                     | Version | Status       |
| --------------------------- | ------- | ------------ |
| `@aiready/cli`              | v0.9.26 | ✅ Published |
| `@aiready/core`             | Latest  | ✅ Published |
| `@aiready/pattern-detect`   | Latest  | ✅ Published |
| `@aiready/context-analyzer` | Latest  | ✅ Published |
| `@aiready/consistency`      | Latest  | ✅ Published |
| `@aiready/visualizer`       | Latest  | ✅ Published |

### Installation

```bash
# Global install
npm install -g @aiready/cli

# Or use with npx (no install)
npx @aiready/cli scan .

# Or in package.json
{
  "devDependencies": {
    "@aiready/cli": "^0.9.26"
  }
}
```

### Release Process

```bash
# Release specific package
make release-cli VERSION=patch

# Release all packages
make release-all
```

---

## 2. Docker 🟡 Ready

### Files Created

- `docker/Dockerfile` - Multi-stage build from source
- `docker/Dockerfile.slim` - Installs from npm (smaller image)
- `.github/workflows/docker.yml` - Automated build & push workflow

### Building & Publishing

```bash
# Build locally
make docker-build

# Test the image
make docker-test

# Push to registries
make docker-push
```

### Usage

```bash
# Pull from Docker Hub
docker pull aiready/cli:latest

# Pull from ghcr.io
docker pull ghcr.io/getaiready/aiready:latest

# Run analysis
docker run --rm -v $(pwd):/workspace aiready/cli:latest scan /workspace

# With options
docker run --rm -v $(pwd):/workspace aiready/cli:latest \
  scan /workspace --score --output json
```

### GitHub Actions Integration

```yaml
- name: Run AIReady
  run: |
    docker run --rm -v ${{ github.workspace }}:/workspace \
      aiready/cli:latest scan /workspace --score
```

### Release Pipeline

Docker images are managed via the `make` release pipeline in `makefiles/Makefile.distribution.mk`:

- Run `make docker-build` to build locally.
- Run `make docker-push` to push to both Docker Hub and ghcr.io.
- This process includes version tags and `latest` for both slim and full images.

---

## 3. GitHub Actions Marketplace 🟡 Ready

### Files Created

- `action-marketplace/` - Standalone action directory
- `action-marketplace/action.yml` - Action definition
- `action-marketplace/src/index.ts` - Action source
- `action-marketplace/README.md` - Marketplace README

### Publishing Steps

```bash
# 1. Build the action
make action-build

# 2. Create standalone repository
gh repo create aiready-action --public

# 3. Copy files to new repo
cp -r action-marketplace/* /path/to/aiready-action/

# 4. Create initial commit and release
cd aiready-action
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/getaiready/aiready-action.git
git push -u origin main
gh release create v1 --title "v1.0.0" --notes "Initial release"

# 5. Publish to Marketplace
# Go to: https://github.com/getaiready/aiready-action
# Click "Release" → "Publish this Action to the GitHub Marketplace"
```

### Usage After Publishing

```yaml
# .github/workflows/aiready.yml
name: AIReady Check
on: [pull_request]

jobs:
  aiready:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: getaiready/aiready-action@v1
        with:
          threshold: '70'
          fail-on: 'critical'
```

### Inputs

| Input       | Required | Default                        | Description                                          |
| ----------- | -------- | ------------------------------ | ---------------------------------------------------- |
| `directory` | No       | `.`                            | Directory to analyze                                 |
| `threshold` | No       | `70`                           | Minimum AI readiness score (0-100)                   |
| `fail-on`   | No       | `critical`                     | Fail on severity: `critical`, `major`, `any`, `none` |
| `tools`     | No       | `patterns,context,consistency` | Tools to run                                         |

### Outputs

| Output     | Description                        |
| ---------- | ---------------------------------- |
| `score`    | Overall AI readiness score (0-100) |
| `passed`   | Whether the check passed           |
| `issues`   | Total issues found                 |
| `critical` | Critical issues count              |
| `major`    | Major issues count                 |

---

## 4. VS Code Extension 🟡 Scaffold Ready

### Files Created

- `vscode-extension/package.json` - Extension manifest
- `vscode-extension/src/extension.ts` - Extension source
- `vscode-extension/README.md` - Extension README

### Features

- 🛡️ Real-time AI readiness score in status bar
- 📊 Issue explorer in sidebar
- ⚡ Quick scan current file
- 🔧 Configurable thresholds and tools

### Building & Publishing

VS Code extension releases are managed via the `make` release pipeline:

```bash
# Release VS Code extension
make release-vscode TYPE=patch
```

This command automatically:

1. Bumps the version in `vscode-extension/package.json`.
2. Packages the extension as VSIX.
3. Publishes to both VS Code Marketplace and Open VSX Registry.
4. Syncs the changes to the standalone `aiready-vscode` repository and tags it.

Alternatively, you can run individual steps:

### Configuration

| Setting                 | Default                                  | Description              |
| ----------------------- | ---------------------------------------- | ------------------------ |
| `aiready.threshold`     | `70`                                     | Minimum score to pass    |
| `aiready.failOn`        | `critical`                               | Severity to fail on      |
| `aiready.tools`         | `["patterns", "context", "consistency"]` | Tools to run             |
| `aiready.autoScan`      | `false`                                  | Auto-scan on save        |
| `aiready.showStatusBar` | `true`                                   | Show score in status bar |

### Commands

| Command                   | Description         |
| ------------------------- | ------------------- |
| `AIReady: Scan Workspace` | Full workspace scan |
| `AIReady: Quick Scan`     | Current file only   |
| `AIReady: Show Report`    | Open output panel   |
| `AIReady: Open Settings`  | Configure options   |

---

## 5. Homebrew 🟡 Formula Ready

### Files Created

- `homebrew/aiready.rb` - Homebrew formula

### Publishing Steps

```bash
# 1. Create homebrew-tap repository
gh repo create homebrew-tap --public

# 2. Get SHA256 for the tarball
curl -sL https://registry.npmjs.org/@aiready/cli/-/cli-0.9.26.tgz | shasum -a 256

# 3. Update formula with SHA256
# Edit homebrew/aiready.rb with the correct SHA256

# 4. Copy to tap repository
cp homebrew/aiready.rb /path/to/homebrew-tap/Formula/

# 5. Push to tap
cd homebrew-tap
git add Formula/aiready.rb
git commit -m "Add aiready formula"
git push
```

### Installation After Publishing

```bash
# Add tap
brew tap caopengau/tap

# Install
brew install aiready

# Run
aiready scan .
```

### Testing Formula Locally

```bash
# Test without installing
brew audit --formula homebrew/aiready.rb

# Install from local formula
brew install --build-from-source homebrew/aiready.rb
```

---

## 6. Other Potential Channels

| Channel        | Priority | Effort | Status      | Notes               |
| -------------- | -------- | ------ | ----------- | ------------------- |
| **Snap**       | Low      | Medium | Not started | Linux desktop users |
| **Chocolatey** | Low      | Low    | Not started | Windows users       |
| **AUR**        | Low      | Low    | Not started | Arch Linux users    |
| **Scoop**      | Low      | Low    | Not started | Windows users       |

---

## Versioning Strategy

| Component         | Versioning        | Example            |
| ----------------- | ----------------- | ------------------ |
| npm packages      | Semantic          | `0.9.26`           |
| GitHub Action     | Major tag         | `v1`, `v1.1`       |
| Docker            | Semantic + latest | `0.9.26`, `latest` |
| VS Code Extension | Semantic          | `0.1.0`            |

---

## Monitoring & Analytics

- **npm downloads:** `npm info @aiready/cli`
- **GitHub Action usage:** GitHub Insights tab
- **Docker pulls:** Docker Hub statistics, ghcr.io packages
- **VS Code extension:** Marketplace metrics

---

## Release Checklist

### Before Release

- [ ] Update all package versions
- [ ] Update CHANGELOG.md
- [ ] Run `make pre-commit`
- [ ] Run `make test`

### Release npm

- [ ] Run `make release-all`
- [ ] Verify packages on npmjs.com

### Release Docker

- [ ] Run `make docker-push`
- [ ] Verify images on Docker Hub and ghcr.io

### Release GitHub Action

- [ ] Copy to `aiready-action` repo
- [ ] Create new release tag
- [ ] Publish to Marketplace

### Release VS Code Extension

- [ ] Run `make vscode-publish`
- [ ] Verify on Marketplace

### Release Homebrew

- [ ] Update SHA256 in formula
- [ ] Push to homebrew-tap
- [ ] Test installation

---

_Last updated: February 2026_
</task_progress>
</write_to_file>
