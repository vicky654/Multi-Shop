import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEMO_DIR = path.join(ROOT, 'scripts', 'demo');
export const OUTPUT_DIR = path.join(DEMO_DIR, 'output');
export const SHOTS_DIR = path.join(OUTPUT_DIR, 'images');
export const VIDEO_DIR = path.join(OUTPUT_DIR, 'video');

/**
 * Parse `.env.demo` without adding a dependency (dotenv lives in /server only).
 * Values are never printed — see `redact()`.
 */
const parseEnvFile = (file) => {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
};

const REQUIRED = ['DEMO_EMAIL', 'DEMO_PASSWORD', 'DEMO_DATABASE_URI'];

// Anything matching these is never allowed into logs
const SECRET_KEYS = /PASSWORD|SECRET|TOKEN|KEY|URI|DATABASE/i;

export const redact = (key, value) => (SECRET_KEYS.test(key) ? '••••••••' : value);

export function loadDemoEnv() {
  const file = path.join(ROOT, '.env.demo');

  if (!fs.existsSync(file)) {
    throw new Error(
      'Missing .env.demo at the repo root.\n' +
      '  Fix: cp .env.demo.example .env.demo   then fill in the values.\n' +
      '  Credentials are read from that file and are never hardcoded.'
    );
  }

  const env = parseEnvFile(file);
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`.env.demo is missing required keys: ${missing.join(', ')}`);
  }

  // Refuse to run against anything that isn't clearly a demo database. The
  // seeder wipes it, so this guard is the difference between a demo refresh and
  // destroying real data.
  const dbName = env.DEMO_DATABASE_URI.split('/').pop().split('?')[0];
  if (!/demo/i.test(dbName)) {
    throw new Error(
      `DEMO_DATABASE_URI database name "${dbName}" does not contain "demo".\n` +
      '  The demo seeder WIPES this database — rename it (e.g. multi-shop-demo).'
    );
  }

  return {
    ...env,
    DEMO_COMPANY_NAME:    env.DEMO_COMPANY_NAME    || 'Nova Retail Group',
    DEMO_COMPANY_TAGLINE: env.DEMO_COMPANY_TAGLINE || 'Multi-store retail, one dashboard',
    DEMO_API_PORT:        env.DEMO_API_PORT        || '5055',
    DEMO_WEB_PORT:        env.DEMO_WEB_PORT        || '4055',
    DEMO_VIEWPORT_WIDTH:  env.DEMO_VIEWPORT_WIDTH  || '1600',
    DEMO_VIEWPORT_HEIGHT: env.DEMO_VIEWPORT_HEIGHT || '900',
    _dbName: dbName,
  };
}

export const ensureDirs = (...dirs) =>
  dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── Console helpers ──────────────────────────────────────────────────────────
export const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);
export const ok   = (msg) => console.log(`   ✓ ${msg}`);
export const info = (msg) => console.log(`   · ${msg}`);
export const warn = (msg) => console.warn(`   ! ${msg}`);
