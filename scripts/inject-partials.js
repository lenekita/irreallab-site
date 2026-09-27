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

const ROOT = path.join(__dirname, '..');
const PARTIALS = {
  nav: fs.readFileSync(path.join(ROOT, 'partials', 'nav.html'), 'utf8').trim(),
  footer: fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8').trim(),
};

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

  if (changed) {
    fs.writeFileSync(file, html);
    console.log(`updated ${path.relative(ROOT, file)}`);
  }
}

function main() {
  targetFiles().forEach(injectOne);
}

main();
