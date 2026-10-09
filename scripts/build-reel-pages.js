#!/usr/bin/env node
/**
 * Generates a standalone HTML page per reel in reels.json, a poster JPG per
 * local video (via ffmpeg), and rewrites sitemap.xml with video entries.
 * The page/sitemap templates live in lib/site.js, shared with server.js
 * (which renders the same pages on request, including admin-published reels).
 *
 * Usage: node scripts/build-reel-pages.js
 * Requires ffmpeg/ffprobe on PATH for poster generation and video metadata.
 */

const fs = require('fs');
const path = require('path');
const { STATIC_PAGES, FEATURED_VIDEOS, slugify, pageHtml, sitemapXml } = require('../lib/site');
const { probeVideo, ensurePoster } = require('../lib/media');

const ROOT = path.join(__dirname, '..');
const REEL_DIR = path.join(ROOT, 'reel');
const POSTER_DIR = path.join(ROOT, 'images', 'posters');

function main() {
  const reels = JSON.parse(fs.readFileSync(path.join(ROOT, 'reels.json'), 'utf8'));
  fs.mkdirSync(REEL_DIR, { recursive: true });
  fs.mkdirSync(POSTER_DIR, { recursive: true });

  const publishable = reels.filter(reel => {
    if (!reel.video_url || !reel.video_url.startsWith('/')) {
      console.warn(`skip "${reel.title}" — no local video_url`);
      return false;
    }
    if (!fs.existsSync(path.join(ROOT, reel.video_url))) {
      console.warn(`skip "${reel.title}" — missing ${reel.video_url}`);
      return false;
    }
    return true;
  });

  const entries = [];
  publishable.forEach((reel, i) => {
    const videoFile = path.join(ROOT, reel.video_url);
    const slug = slugify(reel.title);
    const posterFile = path.join(POSTER_DIR, `${slug}.jpg`);
    ensurePoster(videoFile, posterFile);
    const { width, height, duration } = probeVideo(videoFile);
    const meta = { slug, width, height, duration };

    const prevReel = publishable[i - 1];
    const nextReel = publishable[i + 1];
    const neighbors = {
      prev: prevReel ? { slug: slugify(prevReel.title), title: prevReel.title } : null,
      next: nextReel ? { slug: slugify(nextReel.title), title: nextReel.title } : null,
    };

    fs.writeFileSync(path.join(REEL_DIR, `${slug}.html`), pageHtml(reel, meta, neighbors));
    entries.push({ reel, meta });
    console.log(`built reel/${slug}.html (${width}x${height}, ${duration}s)`);
  });

  FEATURED_VIDEOS.forEach(reel => {
    const videoFile = path.join(ROOT, reel.video_url);
    const slug = slugify(reel.title);
    ensurePoster(videoFile, path.join(POSTER_DIR, `${slug}.jpg`));
    const { width, height, duration } = probeVideo(videoFile);
    const meta = { slug, width, height, duration };
    fs.writeFileSync(path.join(REEL_DIR, `${slug}.html`), pageHtml(reel, meta, { prev: null, next: null }));
    entries.push({ reel, meta });
    console.log(`built reel/${slug}.html (featured, ${width}x${height}, ${duration}s)`);
  });

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemapXml(entries));
  console.log(`wrote sitemap.xml with ${STATIC_PAGES.length} pages + ${entries.length} video pages`);
}

main();
