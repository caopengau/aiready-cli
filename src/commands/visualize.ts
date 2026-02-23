/**
 * Visualize command - Generate interactive visualization from an AIReady report
 */

import chalk from 'chalk';
import { writeFileSync, readFileSync, existsSync, copyFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { spawn } from 'child_process';
import { handleCLIError } from '@aiready/core';
import { generateHTML } from '@aiready/core';
import { findLatestScanReport } from '../utils/helpers';

interface VisualizeOptions {
  report?: string;
  output?: string;
  open?: boolean;
  serve?: boolean | number;
  dev?: boolean;
}

export async function visualizeAction(directory: string, options: VisualizeOptions) {
  try {
    const dirPath = resolvePath(process.cwd(), directory || '.');
    let reportPath = options.report ? resolvePath(dirPath, options.report) : null;
    
    // If report not provided or not found, try to find latest scan report
    if (!reportPath || !existsSync(reportPath)) {
      const latestScan = findLatestScanReport(dirPath);
      if (latestScan) {
        reportPath = latestScan;
        console.log(chalk.dim(`Found latest report: ${latestScan.split('/').pop()}`));
      } else {
        console.error(chalk.red('❌ No AI readiness report found'));
        console.log(chalk.dim(`\nGenerate a report with:\n  aiready scan --output json\n\nOr specify a custom report:\n  aiready visualise --report <path-to-report.json>`));
        return;
      }
    }

    const raw = readFileSync(reportPath, 'utf8');
    const report = JSON.parse(raw);

    // Load config to extract graph caps
    const configPath = resolvePath(dirPath, 'aiready.json');
    let graphConfig = { maxNodes: 400, maxEdges: 600 };
    
    if (existsSync(configPath)) {
      try {
        const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
        if (rawConfig.visualizer?.graph) {
          graphConfig = {
            maxNodes: rawConfig.visualizer.graph.maxNodes ?? graphConfig.maxNodes,
            maxEdges: rawConfig.visualizer.graph.maxEdges ?? graphConfig.maxEdges,
          };
        }
      } catch (e) {
        // Silently ignore parse errors and use defaults
      }
    }
    
    // Store config in env for vite middleware to pass to client
    const envVisualizerConfig = JSON.stringify(graphConfig);
    process.env.AIREADY_VISUALIZER_CONFIG = envVisualizerConfig;

    console.log("Building graph from report...");
    const { GraphBuilder } = await import('@aiready/visualizer/graph');
    const graph = GraphBuilder.buildFromReport(report, dirPath);

    // Check if --dev mode is requested and available
    let useDevMode = options.dev || false;
    let devServerStarted = false;
    
    if (useDevMode) {
      try {
        const monorepoWebDir = resolvePath(dirPath, 'packages/visualizer');
        let webDir = '';
        let visualizerAvailable = false;
        
        if (existsSync(monorepoWebDir)) {
          webDir = monorepoWebDir;
          visualizerAvailable = true;
        } else {
          // Try to resolve installed @aiready/visualizer package from node_modules
          const nodemodulesLocations: string[] = [
            resolvePath(dirPath, 'node_modules', '@aiready', 'visualizer'),
            resolvePath(process.cwd(), 'node_modules', '@aiready', 'visualizer'),
          ];
          
          // Walk up directory tree to find node_modules in parent directories
          let currentDir = dirPath;
          while (currentDir !== '/' && currentDir !== '.') {
            nodemodulesLocations.push(resolvePath(currentDir, 'node_modules', '@aiready', 'visualizer'));
            const parent = resolvePath(currentDir, '..');
            if (parent === currentDir) break;
            currentDir = parent;
          }
          
          for (const location of nodemodulesLocations) {
            if (existsSync(location) && existsSync(resolvePath(location, 'package.json'))) {
              webDir = location;
              visualizerAvailable = true;
              break;
            }
          }
          
          // Fallback: try require.resolve
          if (!visualizerAvailable) {
            try {
              const vizPkgPath = require.resolve('@aiready/visualizer/package.json');
              webDir = resolvePath(vizPkgPath, '..');
              visualizerAvailable = true;
            } catch (e) {
              // Visualizer not found
            }
          }
        }
        
        // Check if web directory with vite config exists (required for dev mode)
        const webViteConfigExists = webDir && existsSync(resolvePath(webDir, 'web', 'vite.config.ts'));
        
        if (visualizerAvailable && webViteConfigExists) {
          // Dev mode is available - start Vite dev server
          const spawnCwd = webDir!;

          // Inline report watcher: copy report to web/report-data.json and watch for changes
          const { watch } = await import('fs');
          const copyReportToViz = () => {
            try {
              const destPath = resolvePath(spawnCwd, 'web', 'report-data.json');
              copyFileSync(reportPath!, destPath);
              console.log(`📋 Report synced to ${destPath}`);
            } catch (e) {
              console.error('Failed to sync report:', e);
            }
          };
          
          // Initial copy
          copyReportToViz();
          
          // Watch source report for changes
          let watchTimeout: NodeJS.Timeout | null = null;
          const reportWatcher = watch(reportPath, () => {
            if (watchTimeout) clearTimeout(watchTimeout);
            watchTimeout = setTimeout(copyReportToViz, 100);
          });

          const envForSpawn = { 
            ...process.env, 
            AIREADY_REPORT_PATH: reportPath,
            AIREADY_VISUALIZER_CONFIG: envVisualizerConfig 
          };
          const vite = spawn("pnpm", ["run", "dev:web"], { cwd: spawnCwd, stdio: "inherit", shell: true, env: envForSpawn });
          const onExit = () => {
            try { reportWatcher.close(); } catch (e) {}
            try { vite.kill(); } catch (e) {}
            process.exit(0);
          };
          process.on("SIGINT", onExit);
          process.on("SIGTERM", onExit);
          devServerStarted = true;
          return;
        } else {
          console.log(chalk.yellow('⚠️  Dev server not available (requires local @aiready/visualizer with web assets).'));
          console.log(chalk.cyan('   Falling back to static HTML generation...\n'));
          useDevMode = false;
        }
      } catch (err) {
        console.error("Failed to start dev server:", err);
        console.log(chalk.cyan('   Falling back to static HTML generation...\n'));
        useDevMode = false;
      }
    }

    // Generate static HTML (default behavior or fallback from failed --dev)
    console.log("Generating HTML...");
    const html = generateHTML(graph);
    const defaultOutput = 'visualization.html';
    const outPath = resolvePath(dirPath, options.output || defaultOutput);
    writeFileSync(outPath, html, 'utf8');
    console.log(chalk.green(`✅ Visualization written to: ${outPath}`));
    

    if (options.open || options.serve) {
      const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      
      if (options.serve) {
        try {
          const port = typeof options.serve === 'number' ? options.serve : 5173;
          const http = await import('http');
          const fsp = await import('fs/promises');

          const server = http.createServer(async (req, res) => {
            try {
              const urlPath = req.url || '/';
              if (urlPath === '/' || urlPath === '/index.html') {
                const content = await fsp.readFile(outPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
                return;
              }
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Server error');
            }
          });

          server.listen(port, () => {
            const addr = `http://localhost:${port}/`;
            console.log(chalk.cyan(`🌐 Local visualization server running at ${addr}`));
            spawn(opener, [`"${addr}"`], { shell: true });
          });

          process.on('SIGINT', () => {
            server.close();
            process.exit(0);
          });
        } catch (err) {
          console.error('Failed to start local server:', err);
        }
      } else if (options.open) {
        spawn(opener, [`"${outPath}"`], { shell: true });
      }
    }

  } catch (err: any) {
    handleCLIError(err, 'Visualization');
  }
}

export const visualizeHelpText = `
EXAMPLES:
  $ aiready visualize .  # Auto-detects latest report, generates HTML
  $ aiready visualize . --report .aiready/aiready-report-20260217-143022.json
  $ aiready visualize . --report report.json -o out/visualization.html --open
  $ aiready visualize . --report report.json --serve
  $ aiready visualize . --report report.json --serve 8080
  $ aiready visualize . --report report.json --dev

NOTES:
  - The value passed to --report is interpreted relative to the directory argument (first positional).
    If the report is not found, the CLI will suggest running 'aiready scan' to generate it.
  - Default output path: visualization.html (in the current directory).
  - --serve starts a tiny single-file HTTP server (default port: 5173) and opens your browser.
  - --dev starts a Vite dev server with live reload (requires local @aiready/visualizer installation).
    When --dev is not available, it falls back to static HTML generation.
`;

export const visualiseHelpText = `
EXAMPLES:
  $ aiready visualise .  # Auto-detects latest report
  $ aiready visualise . --report .aiready/aiready-report-20260217-143022.json
  $ aiready visualise . --report report.json --serve 8080

NOTES:
  - Same options as 'visualize'. Use --serve to host the static HTML, or --dev for live reload.
`;