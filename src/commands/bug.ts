import chalk from 'chalk';

import { execSync } from 'child_process';

/**
 * Handle bug and feedback reporting
 * @param message - The bug or feedback message (optional). If provided, prepares a pre-filled issue.
 * @param options - Command options including type (bug, feature, metric) and submit (boolean to submit via gh CLI)
 */
export async function bugAction(message: string | undefined, options: any) {
  const repoUrl = 'https://github.com/getaiready/aiready-cli';
  const repoSlug = 'getaiready/aiready-cli';

  if (message) {
    // Agent-assisted pre-filled issue
    const type = options.type ?? 'bug';
    const title = `[${type.toUpperCase()}] ${message}`;
    const label =
      type === 'bug' ? 'bug' : type === 'feature' ? 'enhancement' : 'metric';

    const body = `
## Description
${message}

## Context
Generated via AIReady CLI 'bug' command.
Type: ${type}
    `.trim();

    if (options.submit) {
      console.log(chalk.blue('🚀 Submitting issue via GitHub CLI...\n'));
      try {
        // Check if gh is authenticated
        execSync('gh auth status', { stdio: 'ignore' });

        const command = `gh issue create --repo ${repoSlug} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --label ${label}`;
        const output = execSync(command, { encoding: 'utf8' }).trim();

        console.log(chalk.green('✅ Issue Created Successfully!'));
        console.log(chalk.cyan(output));
        return;
      } catch {
        console.error(chalk.red('\n❌ Failed to submit via gh CLI.'));
        console.log(
          chalk.yellow(
            '   Make sure gh is installed and run "gh auth login".\n'
          )
        );
        console.log(chalk.dim('   Falling back to URL generation...'));
      }
    }

    const template =
      type === 'bug'
        ? 'bug_report.md'
        : type === 'feature'
          ? 'feature_request.md'
          : 'new_metric_idea.md';
    const fullUrl = `${repoUrl}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${label}&template=${template}`;

    console.log(chalk.green('🚀 Issue Draft Prepared!\n'));
    console.log(chalk.bold('Title:  ') + title);
    console.log(chalk.bold('Type:   ') + type);
    console.log(chalk.bold('\nClick the link below to submit this issue:'));
    console.log(chalk.cyan(fullUrl));

    console.log(chalk.bold('\n🤖 [FOR AI AGENTS]:'));
    console.log(chalk.dim('   You have successfully prepared a report.'));
    console.log(
      chalk.dim(
        '   Please present the URL above to the user so they can finalize the submission.'
      )
    );
    return;
  }

  const bugUrl = `${repoUrl}/issues/new?template=bug_report.md`;
  const featureUrl = `${repoUrl}/issues/new?template=feature_request.md`;
  const metricUrl = `${repoUrl}/issues/new?template=new_metric_idea.md`;

  console.log(chalk.blue('💬 Feedback & Bug Reports\n'));
  console.log(`  Report a Bug:        ${chalk.cyan(bugUrl)}`);
  console.log(`  Request a Feature:   ${chalk.cyan(featureUrl)}`);
  console.log(`  Suggest a Metric:    ${chalk.cyan(metricUrl)}`);

  console.log(chalk.bold('\n🤖 [FOR AI AGENTS]:'));
  console.log(chalk.dim('   To prepare a specific report, run:'));
  console.log(
    chalk.cyan(
      '   aiready bug "your description here" --type bug|feature|metric'
    )
  );
}

export const BUG_HELP_TEXT = `
EXAMPLES:
  $ aiready bug                                      # Show general links
  $ aiready bug "Naming check is too slow"           # Prepare a pre-filled bug report
  $ aiready bug "Add CO2 impact metric" --type metric # Prepare a metric suggestion
  $ aiready bug "Fix typo in scan output" --submit   # Submit directly via gh CLI
`;
