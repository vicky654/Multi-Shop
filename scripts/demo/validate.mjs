/**
 * Step 6 — validate the generated assets before anyone ships them.
 *
 * Catches the failure modes that would otherwise reach the marketing site
 * silently: a missing module screenshot, a blank/truncated PNG, a video that
 * isn't really H.264 MP4, or a tour that came out too short or too long.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadDemoEnv, ROOT, SHOTS_DIR, VIDEO_DIR, ok, info } from './lib/env.mjs';
import { MODULE_FILES, PUBLISH_EXT } from './lib/modules.mjs';

const env = loadDemoEnv();

const EXPECTED = MODULE_FILES;

// A data-rich 1920×1200 capture is 80KB+. A blank/skeleton frame of mostly flat
// colour compressed to ~63KB and passed the old 20KB floor while being visibly
// empty. 60KB is the floor; the blank-frame case is caught properly by the
// per-module readiness + content-length checks in the capture spec.
const MIN_PNG_BYTES = 60 * 1024;
const MIN_MP4_BYTES = 300 * 1024;
const MIN_SECONDS   = 60;
const MAX_SECONDS   = 120;

const failures = [];
const notes    = [];

// ── PNG checks ───────────────────────────────────────────────────────────────
const pngSize = (file) => {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { isPng, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const expectW = Number(env.DEMO_VIEWPORT_WIDTH);
const expectH = Number(env.DEMO_VIEWPORT_HEIGHT);

const skipImages = process.env.DEMO_SKIP_SCREENSHOTS === '1';
for (const name of skipImages ? [] : EXPECTED) {
  const file = path.join(SHOTS_DIR, `${name}.png`);
  if (!fs.existsSync(file)) { failures.push(`missing screenshot: ${name}.png`); continue; }

  const bytes = fs.statSync(file).size;
  if (bytes < MIN_PNG_BYTES) {
    failures.push(`${name}.png is only ${(bytes / 1024).toFixed(0)}KB — likely blank or a spinner`);
    continue;
  }

  const { isPng, width, height } = pngSize(file);
  if (!isPng) { failures.push(`${name}.png is not a valid PNG`); continue; }
  if (width !== expectW || height !== expectH) {
    notes.push(`${name}.png is ${width}×${height}, expected ${expectW}×${expectH}`);
  }
  ok(`${name}.png  ${(bytes / 1024).toFixed(0)}KB  ${width}×${height}`);
}

// Flag extras so a renamed module doesn't quietly leave a stale asset behind
const actual = fs.existsSync(SHOTS_DIR)
  ? fs.readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''))
  : [];
const extra = actual.filter((a) => !EXPECTED.includes(a));
if (extra.length) notes.push(`unexpected screenshot(s): ${extra.join(', ')}`);

// ── MP4 checks ───────────────────────────────────────────────────────────────
const video = path.join(VIDEO_DIR, process.env.DEMO_VIDEO_NAME || 'multishop-demo.mp4');
if (!fs.existsSync(video)) {
  failures.push('missing video: multishop-demo.mp4');
} else {
  const bytes = fs.statSync(video).size;
  const buf = fs.readFileSync(video);

  // ISO-BMFF: bytes 4-8 are 'ftyp'
  if (buf.subarray(4, 8).toString('latin1') !== 'ftyp') {
    failures.push('video is not a valid MP4 (no ftyp box)');
  }
  // H.264 inside MP4 is carried in an 'avc1' sample entry
  const isH264 = buf.includes(Buffer.from('avc1', 'latin1'));
  if (!isH264) failures.push('video does not contain an H.264 (avc1) track');

  if (bytes < MIN_MP4_BYTES) failures.push(`video is only ${(bytes / 1024).toFixed(0)}KB — capture likely failed`);

  // Duration from the mvhd box: timescale then duration, both big-endian u32
  let seconds = null;
  const mvhd = buf.indexOf(Buffer.from('mvhd', 'latin1'));
  if (mvhd !== -1) {
    const version = buf[mvhd + 4];
    if (version === 0) {
      const timescale = buf.readUInt32BE(mvhd + 16);
      const duration  = buf.readUInt32BE(mvhd + 20);
      if (timescale > 0) seconds = duration / timescale;
    } else if (version === 1) {
      const timescale = buf.readUInt32BE(mvhd + 24);
      const duration  = Number(buf.readBigUInt64BE(mvhd + 28));
      if (timescale > 0) seconds = duration / timescale;
    }
  }

  if (seconds == null) {
    notes.push('could not read video duration from mvhd — check it by hand');
  } else if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    failures.push(
      `video is ${seconds.toFixed(1)}s, outside the ${MIN_SECONDS}–${MAX_SECONDS}s target ` +
      '(tune PACE in cypress/demo/02-tour.cy.js)'
    );
  }

  ok(`multishop-demo.mp4  ${(bytes / 1e6).toFixed(1)}MB  ${seconds ? `${seconds.toFixed(1)}s` : 'duration?'}  H.264:${isH264}`);
}

// ── Leak check ───────────────────────────────────────────────────────────────
// The credentials must never end up inside a published asset or log.
const secrets = [env.DEMO_PASSWORD, env.DEMO_DATABASE_URI].filter(Boolean);
const scanDir = path.join(ROOT, 'scripts', 'demo', 'output');
for (const f of fs.existsSync(scanDir) ? fs.readdirSync(scanDir) : []) {
  const p = path.join(scanDir, f);
  if (!fs.statSync(p).isFile() || !f.endsWith('.log')) continue;
  const text = fs.readFileSync(p, 'utf8');
  for (const s of secrets) {
    if (s.length > 6 && text.includes(s)) failures.push(`secret leaked into output/${f}`);
  }
}
ok('no credentials found in captured output');

// ── Published-asset checks ───────────────────────────────────────────────────
// Confirm the marketing site actually received fresh assets in the format its
// pages reference. Without this, a publish that wrote the wrong extension would
// report success while the live site kept serving the previous images.
const marketing = env.MARKETING_WEBSITE_PATH?.trim();
if (!skipImages && marketing && fs.existsSync(marketing)) {
  const imgDir = path.join(marketing, 'public', 'images', 'product');
  const vidFile = path.join(marketing, 'public', 'videos', 'multishop-demo.mp4');
  const startedAt = Date.now() - 60 * 60 * 1000;   // this run, within the last hour

  for (const name of EXPECTED) {
    const f = path.join(imgDir, `${name}.${PUBLISH_EXT}`);
    if (!fs.existsSync(f)) {
      failures.push(`not published: ${name}.${PUBLISH_EXT} missing from the marketing site`);
      continue;
    }
    const st = fs.statSync(f);
    if (st.mtimeMs < startedAt) {
      failures.push(`stale on site: ${name}.${PUBLISH_EXT} was not refreshed by this run`);
    }
    // RIFF....WEBP magic
    const head = fs.readFileSync(f).subarray(0, 12);
    if (head.subarray(0, 4).toString('latin1') !== 'RIFF' || head.subarray(8, 12).toString('latin1') !== 'WEBP') {
      failures.push(`${name}.${PUBLISH_EXT} on the site is not a valid WebP`);
    }
  }

  if (!fs.existsSync(vidFile)) failures.push('not published: multishop-demo.mp4 missing from the marketing site');
  else if (fs.statSync(vidFile).mtimeMs < startedAt) failures.push('stale on site: multishop-demo.mp4 was not refreshed by this run');

  ok(`marketing site updated — ${EXPECTED.length} .${PUBLISH_EXT} + video in ${path.relative(marketing, imgDir)}`);
}

// ── Report ───────────────────────────────────────────────────────────────────
if (notes.length) {
  console.log('\n   Notes:');
  notes.forEach((n) => console.log(`   ! ${n}`));
}

if (failures.length) {
  console.error('\n✖ Asset validation failed:');
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

info(`${EXPECTED.length} module screenshots + 1 video validated`);
