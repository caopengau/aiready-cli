# Landing Page Release Workflow

This document describes the release and tagging process for the AIReady landing page.

## Overview

The landing page (`@aiready/landing`) is part of the monorepo and also published to a separate GitHub repository at `getaiready/aiready-landing`. The release workflow ensures that:

1. **Version management**: Landing page version is tracked in `landing/package.json`
2. **Monorepo tagging**: Version tags (e.g., `landing-v0.1.0`) are created in the monorepo
3. **Sub-repo sync**: Changes are pushed to `aiready-landing` repository with proper version tags

## Architecture

```
aiready (monorepo)
├── landing/
│   ├── package.json  (version: 0.1.0)
│   └── ... (Next.js app)
└── Git tags: landing-v0.1.0

↓ subtree split + publish

aiready-landing (public repo)
└── Git tags: v0.1.0
```

## Release Commands

### Check Current Status

```bash
# Show all package versions (including landing)
make release-status
```

Output includes:

```
Package                        Local           npm             Status
-------                        -----           ---             ------
@aiready/landing               0.1.0           n/a             new
```

### Release Landing Page

```bash
# Patch release (0.1.0 → 0.1.1)
make release-landing TYPE=patch

# Minor release (0.1.0 → 0.2.0)
make release-landing TYPE=minor

# Major release (0.1.0 → 1.0.0)
make release-landing TYPE=major
```

### What Happens During Release?

1. **Version Bump**: Updates `landing/package.json` version
2. **Build**: Runs `pnpm build` to verify the landing page builds successfully
3. **Git Commit**: Commits version change with message: `chore(release): @aiready/landing v0.2.0`
4. **Monorepo Tag**: Creates annotated tag `landing-v0.2.0` in the monorepo
5. **Subtree Split**: Creates a subtree split of the `landing/` directory
6. **Sensitive File Removal**: Removes `sst.config.ts` and `.env` from the split (security)
7. **Push to Sub-repo**: Force pushes to `aiready-landing` repository (main branch)
8. **Sub-repo Tag**: Creates version tag `v0.2.0` in the sub-repo (without "landing-" prefix)
9. **Push Tags**: Pushes all tags to both monorepo and sub-repo

## Manual Version Bumping

If you need to bump the version without releasing:

```bash
# Patch
make version-landing-patch

# Minor
make version-landing-minor

# Major
make version-landing-major
```

## Tag Convention

- **Monorepo tags**: `landing-v<version>` (e.g., `landing-v0.1.0`)
- **Sub-repo tags**: `v<version>` (e.g., `v0.1.0`)

This distinction allows clear identification of landing releases in the monorepo while maintaining standard semantic versioning in the public sub-repo.

## Integration with sync

The `make sync` command automatically syncs the landing page to the sub-repo:

```bash
make sync
```

This will:

1. Push monorepo changes to origin
2. Sync all package spokes to their public repos
3. **Sync landing page to aiready-landing repo** (uses current version tag)

## Verifying Releases

### Check Monorepo Tags

```bash
git tag -l "landing-v*"
# Output: landing-v0.1.0, landing-v0.2.0, etc.
```

### Check Sub-repo Tags

```bash
git ls-remote --tags https://github.com/getaiready/aiready-landing.git
# Output: refs/tags/v0.1.0, refs/tags/v0.2.0, etc.
```

### View Landing Version

```bash
node -p "require('./landing/package.json').version"
# Output: 0.1.0
```

## Deployment vs Release

**Important**: Release and deployment are separate processes:

- **Release** (`make release-landing`): Version management and GitHub sync
- **Deployment** (`make deploy-landing-prod`): Deploy to AWS with SST

Typical workflow for production:

```bash
# 1. Release new version
make release-landing TYPE=minor

# 2. Deploy to production
make deploy-landing-prod

# 3. Verify deployment
make landing-verify
```

## Troubleshooting

### Issue: Version tag already exists

```bash
# Delete local tag
git tag -d landing-v0.1.0

# Delete remote tag (monorepo)
git push origin :refs/tags/landing-v0.1.0

# Delete remote tag (sub-repo)
git push aiready-landing :refs/tags/v0.1.0
```

### Issue: Sub-repo out of sync

```bash
# Force re-sync
make publish-landing OWNER=caopengau
```

### Issue: Build fails during release

The release will abort if the build fails. Fix the build issues first:

```bash
cd landing
pnpm build
# Fix errors, then retry release
```

## Best Practices

1. **Always test locally** before releasing:

   ```bash
   cd landing && pnpm build && pnpm start
   ```

2. **Use semantic versioning**:
   - **Patch** (0.1.0 → 0.1.1): Bug fixes, minor content updates
   - **Minor** (0.1.0 → 0.2.0): New features, significant content changes
   - **Major** (0.1.0 → 1.0.0): Breaking changes, major redesign

3. **Deploy after releasing**:

   ```bash
   make release-landing TYPE=minor
   make deploy-landing-prod
   ```

4. **Check status regularly**:
   ```bash
   make release-status
   ```

## Related Commands

- `make deploy-landing`: Deploy to AWS (dev)
- `make deploy-landing-prod`: Deploy to AWS (production)
- `make landing-verify`: Check CloudFront status
- `make landing-logs`: View SST logs
- `make release-status`: Show all versions
- `make sync`: Sync all repos (packages + landing)

## Security Note

The `publish-landing` target automatically removes sensitive files (`sst.config.ts`, `.env`) from the public sub-repo to prevent credential exposure. These files remain in the monorepo for deployment purposes.
