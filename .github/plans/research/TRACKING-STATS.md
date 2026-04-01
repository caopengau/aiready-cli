# 📊 Tracking Stats Guide

This guide explains how to track and monitor AIReady package usage and growth.

## Quick Commands

```bash
# Show current stats
make stats

# Export stats to JSON (for historical tracking)
make stats-export

# Compare with last week (requires historical data)
make stats-compare

# Open dashboards in browser
make stats-dashboard

# Generate weekly report
make stats-weekly
```

## Current Numbers (as of 2026-01-16)

**📦 NPM Downloads (Last 7 Days):**

- Total: **12,847 downloads/week** 🚀
- @aiready/pattern-detect: 3,321
- @aiready/core: 2,987
- @aiready/cli: 2,689
- @aiready/context-analyzer: 2,671
- @aiready/consistency: 1,179

**⭐ GitHub:**

- Stars: 1
- Forks: 0
- Open Issues: 1
- Open PRs: 2

## Setting Up Regular Tracking

### 1. Export Baseline Stats

```bash
make stats-export
```

This creates `.aiready/stats/YYYY-MM-DD.json` with current metrics.

### 2. Set Up Weekly Automation

Add to your crontab (Monday 9am):

```bash
crontab -e

# Add this line:
0 9 * * 1 cd /path/to/aiready && make stats-export
```

Or create a GitHub Action:

```yaml
# .github/workflows/stats.yml
name: Track Stats
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday 9am
  workflow_dispatch:

jobs:
  track:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: make stats-export
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: '📊 Weekly stats update'
          file_pattern: .aiready/stats/*.json
```

### 3. Compare Growth Weekly

```bash
make stats-compare
```

Output:

```
📈 Growth Comparison
Comparing 2026-01-09 → 2026-01-16

NPM Downloads:
  cli: ↗ +427 (2262 → 2689)
  pattern-detect: ↗ +551 (2770 → 3321)
  ...

GitHub Stars:
  ↗ +1 stars (0 → 1)
```

## Available Commands

| Command                      | Description                            |
| ---------------------------- | -------------------------------------- |
| `make stats`                 | Quick stats summary (NPM + GitHub)     |
| `make stats-npm`             | NPM downloads (last 7 days)            |
| `make stats-npm-detailed`    | NPM downloads with trends              |
| `make stats-github`          | GitHub repository stats                |
| `make stats-github-detailed` | Detailed GitHub analytics              |
| `make stats-all`             | All detailed statistics                |
| `make stats-weekly`          | Weekly stats report with growth tips   |
| `make stats-export`          | Export stats to JSON file              |
| `make stats-compare`         | Compare current stats with last week   |
| `make stats-trends`          | Show historical trends (requires data) |
| `make stats-dashboard`       | Open NPM/GitHub stats in browser       |
| `make stats-setup`           | Check/install required tools           |

## Required Tools

- `jq` - JSON processor (install: `brew install jq`)
- `gh` - GitHub CLI (install: `brew install gh`)
- `curl` - HTTP client (pre-installed on most systems)

Run `make stats-setup` to check your setup.

## Data Format

Stats are exported to `.aiready/stats/YYYY-MM-DD.json`:

```json
{
  "date": "2026-01-16",
  "npm": {
    "cli": { "downloads": 2689, "version": "0.7.11" },
    "pattern-detect": { "downloads": 3321, "version": "0.9.10" },
    "context-analyzer": { "downloads": 2671, "version": "0.7.6" },
    "consistency": { "downloads": 1179, "version": "0.6.6" },
    "core": { "downloads": 2987, "version": "0.7.4" }
  },
  "github": {
    "stargazerCount": 1,
    "forkCount": 0,
    "issues": { "totalCount": 1 },
    "pullRequests": { "totalCount": 2 },
    "watchers": { "totalCount": 0 }
  }
}
```

## External Dashboards

### NPM Stats

- **npm-stat.com**: https://npm-stat.com/charts.html?package=@aiready/cli&from=2024-01-01
- **npmtrends**: https://npmtrends.com/@aiready/cli-vs-@aiready/pattern-detect
- **npms.io**: https://npms.io/search?q=%40aiready

### GitHub Insights

- **Pulse**: https://github.com/getaiready/aiready-cli/pulse
- **Traffic**: https://github.com/getaiready/aiready-cli/graphs/traffic
- **Community**: https://github.com/getaiready/aiready-cli/pulse

Quick access: `make stats-dashboard`

## Tips for Growth

### Weekly Routine

**Monday (Export baseline):**

```bash
make stats-export
make stats-compare
```

**Tuesday-Thursday (Content creation):**

- Analyze popular repos with your tools
- Post findings to Twitter/Reddit
- Write blog posts with data

**Friday (Review):**

```bash
make stats-weekly
```

### What to Track

**Leading Indicators (predict future growth):**

- GitHub stars/forks
- Issues/PRs opened
- Community engagement (comments)
- Social media mentions

**Lagging Indicators (measure current success):**

- NPM downloads
- Package versions
- Dependencies (who depends on you)

### Growth Milestones

- [ ] 1K downloads/week
- [ ] 5K downloads/week
- [x] 10K downloads/week ✅ (achieved!)
- [ ] 25K downloads/week
- [ ] 50K downloads/week
- [ ] 100 GitHub stars
- [ ] 500 GitHub stars
- [ ] 1K GitHub stars

## Privacy & Ethics

Our stats tracking is:

- ✅ Public data only (NPM API, GitHub API)
- ✅ No user tracking without consent
- ✅ No personally identifiable information
- ✅ Aggregate metrics only

For CLI telemetry (future):

- Opt-in only
- Anonymous user IDs
- Minimal data collection
- Clear privacy policy

## Troubleshooting

**"jq: command not found"**

```bash
brew install jq
```

**"gh: command not found"**

```bash
brew install gh
gh auth login
```

**"No historical data for comparison"**

```bash
# Run stats-export regularly to build history
make stats-export
```

**GitHub API rate limiting**

```bash
# Set GitHub token for higher limits
export GITHUB_TOKEN=ghp_your_token_here
gh auth login
```

## Next Steps

1. **Set up automation**: Add weekly stats export to cron/GitHub Actions
2. **Track competitors**: Monitor similar tools for benchmarking
3. **Set goals**: Define quarterly growth targets
4. **Share wins**: Post milestones to social media

---

**Questions?** Open an issue or check the [main README](../README.md).
