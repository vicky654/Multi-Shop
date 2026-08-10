/**
 * Demo Asset Automation — the one command.
 *
 *   npm run demo:update
 *
 * Pipeline: seed demo data → boot an isolated app → capture screenshots →
 * record video → publish to the marketing site → validate.
 *
 * Everything runs against a dedicated demo database on dedicated ports, so it
 * never touches development data and never collides with a running dev server.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {
  loadDemoEnv, ROOT, DEMO_DIR, OUTPUT_DIR, SHOTS_DIR, VIDEO_DIR,
  ensureDirs, step, ok, info, warn,
} from './lib/env.mjs';

const env = loadDemoEnv();
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const TOTAL = 6;

const API_PORT = Number(env.DEMO_API_PORT);
const WEB_PORT = Number(env.DEMO_WEB_PORT);
const API_URL  = `http://127.0.0.1:${API_PORT}/api`;

const children = [];
const cleanupFiles = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Process helpers ──────────────────────────────────────────────────────────
// Windows needs a shell to resolve `npx`, but a shell SPLITS an absolute exe path
// on its spaces — the Node binary under "C:/Program Files/nodejs" becomes
// 'C:/Program' and fails. So: shell only for bare command names, never for
// absolute paths.
const needsShell = (cmd) => process.platform === 'win32' && !path.isAbsolute(cmd);

/**
 * Merge env for a child process. A value of `null` means UNSET the variable —
 * setting it to '' is not enough for ELECTRON_RUN_AS_NODE, which Electron tests
 * for presence rather than truthiness. Some IDE terminals export it, and with it
 * present Cypress's Electron binary runs as plain Node and dies on its own CLI
 * flags ("Cannot find module '--run-project'").
 */
function buildEnv(extraEnv = {}) {
  const merged = { ...process.env, ...extraEnv };
  for (const [k, v] of Object.entries(merged)) {
    if (v === null || v === undefined) delete merged[k];
  }
  return merged;
}

// Secrets that must never reach a log file on disk. The API's login handler
// prints the submitted password when NODE_ENV !== 'production' (see
// auth.service.login), so its stdout is redacted here rather than trusted.
const SECRETS = [env.DEMO_PASSWORD, env.DEMO_DATABASE_URI].filter((s) => s && s.length > 6);

const redactStream = (chunk) => {
  let text = chunk.toString();
  for (const s of SECRETS) text = text.split(s).join('••••redacted••••');
  return text.replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, 'mongodb://••••');
};

function launch(name, cmd, args, cwd, extraEnv) {
  const child = spawn(cmd, args, {
    cwd,
    env: buildEnv(extraEnv),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: needsShell(cmd),
  });
  // Append synchronously per chunk: a buffered WriteStream loses the tail when
  // the child is force-killed at shutdown, which is exactly when you need the log.
  const logFile = path.join(OUTPUT_DIR, `${name}.log`);
  fs.writeFileSync(logFile, '');
  const write = (chunk) => {
    try { fs.appendFileSync(logFile, redactStream(chunk)); } catch { /* best effort */ }
  };
  child.stdout.on('data', write);
  child.stderr.on('data', write);
  child.on('exit', (code) => {
    if (code && code !== 0 && !shuttingDown) {
      warn(`${name} exited early (code ${code}) — see output/${name}.log`);
    }
  });
  children.push({ name, child });
  return child;
}

let shuttingDown = false;
function shutdown() {
  shuttingDown = true;
  for (const f of cleanupFiles) {
    try { fs.rmSync(f, { force: true }); } catch { /* best effort */ }
  }
  for (const { child } of children) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch { /* already gone */ }
  }
}
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });

const portOpen = (port) => new Promise((resolve) => {
  const sock = net.createConnection({ host: '127.0.0.1', port }, () => {
    sock.destroy(); resolve(true);
  });
  sock.on('error', () => resolve(false));
  sock.setTimeout(1200, () => { sock.destroy(); resolve(false); });
});

async function waitForPort(port, label, timeoutMs = 120000, child = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) { ok(`${label} ready on :${port}`); return true; }
    // Stop waiting the moment the process dies — no point burning the timeout
    if (child && child.exitCode !== null) return false;
    await sleep(1000);
  }
  return false;
}

/**
 * Launch a server and wait for its port, retrying if it dies during startup.
 * Startup can fail transiently (DNS SRV resolution for mongodb+srv), and
 * server.js exits rather than retrying, so supervise it here.
 */
async function launchWithRetry(name, cmd, args, cwd, extraEnv, port, label, attempts = 3) {
  for (let i = 1; i <= attempts; i += 1) {
    const child = launch(name, cmd, args, cwd, extraEnv);
    if (await waitForPort(port, label, 90000, child)) return;

    info(`${label} start attempt ${i} failed — retrying…`);
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else child.kill('SIGTERM');
    } catch { /* already gone */ }
    await sleep(i * 2500);
  }
  throw new Error(`${label} did not come up on :${port} after ${attempts} attempts — see output/${name}.log`);
}

function run(name, cmd, args, cwd, extraEnv) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: buildEnv(extraEnv),
    stdio: 'inherit',
    shell: needsShell(cmd),
  });
  if (res.status !== 0) throw new Error(`${name} failed (exit ${res.status})`);
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
async function main() {
  ensureDirs(OUTPUT_DIR, SHOTS_DIR, VIDEO_DIR);

  console.log('\n══ MultiShop Demo Asset Automation ══');
  info(`demo database : ${env._dbName}`);
  info(`company       : ${env.DEMO_COMPANY_NAME}`);
  info(`viewport      : ${env.DEMO_VIEWPORT_WIDTH}×${env.DEMO_VIEWPORT_HEIGHT}`);
  info(`marketing path: ${env.MARKETING_WEBSITE_PATH || '(not set — will stop after capture)'}`);

  for (const port of [API_PORT, WEB_PORT]) {
    if (await portOpen(port)) {
      throw new Error(`Port ${port} is already in use. Free it or change DEMO_API_PORT/DEMO_WEB_PORT in .env.demo.`);
    }
  }

  // ── 1. Demo data ───────────────────────────────────────────────────────────
  step(1, TOTAL, 'Reset + seed isolated demo account');
  // DEMO_SEED_SCRIPT lets a themed demo (e.g. the shoes store) supply its own seeder
  run('demo seed', process.execPath, [path.join(DEMO_DIR, process.env.DEMO_SEED_SCRIPT || 'seed-demo.mjs')], ROOT);

  // ── 2. Boot the app in demo mode ───────────────────────────────────────────
  step(2, TOTAL, 'Booting API + web on demo ports');

  const demoEnv = {
    NODE_ENV: 'demo',
    DEMO_DATABASE_URI: env.DEMO_DATABASE_URI,
    PORT: String(API_PORT),
    // The demo web origin must be CORS-allowed. Without it every SPA request is
    // rejected, authStore.fetchMe() fails, the axios interceptor clears the
    // token, and ProtectedRoute bounces the capture to /login.
    CLIENT_URL: [
      `http://127.0.0.1:${WEB_PORT}`,
      `http://localhost:${WEB_PORT}`,
      process.env.CLIENT_URL,
    ].filter(Boolean).join(','),
  };
  // server.js exits(1) if the DB connect fails, and `mongodb+srv://` DNS lookups
  // fail transiently on flaky networks — so relaunch rather than aborting the run.
  await launchWithRetry('api', process.execPath, ['server.js'], SERVER_DIR, demoEnv, API_PORT, 'API');

  // Point the SPA at the demo API.
  //
  // This goes through a generated `client/.env.demo` + `--mode demo` rather than
  // a process env var, because client/.env.local already pins VITE_API_URL to the
  // dev API on :5001 and Vite's mode file (.env.[mode]) outranks .env.local.
  // Without this the demo SPA would quietly capture DEVELOPMENT data.
  //
  // Note axios appends "/api" itself, so this is the ORIGIN, not the API URL.
  const viteEnvFile = path.join(CLIENT_DIR, '.env.demo');
  fs.writeFileSync(viteEnvFile,
    '# Generated by scripts/demo/update.mjs — do not edit or commit.\n' +
    `VITE_API_URL=http://127.0.0.1:${API_PORT}\n`);
  cleanupFiles.push(viteEnvFile);

  await launchWithRetry('web', 'npx',
    ['vite', '--mode', 'demo', '--port', String(WEB_PORT), '--host', '127.0.0.1', '--strictPort'],
    CLIENT_DIR, {}, WEB_PORT, 'Web');

  // Confirm the API really is on the demo database before capturing anything
  const health = await fetch(`${API_URL}/shops/public`).then((r) => r.json()).catch(() => null);
  if (!health?.success) warn('API health probe inconclusive — continuing');
  else ok(`API serving ${health.data?.shops?.length ?? 0} demo shops`);

  const captureEnv = {
    ...demoEnv,
    DEMO_API_URL: API_URL,
    DEMO_API_PORT: String(API_PORT),
    DEMO_WEB_PORT: String(WEB_PORT),
    DEMO_EMAIL: env.DEMO_EMAIL,
    DEMO_PASSWORD: env.DEMO_PASSWORD,
    DEMO_COMPANY_NAME: env.DEMO_COMPANY_NAME,
    DEMO_VIEWPORT_WIDTH: env.DEMO_VIEWPORT_WIDTH,
    DEMO_VIEWPORT_HEIGHT: env.DEMO_VIEWPORT_HEIGHT,
    // null = unset (see buildEnv). Must be absent, not empty, or Cypress's
    // Electron binary runs as plain Node and cannot start.
    ELECTRON_RUN_AS_NODE: null,
  };

  // ── 3. Screenshots ─────────────────────────────────────────────────────────
  step(3, TOTAL, 'Capturing module screenshots');
  const skipShots = process.env.DEMO_SKIP_SCREENSHOTS === '1';

  // Clear stale captures ONCE, here — not via Cypress's trashAssetsBeforeRuns,
  // which would fire again on the video run and delete these screenshots.
  fs.rmSync(path.join(CLIENT_DIR, 'cypress', 'demo-output'), { recursive: true, force: true });

  if (!skipShots) run('screenshot capture', 'npx',
    ['cypress', 'run', '--config-file', 'cypress.demo.config.js',
      '--spec', 'cypress/demo/01-screenshots.cy.js'],
    CLIENT_DIR, captureEnv);

  // ── 4. Video ───────────────────────────────────────────────────────────────
  step(4, TOTAL, 'Recording product tour video (H.264 MP4)');
  run('video capture', 'npx',
    ['cypress', 'run', '--config-file', 'cypress.demo.config.js',
      '--spec', process.env.DEMO_TOUR_SPEC || 'cypress/demo/02-tour.cy.js'],
    CLIENT_DIR, captureEnv);

  // ── 5. Collect + publish ───────────────────────────────────────────────────
  step(5, TOTAL, 'Collecting assets and publishing to marketing site');
  run('publish', process.execPath, [path.join(DEMO_DIR, 'publish.mjs')], ROOT);

  // ── 6. Validate ────────────────────────────────────────────────────────────
  step(6, TOTAL, 'Validating assets');
  run('validate', process.execPath, [path.join(DEMO_DIR, 'validate.mjs')], ROOT);

  shutdown();
  console.log('\n✓ Demo assets updated.\n');
}

main().catch((err) => {
  console.error(`\n✖ demo:update failed — ${err.message}\n`);
  shutdown();
  process.exit(1);
});
