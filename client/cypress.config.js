import { defineConfig } from 'cypress';
// This config is ESM, so `require` and `__dirname` do not exist here.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  e2e: {
    // ── Server endpoints ────────────────────────────────────────────────────────
    baseUrl: 'http://127.0.0.1:4000',   // Vite dev server

    // ── Spec discovery ──────────────────────────────────────────────────────────
    specPattern:    'cypress/e2e/**/*.cy.{js,jsx}',
    // Guide recordings are a separate concern with their own config (video on,
    // no retries, slow pacing). Without this exclusion `npm run cy:run` would
    // execute all eight of them on every regression run.
    excludeSpecPattern: 'cypress/e2e/guides/**',
    supportFile:    'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',

    // ── Timeouts ────────────────────────────────────────────────────────────────
    // React Query re-fetches + Framer Motion + network latency all add up.
    // Generous but not infinite — flaky tests hide here when too short.
    defaultCommandTimeout: 8000,   // cy.get / cy.contains
    requestTimeout:        12000,  // cy.request / cy.intercept wait
    responseTimeout:       15000,  // backend response window
    pageLoadTimeout:       25000,  // full SPA route transitions

    // ── Viewport ────────────────────────────────────────────────────────────────
    // Match the most common QA workstation resolution
    viewportWidth:  1280,
    viewportHeight: 800,

    // ── Failure artifacts ───────────────────────────────────────────────────────
    screenshotOnRunFailure: true,       // always capture on failure
    video:                  false,      // flip to true in CI for recordings
    videosFolder:           'cypress/videos',
    screenshotsFolder:      'cypress/screenshots',
    trashAssetsBeforeRuns:  true,       // clean stale artifacts on each run

    // ── Retries ─────────────────────────────────────────────────────────────────
    // CI: 2 retries absorbs transient network hiccups without masking real bugs
    // Local: 0 retries so you see real failures immediately
    retries: {
      runMode:  2,
      openMode: 0,
    },

    // ── Environment variables ───────────────────────────────────────────────────
    // Override any of these in cypress.env.json (gitignored) or CI env vars.
    // Cypress merges: config.env < cypress.env.json < --env CLI flag
    env: {
      // ── Auth ──────────────────────────────────────────────────────────────────
      ownerEmail:      'owner@multishop.com',
      ownerPassword:   'owner123',
      managerEmail:    'manager@multishop.com',
      managerPassword: 'manager123',

      // ── API base (backend port = 5001) ────────────────────────────────────────
      apiUrl: 'http://127.0.0.1:5001/api',

      // ── Feature flags for conditional test behavior ───────────────────────────
      skipSlowTests:   false,  // set true in cypress.env.json to skip long suites
    },

    setupNodeEvents(on, config) {
      const DOWNLOADS = path.join(HERE, 'cypress', 'downloads');

      /** Newest download matching a pattern, or null. */
      const newestDownload = (pattern) => {
        if (!fs.existsSync(DOWNLOADS)) return null;
        const re = new RegExp(pattern);
        const files = fs.readdirSync(DOWNLOADS)
          .filter((f) => re.test(f))
          .map((f) => ({ f, t: fs.statSync(path.join(DOWNLOADS, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t);
        return files.length ? path.join(DOWNLOADS, files[0].f) : null;
      };

      on('task', {
        log(msg) {
          console.log('\n[CYPRESS]', msg);
          return null;
        },

        /**
         * Inspect a downloaded file in Node.
         *
         * These checks live here rather than in `cy.exec` one-liners because
         * nesting quotes through a shell was unreliable on Windows — the commands
         * exited non-zero on their own quoting, not on the file being wrong.
         */
        inspectDownload({ pattern, kind }) {
          const file = newestDownload(pattern);
          if (!file) return { ok: false, reason: `no download matching ${pattern}` };

          const buf = fs.readFileSync(file);
          const name = path.basename(file);
          const out = { ok: true, name, size: buf.length };

          if (kind === 'csv') {
            const text = buf.toString('utf8');
            if (buf[0] !== 0xEF || buf[1] !== 0xBB || buf[2] !== 0xBF) return { ok: false, name, reason: 'missing UTF-8 BOM' };
            if (!text.includes('\r\n')) return { ok: false, name, reason: 'not CRLF' };
            if (!/(^|\r\n)TOTAL,/.test(text)) return { ok: false, name, reason: 'no TOTAL row' };
            if (/undefined|NaN|\[object Object\]/.test(text)) return { ok: false, name, reason: 'junk in file' };
            out.text = text.slice(0, 4000);
            out.rows = text.trim().split('\r\n').length - 1;
          }

          if (kind === 'xlsx') {
            if (buf.slice(0, 2).toString() !== 'PK') return { ok: false, name, reason: 'not a ZIP' };
            // Validate with .NET's ZipFile — the same stack Office uses, and code
            // that shares nothing with our writer.
            try {
              const ps = execFileSync('powershell.exe', ['-NoProfile', '-Command',
                'Add-Type -AssemblyName System.IO.Compression.FileSystem; '
                + `$z=[System.IO.Compression.ZipFile]::OpenRead('${file.replace(/'/g, "''")}'); `
                + '$n=($z.Entries|ForEach-Object{$_.FullName}) -join ","; $z.Dispose(); Write-Output $n',
              ], { encoding: 'utf8' });
              if (!ps.includes('xl/worksheets/sheet1.xml')) return { ok: false, name, reason: 'no worksheet part' };
              out.parts = ps.trim();
            } catch (e) {
              return { ok: false, name, reason: `ZipFile could not open it: ${e.message.slice(0, 120)}` };
            }
          }

          if (kind === 'pdf') {
            if (buf.slice(0, 5).toString() !== '%PDF-') return { ok: false, name, reason: 'not a PDF' };
            if (!buf.slice(-1024).toString('latin1').includes('%%EOF')) return { ok: false, name, reason: 'no EOF marker' };
            // Parse it with poppler when available — a viewer-grade parser.
            try {
              const txt = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
              if (/undefined|NaN/.test(txt)) return { ok: false, name, reason: 'junk in PDF text' };
              out.text = txt.slice(0, 4000);
            } catch {
              out.text = null;   // pdftotext absent: header/EOF checks still stand
            }
          }

          return out;
        },

        /** Read the newest matching download as text, for round-trip editing. */
        readDownload(pattern) {
          const file = newestDownload(pattern);
          return file ? fs.readFileSync(file, 'utf8') : null;
        },

        /** Clear downloads so a test never asserts on a previous run's file. */
        clearDownloads() {
          if (fs.existsSync(DOWNLOADS)) {
            for (const f of fs.readdirSync(DOWNLOADS)) {
              try { fs.unlinkSync(path.join(DOWNLOADS, f)); } catch { /* in use */ }
            }
          }
          return null;
        },
      });

      return config;
    },
  },
});
