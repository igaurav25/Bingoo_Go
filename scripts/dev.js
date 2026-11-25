/**
 * scripts/dev.js
 *
 * Coordinated development runner:
 * 1. Builds React frontend bundle cleanly (halts if initial build fails)
 * 2. Starts esbuild watcher so src/ changes auto-rebuild without manual edits
 * 3. Starts server/server.js with Node's --watch flag for backend auto-restarts
 */

import { spawn, execSync } from 'node:child_process';

console.log('🚀 Starting Bingoo Goo Development Environment...');

try {
  execSync('node build.js', { stdio: 'inherit' });
} catch {
  console.error('❌ Initial frontend build failed. Aborting dev startup.');
  process.exit(1);
}

const watcher = spawn(process.execPath, ['build.js', '--watch'], {
  stdio: 'inherit'
});

const serverProc = spawn(process.execPath, ['--watch', 'server/server.js'], {
  stdio: 'inherit'
});

function shutdown() {
  watcher.kill();
  serverProc.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
