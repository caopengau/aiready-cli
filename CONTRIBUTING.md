# Contributing to @aiready/cli

Thank you for your interest in contributing to AIReady CLI! We welcome bug reports, feature requests, and code contributions.

## 🎯 What is the CLI?

The CLI is the **unified interface** for all AIReady analysis tools. It provides:

- **Unified scanning**: Run multiple tools (patterns, context, consistency) with one command
- **Individual tool access**: Use each tool directly for focused analysis
- **Consistent output**: Unified reporting across all tools
- **Configuration management**: Persist settings across runs

## 🏛️ Architecture

The CLI follows a **hub-and-spoke** pattern:

```
                           🎯 USER
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   🎛️  CLI (@aiready/cli)                │
│                Unified Interface & Orchestration         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
                    🏢 HUB (core)
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
     📊 PATTERN      📦 CONTEXT      🔧 CONSIST      📚 DOC
      DETECT          ANALYZER        ENCY           DRIFT
```

### Key Principles

- **No spoke dependencies**: CLI only imports from `@aiready/core`
- **Spoke integration**: Each analysis tool is independent and imported as needed
- **Unified interface**: Consistent CLI options across all tools

## 🐛 Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/caopengau/aiready-cli/issues) with:

- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (Node version, OS)

## 🔧 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/aiready-cli
cd aiready-cli

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Link for local testing
pnpm link
```

## 📝 Making Changes

1. **Fork the repository** and create a new branch:

   ```bash
   git checkout -b fix/cli-output-format
   # or
   git checkout -b feat/new-tool-integration
   ```

2. **Make your changes** following our code style:
   - Use TypeScript strict mode
   - Add tests for new features
   - Update README with new commands
   - Keep commands modular and focused

3. **Test your changes**:

   ```bash
   pnpm build
   pnpm test

   # Test CLI locally
   ./dist/cli.js scan /path/to/project
   ```

4. **Commit using conventional commits**:

   ```bash
   git commit -m "fix: correct output format for JSON"
   git commit -m "feat: add new tool integration"
   ```

5. **Push and open a PR**:
   ```bash
   git push origin feat/new-tool-integration
   ```

## 📋 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature (new command, option, or tool integration)
- `fix:` - Bug fix (output format, option handling)
- `docs:` - Documentation updates
- `perf:` - Performance improvements
- `refactor:` - Code restructuring
- `test:` - Test additions/updates
- `chore:` - Maintenance tasks

## 🧪 Testing Guidelines

- Add test cases in `src/__tests__/`
- Test CLI commands end-to-end
- Verify output formats (console, JSON)
- Test edge cases (missing arguments, invalid paths)

Example test:

```typescript
test('scan command runs all tools by default', async () => {
  const result = await runCli(['scan', './test-project']);
  expect(result.stdout).toContain('Pattern Detection');
  expect(result.stdout).toContain('Context Analysis');
  expect(result.exitCode).toBe(0);
});
```

## 🏗️ Architecture

### Directory Structure

```
src/
├── commands/
│   ├── scan.ts       # Unified scan command
│   ├── patterns.ts  # Pattern detection command
│   ├── context.ts   # Context analysis command
│   └── consistency.ts # Consistency check command
├── options/
│   ├── global.ts    # Global CLI options
│   └── tools.ts     # Tool-specific options
├── output/
│   ├── formatter.ts # Output formatting
│   └── reporter.ts  # Result reporting
├── integration/
│   └── tools.ts     # Tool invocation logic
├── types.ts         # Type definitions
├── cli.ts           # CLI entry point
└── index.ts         # Public API exports
```

### Adding a New Command

1. Create `src/commands/your-command.ts`:

   ```typescript
   import { Command } from 'commander';
   import { globalOptions } from '../options/global';

   export const yourCommand = new Command('your-command')
     .description('Description of your command')
     .argument('<directory>', 'Directory to analyze')
     .option('-o, --output <format>', 'Output format')
     .action(async (directory, options) => {
       // Your implementation
     });
   ```

2. Register in `src/cli.ts`

3. Add tests in `src/__tests__/`

4. Document in README.md

### Integrating a New Tool

1. Ensure the tool follows the CLI spec (--output, --include, --exclude)
2. Import the tool in `src/integration/tools.ts`
3. Add tool name to the valid tools list
4. Update scan command to include the new tool
5. Document in README.md

## 🎯 Areas for Contribution

Great places to start:

- **New commands**: Add new CLI commands
- **Tool integration**: Integrate new analysis tools
- **Output formats**: Add new output options (XML, CSV, HTML)
- **Configuration**: Improve config file handling
- **Performance**: Optimize for large codebases
- **Documentation**: Usage examples, tutorials

## 🔍 Code Review

- All checks must pass (build, tests, lint)
- Maintainers review within 2 business days
- Address feedback and update PR
- Once approved, we'll merge and publish

## 📚 Documentation

- Update README.md for new commands
- Document new CLI options
- Include usage examples
- Add to website documentation

## 💡 Feature Ideas

Looking for inspiration? Consider:

- Interactive mode with guided analysis
- Watch mode for file changes
- IDE plugins integration
- CI/CD report generation
- Export to different formats
- Multi-project scanning

## ❓ Questions?

Open an issue or reach out to the maintainers. We're here to help!

---

**Thank you for helping make AI-ready code accessible to everyone!** 💙
