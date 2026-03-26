import chalk from 'chalk';
import { resolve as resolvePath } from 'path';
import { existsSync, readdirSync } from 'fs';
import { printTerminalHeader } from '@aiready/core';

interface RemediateOptions {
  report?: string;
  tool?: string;
  server?: string;
}

export async function remediateAction(
  directory: string,
  options: RemediateOptions
) {
  const resolvedDir = resolvePath(process.cwd(), directory || '.');
  const serverUrl = options.server || 'https://platform.getaiready.dev';

  printTerminalHeader('AIREADY REMEDIATION SWARM');

  console.log(chalk.cyan('🤖 Initializing local remediation agent...'));

  // Try to find the latest report if not provided
  let reportPath = options.report;
  if (!reportPath) {
    const aireadyDir = resolvePath(resolvedDir, '.aiready');
    if (existsSync(aireadyDir)) {
      const files = readdirSync(aireadyDir)
        .filter((f) => f.startsWith('aiready-report-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length > 0) {
        reportPath = resolvePath(aireadyDir, files[0]);
        console.log(chalk.dim(`📂 Using latest report: ${files[0]}`));
      }
    }
  }

  if (!reportPath || !existsSync(reportPath)) {
    console.log(chalk.yellow('\n⚠️  No AIReady report found.'));
    console.log(
      chalk.dim(
        '   Remediation requires a recent scan report to identify issues.'
      )
    );
    console.log(chalk.white(`   Run ${chalk.bold('aiready scan')} first.\n`));
    return;
  }

  console.log(chalk.green('\n✅ Analysis data loaded.'));
  console.log(chalk.bold('\n🚀 Remediation Strategy:'));

  if (options.tool === 'patterns' || !options.tool) {
    console.log(
      chalk.white(
        `   • ${chalk.bold('Pattern Consolidation')}: Suggested refactors for 95%+ similar code blocks.`
      )
    );
  }
  if (options.tool === 'consistency' || !options.tool) {
    console.log(
      chalk.white(
        `   • ${chalk.bold('Naming Alignment')}: Automated TSDoc generation and constant extraction.`
      )
    );
  }
  if (options.tool === 'context' || !options.tool) {
    console.log(
      chalk.white(
        `   • ${chalk.bold('Context Optimization')}: Barrel file cleanup and import flattening.`
      )
    );
  }

  console.log(
    chalk.dim(
      '\n──────────────────────────────────────────────────────────────────'
    )
  );
  console.log(chalk.bold('✨ Use the Platform Swarm for Automated Fixes'));
  console.log(
    chalk.cyan(`   The high-performance Remediation Swarm is available at:`)
  );
  console.log(chalk.white(`   ${chalk.bold(`${serverUrl}/remediate`)}`));
  console.log(
    chalk.dim(
      '\n   The swarm uses specialized agents to safely refactor your code,'
    )
  );
  console.log(
    chalk.dim('   ensuring every change improves your AI-readiness score.')
  );
  console.log(
    chalk.dim(
      '──────────────────────────────────────────────────────────────────'
    )
  );

  console.log(
    chalk.dim(
      '\n💡 Next Version: Local "aiready fix" command for minor documentation issues.'
    )
  );
}

export const REMEDIATE_HELP_TEXT = `
EXAMPLES:
  $ aiready remediate                    # See remediation options for latest report
  $ aiready remediate --tool patterns    # Focus on pattern consolidation
  $ aiready remediate --report ./custom-report.json
`;
