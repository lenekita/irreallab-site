#!/usr/bin/env node
/**
 * Injects the shared nav/footer partials into every page that references
 * them, so nav/footer markup has exactly one source of truth
 * (partials/nav.html, partials/footer.html) instead of being hand-copied
 * into every HTML file.
 *
 * Each target page contains sentinel comments:
 *   <!-- @nav -->    ... anything ...   <!-- /@nav -->
 *   <!-- @footer -->  ... anything ...  <!-- /@footer -->
 * Everything between a pair is replaced with the current partial content,
 * so re-running this script is idempotent.
 *
 * Usage: node scripts/inject-partials.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PARTIALS = {
  nav: fs.readFileSync(path.join(ROOT, 'partials', 'nav.html'), 'utf8').trim(),
  footer: fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8').trim(),
};

// Shared assets get a content hash in their URL (?v=...) so browsers and CDNs
// (Cloudflare sits in front of the app) never serve a stale copy after a change.
const VERSIONED = ['styles/site.css', 'likes.js', 'animations2.js', 'language-switcher.js'];
const ASSET_VERSION = {};
for (const f of VERSIONED) {
  ASSET_VERSION[f] = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
}

function targetFiles() {
  const root = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(ROOT, f));
  const reelDir = path.join(ROOT, 'reel');
  const reels = fs.existsSync(reelDir)
    ? fs.readdirSync(reelDir).filter(f => f.endsWith('.html')).map(f => path.join(reelDir, f))
    : [];
  return [...root, ...reels];
}

function injectOne(file) {
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const [name, content] of Object.entries(PARTIALS)) {
    const re = new RegExp(`<!--\\s*@${name}\\s*-->[\\s\\S]*?<!--\\s*/@${name}\\s*-->`);
    if (re.test(html)) {
      html = html.replace(re, `<!-- @${name} -->\n${content}\n<!-- /@${name} -->`);
      changed = true;
    }
  }

  for (const f of VERSIONED) {
    const esc = f.replace(/[.\/]/g, '\\$&');
    const re = new RegExp(`(src|href)="/?${esc}(\\?v=[a-f0-9]+)?"`, 'g');
    const next = html.replace(re, `$1="/${f}?v=${ASSET_VERSION[f]}"`);
    if (next !== html) { html = next; changed = true; }
  }

  if (changed) {
    fs.writeFileSync(file, html);
    console.log(`updated ${path.relative(ROOT, file)}`);
  }
}

function main() {
  targetFiles().forEach(injectOne);
}

main();
