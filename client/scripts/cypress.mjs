#!/usr/bin/env node
/**
 * Cypress launcher.
 *
 * WHY THIS WRAPPER EXISTS
 *   VS Code's extension host sets ELECTRON_RUN_AS_NODE=1, and every terminal and
 *   task spawned from it inherits the variable. Cypress ships its own Electron
 *   binary; with that flag set, Electron starts as plain Node instead. It then
 *   cannot parse its own Electron arguments and rejects its V8 code cache, which
 *   surfaces as two confusing errors that look like a broken install:
 *
 *     Cypress.exe: bad option: --smoke-test
 *     Error: Invalid or incompatible cached data (cachedDataRejected)
 *
 *   Nothing is wrong with Cypress. Clearing the cache and reinstalling does not
 *   help, because the next run inherits the same variable again.
 *
 *   So the fix is to delete the variable for the Cypress child process. Doing it
 *   here rather than in a shell prefix keeps `npm run cy:run` working identically
 *   from Git Bash, PowerShell, cmd, a VS Code task and CI — `VAR= cmd` is not
 *   valid cmd.exe syntax, and `cross-env` cannot unset a variable at all.
 *
 * Usage: node scripts/cypress.mjs <any cypress args>
 *   e.g. node scripts/cypress.mjs run --spec "cypress/e2e/01-*.cy.js"
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);

// Variables that make Electron behave as Node. Removed only for this child.
const ELECTRON_NODE_VARS = ['ELECTRON_RUN_AS_NODE'];

const env = { ...process.env };
const stripped = [];
for (const key of ELECTRON_NODE_VARS) {
  if (env[key] !== undefined) {
    delete env[key];
    stripped.push(key);
  }
}

if (stripped.length) {
  console.log(`[cypress] unset ${stripped.join(', ')} for this run `
            + '(VS Code sets it; it makes Cypress’s Electron run as Node)');
}

/**
 * Resolve Cypress's CLI entry from the installed package.
 *
 * `require.resolve('cypress/bin/cypress')` does not work: Cypress declares an
 * `exports` map that does not include `./bin/`, so subpath resolution is blocked.
 * Its package.json IS exported though, and it names its own bin — so read the
 * path from there rather than hardcoding node_modules/.bin, which differs between
 * platforms and package managers.
 */
let cypressBin;
try {
  const pkgPath = require.resolve('cypress/package.json');
  const pkg = require('cypress/package.json');
  const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.cypress;
  if (!rel) throw new Error('cypress package.json declares no bin');
  cypressBin = path.join(path.dirname(pkgPath), rel);
  if (!existsSync(cypressBin)) throw new Error(`not found at ${cypressBin}`);
} catch (err) {
  console.error(`[cypress] could not locate the Cypress CLI (${err.message})`);
  console.error('[cypress] run `npm install` in client/ first');
  process.exit(1);
}

const child = spawn(process.execPath, [cypressBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  // Preserve Cypress's exit code: CI and `npm test` chains depend on it, and a
  // wrapper that always exits 0 would turn a failing suite green.
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error('[cypress] failed to start:', err.message);
  process.exit(1);
});
