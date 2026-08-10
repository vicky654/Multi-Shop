/**
 * Step 5 — collect captured assets and publish them to the marketing site.
 *
 * Cypress writes screenshots to  client/cypress/demo-output/images/<spec>/<name>.png
 * and the video to               client/cypress/demo-output/video/<spec>.mp4
 *
 * This flattens both into scripts/demo/output/ (the canonical PNG copy) and then,
 * if MARKETING_WEBSITE_PATH is set, publishes them into:
 *   $MARKETING_WEBSITE_PATH/public/images/product/*.webp   (re-encoded — the site
 *                                                           hardcodes .webp)
 *   $MARKETING_WEBSITE_PATH/public/videos/multishop-demo.mp4
 *
 * Publishing is deliberately last-write-wins on individual files: it replaces the
 * assets it generated and leaves anything else in those folders alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadDemoEnv, ROOT, OUTPUT_DIR, SHOTS_DIR, VIDEO_DIR, ensureDirs, ok, info, warn } from './lib/env.mjs';
import { isManagedImage, VIDEO_NAME as VIDEO_FILE, PUBLISH_EXT } from './lib/modules.mjs';

const env = loadDemoEnv();
const CY_OUT     = path.join(ROOT, 'client', 'cypress', 'demo-output');
const CY_SHOTS   = path.join(CY_OUT, 'images');
const CY_VIDEO   = path.join(CY_OUT, 'video');
// A themed run can name its own video (e.g. vicky-shoes-demo.mp4)
const VIDEO_NAME = process.env.DEMO_VIDEO_NAME || VIDEO_FILE;

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
};

ensureDirs(OUTPUT_DIR, SHOTS_DIR, VIDEO_DIR);

// ── 1. Flatten screenshots ───────────────────────────────────────────────────
// Cypress nests by spec name and may append " (attempt n)" / "(1)" — normalise.
const shots = walk(CY_SHOTS).filter((f) => f.endsWith('.png'));
// A themed video-only run (DEMO_SKIP_SCREENSHOTS=1) legitimately has no PNGs.
if (!shots.length && process.env.DEMO_SKIP_SCREENSHOTS !== '1') {
  throw new Error(`No screenshots found in ${CY_SHOTS}`);
}

for (const f of fs.readdirSync(SHOTS_DIR)) fs.rmSync(path.join(SHOTS_DIR, f), { force: true });

let copied = 0;
for (const src of shots) {
  const clean = path.basename(src)
    .replace(/\s*\(attempt \d+\)/i, '')
    .replace(/\s*\(\d+\)(?=\.png$)/, '')
    .trim();
  fs.copyFileSync(src, path.join(SHOTS_DIR, clean));
  copied += 1;
}
ok(`${copied} screenshot(s) collected → ${path.relative(ROOT, SHOTS_DIR)}`);

// ── 2. Pick up the video ─────────────────────────────────────────────────────
const videos = walk(CY_VIDEO).filter((f) => f.endsWith('.mp4'));
if (!videos.length) throw new Error(`No MP4 found in ${CY_VIDEO}`);

// Cypress records every run, so the screenshot pass leaves a throwaway video too.
// Pick the TOUR spec's recording explicitly; fall back to newest if renamed.
// Match whichever spec this run recorded, not a hardcoded name
const tourSpec = (process.env.DEMO_TOUR_SPEC || '02-tour').split('/').pop().replace(/.cy.js$/, '');
const tour = videos.filter((f) => path.basename(f).includes(tourSpec));
const pick = (tour.length ? tour : videos)
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

if (!tour.length) warn('02-tour video not found by name — falling back to the newest MP4');

const videoDest = path.join(VIDEO_DIR, VIDEO_NAME);
fs.copyFileSync(pick, videoDest);
ok(`video collected → ${path.relative(ROOT, videoDest)} (${(fs.statSync(videoDest).size / 1e6).toFixed(1)} MB)`);

// ── 3. Publish to the marketing site ─────────────────────────────────────────
const marketing = env.MARKETING_WEBSITE_PATH?.trim();
if (!marketing) {
  warn('MARKETING_WEBSITE_PATH not set — assets left in scripts/demo/output only');
  process.exit(0);
}

if (!fs.existsSync(marketing)) {
  throw new Error(
    `MARKETING_WEBSITE_PATH does not exist: ${marketing}\n` +
    '  Fix the path in .env.demo, or clear it to stop after capture.'
  );
}

const imgDest = path.join(marketing, 'public', 'images', 'product');
const vidDest = path.join(marketing, 'public', 'videos');
ensureDirs(imgDest, vidDest);

// Remove assets THIS TOOL previously published that are no longer produced —
// a renamed module (or a stray Cypress failure screenshot from an aborted run)
// would otherwise linger on the marketing site forever. Files we do not manage
// are left alone.
let swept = 0;
for (const f of fs.readdirSync(imgDest)) {
  if (!isManagedImage(f)) continue;
  // Skip anything we are about to rewrite this run (compare on the base name,
  // since captures are .png and published assets are .webp)
  const base = f.replace(/\.(png|webp)$/i, '');
  if (fs.existsSync(path.join(SHOTS_DIR, base + '.png'))) continue;
  fs.rmSync(path.join(imgDest, f), { force: true });
  swept += 1;
}
if (swept) ok(`${swept} stale asset(s) removed from the marketing site`);

// ── Encode to the format the site actually references ────────────────────────
// The marketing site hardcodes `<module>.webp`, so PNGs would be ignored by the
// live pages. `sharp` is resolved from the MARKETING repo (it ships with Next.js)
// rather than added as a product dependency.
let sharp = null;
try {
  const requireFromSite = createRequire(path.join(marketing, 'package.json'));
  sharp = requireFromSite('sharp');
} catch (err) {
  throw new Error(
    `Cannot load "sharp" from the marketing repo (${marketing}).\n` +
    `  It is needed to write the .${PUBLISH_EXT} files the site references.\n` +
    `  Fix: run \`npm install\` in the marketing repo. Original: ${err.message}`
  );
}

let published = 0;
for (const f of (fs.existsSync(SHOTS_DIR) ? fs.readdirSync(SHOTS_DIR) : [])) {
  if (!f.endsWith('.png')) continue;
  const name = path.basename(f, '.png');
  const out  = path.join(imgDest, `${name}.${PUBLISH_EXT}`);
  // quality 82 keeps these near the ~67KB of the assets they replace
  await sharp(path.join(SHOTS_DIR, f)).webp({ quality: 82 }).toFile(out);
  published += 1;
}
fs.copyFileSync(videoDest, path.join(vidDest, VIDEO_NAME));

ok(`${published} image(s) encoded to .${PUBLISH_EXT} → ${path.relative(marketing, imgDest)}`);
ok(`video → ${path.join(path.relative(marketing, vidDest), VIDEO_NAME)}`);
info(`marketing site: ${marketing}`);
