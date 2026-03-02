import fs from 'fs';
import { resolve as resolvePath } from 'path';
import chalk from 'chalk';
import { handleCLIError } from '@aiready/core';

interface UploadOptions {
  apiKey?: string;
  repoId?: string;
  server?: string;
}

export async function uploadAction(file: string, options: UploadOptions) {
  const startTime = Date.now();
  const filePath = resolvePath(process.cwd(), file);
  const serverUrl =
    options.server ||
    process.env.AIREADY_SERVER ||
    'https://dev.platform.getaiready.dev';
  const apiKey = options.apiKey || process.env.AIREADY_API_KEY;

  if (!apiKey) {
    console.error(chalk.red('❌ API Key is required for upload.'));
    console.log(
      chalk.dim(
        '   Set AIREADY_API_KEY environment variable or use --api-key flag.'
      )
    );
    console.log(
      chalk.dim('   Get an API key from https://getaiready.dev/dashboard')
    );
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`❌ File not found: ${filePath}`));
    process.exit(1);
  }

  try {
    console.log(chalk.blue(`🚀 Uploading report to ${serverUrl}...`));

    // Read the report file
    console.log(chalk.dim(`   Reading report from ${filePath}...`));
    const reportContent = fs.readFileSync(filePath, 'utf-8');
    const reportData = JSON.parse(reportContent);
    console.log(chalk.dim(`   Successfully parsed report JSON.`));

    // Prepare upload payload
    // Note: repoId is optional if the metadata contains it, but for now we'll require it or infer from metadata
    const repoId = options.repoId || reportData.repository?.repoId;

    const res = await fetch(`${serverUrl}/api/analysis/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: reportData,
        repoId, // Might be null, server will handle mapping
      }),
    });

    const contentType = res.headers.get('content-type');
    let result: any = {};

    if (contentType?.includes('application/json')) {
      result = await res.json();
    } else {
      const text = await res.text();
      result = { error: text || res.statusText };
    }

    if (!res.ok) {
      console.error(
        chalk.red(`❌ Upload failed: ${result.error || res.statusText}`)
      );

      // Special case for redirects or HTML error pages
      if (contentType?.includes('text/html')) {
        console.log(
          chalk.yellow(
            '   Note: Received an HTML response. This often indicates a redirect (e.g., to a login page) or a server error.'
          )
        );
        if (result.error?.includes('Redirecting')) {
          console.log(
            chalk.dim(
              '   Detected redirect. Check if the API endpoint requires authentication or has changed.'
            )
          );
        }
      }

      if (res.status === 401) {
        console.log(
          chalk.dim('   Hint: Your API key may be invalid or expired.')
        );
      }
      process.exit(1);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(chalk.green(`\n✅ Upload successful! (${duration}s)`));
    console.log(chalk.cyan(`   View results: ${serverUrl}/dashboard`));

    if (result.analysis) {
      console.log(chalk.dim(`   Analysis ID: ${result.analysis.id}`));
      console.log(chalk.dim(`   Score: ${result.analysis.aiScore}/100`));
    }
  } catch (error) {
    handleCLIError(error, 'Upload');
  }
}

export const uploadHelpText = `
EXAMPLES:
  $ aiready upload report.json --api-key ar_...
  $ aiready upload .aiready/latest.json
  $ AIREADY_API_KEY=ar_... aiready upload report.json

ENVIRONMENT VARIABLES:
  AIREADY_API_KEY    Your platform API key
  AIREADY_SERVER     Custom platform URL (default: https://dev.platform.getaiready.dev)
`;
