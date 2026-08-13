#!/usr/bin/env node
/**
 * Move recorded guide videos into public/guides/ under the ids the UI expects.
 *
 * Cypress names a video after its spec file (g04-creating-a-bill.cy.js.mp4), but
 * the UI looks for /guides/<guide id>.mp4. This maps one to the other using the
 * SAME registry the UI reads, so a renamed guide cannot silently stop resolving.
 *
 * Only videos that actually exist are copied. Nothing is stubbed: a guide with no
 * recording keeps showing its written walkthrough, which is the intended
 * behaviour rather than a degraded one.
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SRC = path.join(root, 'cypress', 'videos', 'guides');
const DEST = path.join(root, 'public', 'guides');

// Read the guide ids and their spec paths straight out of the registry, so this
// script and the UI can never disagree about the filename.
const registry = readFileSync(path.join(root, 'src', 'constants', 'guides.js'), 'utf8');
const guides = [...registry.matchAll(/id:\s*'([^']+)'[\s\S]*?videoSpec:\s*'([^']+)'/g)]
  .map(([, id, spec]) => ({ id, spec: path.basename(spec) }));

if (!guides.length) {
  console.error('[guides] could not read any guides from src/constants/guides.js');
  process.exit(1);
}

if (!existsSync(SRC)) {
  console.log(`[guides] no recordings found at ${path.relative(root, SRC)}`);
  console.log('[guides] run `npm run guides:record` first (needs the app running on :4000)');
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });

const available = readdirSync(SRC).filter((f) => f.endsWith('.mp4'));
let copied = 0;
const missing = [];

for (const { id, spec } of guides) {
  // Cypress writes "<spec file name>.mp4".
  const match = available.find((f) => f === `${spec}.mp4` || f === `${spec.replace(/\.cy\.js$/, '')}.mp4`);
  if (!match) { missing.push(id); continue; }

  const from = path.join(SRC, match);
  // A zero-byte or near-empty file means the recording failed; publishing it
  // would put a broken player in front of the owner.
  if (statSync(from).size < 10_000) {
    console.warn(`[guides] ${id}: recording is suspiciously small, skipping`);
    missing.push(id);
    continue;
  }
  copyFileSync(from, path.join(DEST, `${id}.mp4`));
  console.log(`[guides] published ${id}.mp4`);
  copied += 1;
}

console.log(`\n[guides] ${copied} published, ${missing.length} without a usable recording`);
if (missing.length) {
  console.log(`[guides] still written-only: ${missing.join(', ')}`);
  console.log('[guides] those guides show their written walkthrough, which is a supported state.');
}
