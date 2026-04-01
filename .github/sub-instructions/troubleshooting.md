# Troubleshooting Sub-Instructions

### "Not logged into npm"

```bash
make npm-login
```

### "Repository not found" on GitHub publish

Create the spoke repository first:

```bash
gh repo create getaiready/aiready-{spoke-name} --public
```

### "workspace:\* protocol" error

You're using `npm publish` instead of `pnpm publish`. Use our Makefiles:

```bash
make npm-publish SPOKE=context-analyzer
```

### Changes not detected for release

Force the release:

```bash
make release-one SPOKE=context-analyzer TYPE=patch FORCE=1
```

### Build fails before publish

Ensure all packages build successfully:

```bash
make build
make test
```

### Wrong release order causes dependency issues

**This should no longer happen** - the `release-all` command automatically follows the safe order:

1. `@aiready/core` (always first - no dependencies)
2. Spokes in alphabetical order (context-analyzer, pattern-detect, etc.)
3. `@aiready/cli` (always last - depends on core)

Use `make release-all` for automatic correct ordering.
