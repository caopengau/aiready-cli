import chalk from 'chalk';
import {
  formatToolScore,
  getTerminalDivider as coreGetDivider,
} from '@aiready/core';

export const SAFETY_ICONS: Record<string, string> = {
  safe: '✅',
  'moderate-risk': '⚠️ ',
  'high-risk': '🔴',
  'blind-risk': '💀',
};

export const SAFETY_COLORS: Record<string, (s: string) => string> = {
  safe: chalk.green,
  'moderate-risk': chalk.yellow,
  'high-risk': chalk.red,
  'blind-risk': chalk.bgRed.white,
};

/**
 * Standard tool header for CLI output
 */
export function renderToolHeader(
  label: string,
  emoji: string,
  score: number,
  rating: string
) {
  console.log(
    `  ${emoji} ${label}:         ${chalk.bold(score + '/100')} (${rating})`
  );
}

/**
 * Standard safety rating renderer
 */
export function renderSafetyRating(safety: string) {
  const icon = SAFETY_ICONS[safety] ?? '❓';
  const color = SAFETY_COLORS[safety] ?? chalk.white;
  console.log(
    `     AI Change Safety:  ${color(`${icon} ${safety.toUpperCase()}`)}`
  );
}

/**
 * Standard issue summary block
 */
export function renderIssueSummaryBlock(summary: any) {
  const total =
    (summary.criticalIssues || 0) +
    (summary.majorIssues || 0) +
    (summary.minorIssues || 0);
  if (total === 0) {
    console.log(chalk.green('✅ No significant issues found!\n'));
    return;
  }
  console.log(chalk.bold('⚠️  Issues Found:\n'));
  if (summary.criticalIssues > 0)
    console.log(
      chalk.red(`   🔴 Critical: ${chalk.bold(summary.criticalIssues)}`)
    );
  if (summary.majorIssues > 0)
    console.log(
      chalk.yellow(`   🟡 Major: ${chalk.bold(summary.majorIssues)}`)
    );
  if (summary.minorIssues > 0)
    console.log(chalk.blue(`   🔵 Minor: ${chalk.bold(summary.minorIssues)}`));

  if (summary.totalPotentialSavings) {
    console.log(
      chalk.green(
        `\n   💡 Potential savings: ${chalk.bold(summary.totalPotentialSavings.toLocaleString())} tokens\n`
      )
    );
  }
}

/**
 * Render a sub-section with dividers
 */
export function renderSubSection(title: string) {
  console.log('\n' + coreGetDivider());
  console.log(chalk.bold.white(`  ${title.toUpperCase()}`));
  console.log(coreGetDivider() + '\n');
}

/**
 * Standard footer with readiness score
 */
export function renderToolScoreFooter(score: any) {
  if (score) {
    console.log(`\n📊 AI Readiness Score (${score.toolName || 'Tool'})\n`);
    console.log(formatToolScore(score));
    console.log();
  }
}
