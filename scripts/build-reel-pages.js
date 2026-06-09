#!/usr/bin/env node
/**
 * Generates a standalone HTML page per reel in reels.json, a poster JPG per
 * local video (via ffmpeg), and rewrites sitemap.xml with video entries.
 *
 * Usage: node scripts/build-reel-pages.js
 * Requires ffmpeg/ffprobe on PATH for poster generation and video metadata.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://irreallab.fr';
const REEL_DIR = path.join(ROOT, 'reel');
const POSTER_DIR = path.join(ROOT, 'images', 'posters');

const STATIC_PAGES = [
  { loc: `${SITE}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE}/main`, changefreq: 'weekly', priority: '0.95' },
  { loc: `${SITE}/reels`, changefreq: 'weekly', priority: '0.9' },
  { loc: `${SITE}/about`, changefreq: 'monthly', priority: '0.85' },
  { loc: `${SITE}/contact`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE}/credits`, changefreq: 'yearly', priority: '0.7' },
];

function slugify(title) {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function probeVideo(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  const data = JSON.parse(out);
  return {
    width: data.streams[0].width,
    height: data.streams[0].height,
    duration: Math.round(parseFloat(data.format.duration)),
  };
}

function ensurePoster(videoFile, posterFile) {
  if (fs.existsSync(posterFile)) return;
  execFileSync('ffmpeg', [
    '-y', '-ss', '1', '-i', videoFile,
    '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3',
    posterFile,
  ], { stdio: 'ignore' });
}

function isoDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `PT${m ? m + 'M' : ''}${s}S`;
}

function pageHtml(reel, meta) {
  const title = escapeHtml(reel.title);
  const desc = escapeHtml(reel.description || `${reel.title} — a surreal visual experiment by irreallab.`);
  const pageUrl = `${SITE}/reel/${meta.slug}.html`;
  const videoAbs = `${SITE}${reel.video_url}`;
  const posterAbs = `${SITE}/images/posters/${meta.slug}.jpg`;
  const hashtags = escapeHtml((reel.hashtags || '').split(/\s+/).join(' '));
  const postedDate = reel.posted_at ? reel.posted_at.slice(0, 10) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: reel.title,
    description: reel.description || `${reel.title} — a surreal visual experiment by irreallab.`,
    thumbnailUrl: [posterAbs],
    contentUrl: videoAbs,
    duration: isoDuration(meta.duration),
    width: meta.width,
    height: meta.height,
    url: pageUrl,
    publisher: {
      '@type': 'Organization',
      name: 'irreallab',
      url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/images/logo.png` },
    },
  };
  if (reel.posted_at) jsonLd.uploadDate = reel.posted_at;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — irreallab</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${pageUrl}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="/images/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">

  <meta property="og:title" content="${title} — irreallab">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="irreallab">
  <meta property="og:image" content="${posterAbs}">
  <meta property="og:video" content="${videoAbs}">
  <meta property="og:video:secure_url" content="${videoAbs}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="${meta.width}">
  <meta property="og:video:height" content="${meta.height}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} — irreallab">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${posterAbs}">

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #060606;
      --accent: #d4f03a;
      --text: #ede9df;
      --muted: #4a4a4a;
      --line: #1c1c1c;
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Space Mono', monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    body::after {
      content: '';
      position: fixed; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      opacity: 0.035; pointer-events: none; z-index: 9999;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.4rem 2rem;
      border-bottom: 1px solid var(--line);
    }
    .brand {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.4rem;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--text);
      text-decoration: none;
    }
    .brand em { color: var(--accent); font-style: normal; }
    .back {
      font-size: .62rem;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: var(--muted);
      text-decoration: none;
      transition: color .2s;
    }
    .back:hover { color: var(--accent); }
    main {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
      gap: 3rem;
      align-items: center;
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding: 3rem 2rem;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(36px); }
      to { opacity: 1; transform: none; }
    }
    .player {
      background: #000;
      border: 1px solid var(--line);
      position: relative;
      animation: fadeUp .9s cubic-bezier(.16,1,.3,1) backwards .1s;
      transition: border-color .35s ease, box-shadow .35s ease;
    }
    .player::before {
      content: '';
      position: absolute;
      inset: -36px;
      background: radial-gradient(circle at 50% 45%, rgba(212,240,58,.13) 0%, transparent 62%);
      z-index: -1;
      animation: glowPulse 5.5s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes glowPulse {
      0%, 100% { opacity: .55; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    .player:hover {
      border-color: rgba(212,240,58,.55);
      box-shadow: 0 18px 70px rgba(212,240,58,.14);
    }
    .player video {
      display: block;
      width: 100%;
      height: auto;
      max-height: 78vh;
      object-fit: contain;
    }
    article > * { animation: fadeUp .8s cubic-bezier(.16,1,.3,1) backwards; }
    article > *:nth-child(1) { animation-delay: .2s; }
    article > *:nth-child(2) { animation-delay: .3s; }
    article > *:nth-child(3) { animation-delay: .4s; }
    article > *:nth-child(4) { animation-delay: .5s; }
    article > *:nth-child(5) { animation-delay: .6s; }
    article > *:nth-child(6) { animation-delay: .7s; }
    .meta-label {
      font-size: .58rem;
      letter-spacing: .22em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 1rem;
    }
    h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(2.4rem, 6vw, 4.4rem);
      line-height: .92;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 1.4rem;
      text-shadow: 0 0 18px rgba(212,240,58,.18);
      position: relative;
      display: inline-block;
      cursor: default;
    }
    h1::before, h1::after {
      content: attr(data-text);
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      opacity: 0;
      pointer-events: none;
      mix-blend-mode: screen;
    }
    h1:hover::before {
      color: #3ad4f0;
      animation: ir-glitch-a .6s steps(2,end) both;
    }
    h1:hover::after {
      color: #f03a6e;
      animation: ir-glitch-b .6s steps(2,end) both;
    }
    @keyframes ir-glitch-a {
      0%   { opacity: .8; transform: translate(-3px,-1px); clip-path: inset(0 0 62% 0); }
      35%  { opacity: .4; transform: translate(3px,1px);  clip-path: inset(38% 0 22% 0); }
      70%  { opacity: .6; transform: translate(-2px,0);   clip-path: inset(64% 0 8% 0); }
      100% { opacity: 0;  transform: none;                clip-path: inset(0 0 100% 0); }
    }
    @keyframes ir-glitch-b {
      0%   { opacity: .7; transform: translate(3px,1px);  clip-path: inset(58% 0 12% 0); }
      35%  { opacity: .5; transform: translate(-3px,0);   clip-path: inset(12% 0 58% 0); }
      70%  { opacity: .3; transform: translate(2px,-1px); clip-path: inset(40% 0 36% 0); }
      100% { opacity: 0;  transform: none;                clip-path: inset(100% 0 0 0); }
    }
    .desc {
      font-size: .85rem;
      line-height: 1.7;
      color: var(--text);
      margin-bottom: 1.6rem;
      max-width: 46ch;
    }
    .date {
      font-size: .6rem;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 1rem;
    }
    .hashtags {
      font-size: .68rem;
      line-height: 1.8;
      color: var(--muted);
      margin-bottom: 2.2rem;
      word-break: break-word;
    }
    .actions { display: flex; gap: 1rem; flex-wrap: wrap; }
    .btn {
      font-family: 'Bebas Neue', sans-serif;
      font-size: .95rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 12px 28px;
      border: 1px solid var(--accent);
      color: var(--accent);
      transition: background .25s, color .25s;
    }
    .btn:hover { background: var(--accent); color: #060606; }
    .btn.primary { background: var(--accent); color: #060606; }
    .btn.primary:hover { background: transparent; color: var(--accent); }
    footer {
      border-top: 1px solid var(--line);
      padding: 1.2rem 2rem;
      font-size: .58rem;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: .6rem;
    }
    footer a { color: rgba(212,240,58,.75); text-decoration: none; }
    footer a:hover { color: var(--accent); }
    @media (max-width: 820px) {
      main { grid-template-columns: 1fr; gap: 2rem; padding: 2rem 1.2rem; }
      .player { max-width: 380px; margin: 0 auto; width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .player, article > * { animation: none; }
      .player::before { animation: none; }
      h1:hover::before, h1:hover::after { animation: none; opacity: 0; }
    }
  </style>
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "wr62xdtgob");
  </script>
  <script src="https://cdn.cookiehub.eu/c2/45bb1a81.js"></script>
  <script type="text/javascript">
    document.addEventListener("DOMContentLoaded", function(event) {
      window.cookiehub.load({});
    });
  </script>
</head>
<body>
  <header>
    <a class="brand" href="/main.html">irreal<em>lab_</em></a>
    <a class="back" href="/reels.html">&larr; All reels</a>
  </header>

  <main>
    <div class="player">
      <video src="${escapeHtml(reel.video_url)}" poster="/images/posters/${meta.slug}.jpg" controls playsinline preload="metadata"></video>
    </div>
    <article>
      <div class="meta-label">Visual experiment / short-form</div>
      <h1 data-text="${title}">${title}</h1>
      ${postedDate ? `<div class="date">Published ${postedDate}</div>` : ''}
      <p class="desc">${desc}</p>
      <p class="hashtags">${hashtags}</p>
      <div class="actions">
        <a class="btn primary" href="${escapeHtml(reel.url)}" target="_blank" rel="noopener">Watch on Instagram &#8599;</a>
        <a class="btn" href="/reels.html">More reels</a>
      </div>
    </article>
  </main>

  <footer>
    <span>&copy; irreallab — all rights reserved</span>
    <a href="https://www.instagram.com/irreallab/" target="_blank" rel="noopener">@irreallab</a>
  </footer>
</body>
</html>
`;
}

function sitemapXml(reelEntries) {
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = STATIC_PAGES.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const reelUrls = reelEntries.map(({ reel, meta }) => {
    const pageUrl = `${SITE}/reel/${meta.slug}.html`;
    const lastmod = reel.posted_at ? reel.posted_at.slice(0, 10) : today;
    const desc = reel.description || `${reel.title} — a surreal visual experiment by irreallab.`;
    return `  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
    <video:video>
      <video:thumbnail_loc>${SITE}/images/posters/${meta.slug}.jpg</video:thumbnail_loc>
      <video:title>${escapeXml(reel.title)}</video:title>
      <video:description>${escapeXml(desc)}</video:description>
      <video:content_loc>${SITE}${reel.video_url}</video:content_loc>
      <video:duration>${meta.duration}</video:duration>${reel.posted_at ? `
      <video:publication_date>${reel.posted_at}</video:publication_date>` : ''}
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${staticUrls}
${reelUrls}
</urlset>
`;
}

function main() {
  const reels = JSON.parse(fs.readFileSync(path.join(ROOT, 'reels.json'), 'utf8'));
  fs.mkdirSync(REEL_DIR, { recursive: true });
  fs.mkdirSync(POSTER_DIR, { recursive: true });

  const entries = [];
  for (const reel of reels) {
    if (!reel.video_url || !reel.video_url.startsWith('/')) {
      console.warn(`skip "${reel.title}" — no local video_url`);
      continue;
    }
    const videoFile = path.join(ROOT, reel.video_url);
    if (!fs.existsSync(videoFile)) {
      console.warn(`skip "${reel.title}" — missing ${reel.video_url}`);
      continue;
    }
    const slug = slugify(reel.title);
    const posterFile = path.join(POSTER_DIR, `${slug}.jpg`);
    ensurePoster(videoFile, posterFile);
    const { width, height, duration } = probeVideo(videoFile);
    const meta = { slug, width, height, duration };
    fs.writeFileSync(path.join(REEL_DIR, `${slug}.html`), pageHtml(reel, meta));
    entries.push({ reel, meta });
    console.log(`built reel/${slug}.html (${width}x${height}, ${duration}s)`);
  }

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemapXml(entries));
  console.log(`wrote sitemap.xml with ${STATIC_PAGES.length} pages + ${entries.length} reels`);
}

main();
