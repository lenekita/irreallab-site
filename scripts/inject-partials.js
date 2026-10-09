#!/usr/bin/env node
/**
 * Injects the shared nav/footer partials into every page and appends a
 * content hash (?v=...) to shared assets, so there is one source of truth for
 * nav/footer markup and CDNs/browsers never serve a stale CSS/JS file.
 *
 * Pages mark the spots with sentinel comments:
 *   <!-- @nav --> ... <!-- /@nav -->     <!-- @footer --> ... <!-- /@footer -->
 * Everything between a pair is replaced, so re-running is idempotent. The
 * logic itself lives in lib/site.js (server.js uses it for pages it renders).
 *
 * Usage: node scripts/inject-partials.js
 */

const fs = require('fs');
const path = require('path');
const { renderPage } = require('../lib/site');

const ROOT = path.join(__dirname, '..');

function targetFiles() {
  const root = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => path.join(ROOT, f));
  const reelDir = path.join(ROOT, 'reel');
  const reels = fs.existsSync(reelDir)
    ? fs.readdirSync(reelDir).filter(f => f.endsWith('.html')).map(f => path.join(reelDir, f))
    : [];
  return [...root, ...reels];
}

targetFiles().forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  const next = renderPage(html);
  if (next !== html) {
    fs.writeFileSync(file, next);
    console.log(`updated ${path.relative(ROOT, file)}`);
  }
});
