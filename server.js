const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const site = require('./lib/site');
const media = require('./lib/media');
const store = require('./lib/reels-store');
const instagram = require('./lib/instagram');
const { DATA_DIR, MEDIA_DIR, TMP_DIR } = store;

const app = express();
// Railway (and Cloudflare) sit in front of the app; needed for the real client IP.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Never serve source, config or runtime data through the static handler.
app.use((req, res, next) => {
  if (/^\/(server\.js|lib|scripts|data|node_modules|partials|uploads|package(-lock)?\.json|Dockerfile|README\.md|CNAME|\.)/i.test(req.path)) {
    return res.status(404).send('Not found');
  }
  next();
});

// Middleware
app.use(express.json());

// ---------------------------------------------------------------------------
// Admin auth — protects the admin panel's write API. Credentials come only
// from env vars (set in Railway's dashboard), never from source. Sessions
// are an in-memory random token in an httpOnly cookie; simple on purpose,
// this is a single-admin tool, not a multi-user auth system.
// ---------------------------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_COOKIE = 'irreallab_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const adminSessions = new Map(); // token -> expiresAt

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.warn('⚠ ADMIN_USER / ADMIN_PASSWORD are not set — the admin panel login will always fail until they are configured (e.g. in Railway).');
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // still run a compare of equal length to avoid a length-based timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function createAdminSession(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, Date.now() + SESSION_TTL_MS);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${req.secure ? '; Secure' : ''}`);
}

function destroyAdminSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) adminSessions.delete(token);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const expiresAt = token && adminSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

const loginAttempts = new Map(); // ip -> { count, resetAt }
function loginLimited(ip) {
  const now = Date.now();
  const e = loginAttempts.get(ip);
  if (!e || e.resetAt < now) return false;
  return e.count >= 5;
}
function recordFailedLogin(ip) {
  const now = Date.now();
  const e = loginAttempts.get(ip);
  if (!e || e.resetAt < now) loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else e.count += 1;
}

app.post('/api/admin/login', express.json(), (req, res) => {
  const { id, password } = req.body || {};
  if (!ADMIN_USER || !ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin login is not configured on this server' });
  }
  const idOk = timingSafeEqualStr(id || '', ADMIN_USER);
  const passOk = timingSafeEqualStr(password || '', ADMIN_PASSWORD);
  if (loginLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts — try again in 15 minutes' });
  }
  if (idOk && passOk) {
    loginAttempts.delete(req.ip);
    createAdminSession(req, res);
    return res.json({ success: true });
  }
  recordFailedLogin(req.ip);
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/admin/logout', (req, res) => {
  destroyAdminSession(req, res);
  res.json({ success: true });
});

app.get('/api/admin/session', (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  const expiresAt = token && adminSessions.get(token);
  res.json({ authenticated: !!(expiresAt && expiresAt >= Date.now()) });
});


// ---------------------------------------------------------------------------
// Reel likes — anonymous hearts. Only counters are stored (no personal data).
// Anti-spam is in-memory: a per-IP rate limit and one active like per
// IP+reel while the server is up. Set DATA_DIR to a persistent volume
// (e.g. a Railway volume) or the counts reset whenever the app redeploys.
// ---------------------------------------------------------------------------
const LIKES_FILE = path.join(DATA_DIR, 'likes.json');
const FEATURED_SLUGS = ['sky-runway'];

let likeCounts = {};
try { likeCounts = JSON.parse(fs.readFileSync(LIKES_FILE, 'utf8')); } catch (e) { likeCounts = {}; }

let likesSaveTimer = null;
function saveLikesSoon() {
  clearTimeout(likesSaveTimer);
  likesSaveTimer = setTimeout(() => {
    try {
      const tmp = LIKES_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(likeCounts));
      fs.renameSync(tmp, LIKES_FILE);
    } catch (err) {
      console.error('Could not save likes:', err.message);
    }
  }, 400);
}

function allowedSlugs() { return store.allowedSlugs(FEATURED_SLUGS); }

const likeRate = new Map();   // ip -> { count, resetAt }
const likedBy = new Set();    // `${ip}|${slug}`
function likeRateLimited(ip) {
  const now = Date.now();
  const entry = likeRate.get(ip);
  if (!entry || entry.resetAt < now) { likeRate.set(ip, { count: 1, resetAt: now + 60 * 1000 }); return false; }
  entry.count += 1;
  return entry.count > 30;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of likeRate) if (e.resetAt < now) likeRate.delete(ip);
}, 5 * 60 * 1000).unref();

app.get('/api/likes', (req, res) => {
  const out = {};
  allowedSlugs().forEach(slug => { out[slug] = likeCounts[slug] || 0; });
  res.set('Cache-Control', 'no-store');
  res.json(out);
});

// Admin-only ranking with titles, for the admin panel's Statistics tab.
app.get('/api/likes-report', requireAdmin, (req, res) => {
  const reels = store.getAll().filter(r => !r.hidden)
    .map(r => ({ slug: r.slug, title: r.title, likes: likeCounts[r.slug] || 0 }));
  site.FEATURED_VIDEOS.forEach(v => { const slug = site.slugify(v.title); reels.push({ slug, title: v.title, likes: likeCounts[slug] || 0 }); });
  reels.sort((x, y) => y.likes - x.likes || x.title.localeCompare(y.title));
  res.set('Cache-Control', 'no-store');
  res.json({ total: reels.reduce((n, r) => n + r.likes, 0), reels });
});

// ---------------------------------------------------------------------------
// Instagram statistics (admin only). Data comes from lib/instagram.js, which
// syncs with the official Instagram API and caches the result on the volume.
// ---------------------------------------------------------------------------
function instagramReport(error) {
  const snap = instagram.snapshot();
  const base = { configured: instagram.isConfigured(), error: error ? instagram.friendlyError(error) : '' };
  if (!snap) return { ...base, synced: false };

  // Join Instagram posts to the site's reels through the Instagram link stored on each reel.
  const byCode = new Map(snap.media.filter(m => m.shortcode).map(m => [m.shortcode, m]));
  const used = new Set();
  const list = store.getAll().filter(r => !r.hidden);
  const matched = new Map(); // slug -> instagram media
  list.forEach(r => {                       // 1) exact: reel link stored on the site reel
    const code = instagram.shortcodeOf(r.url);
    const ig = code ? byCode.get(code) : null;
    if (ig) { matched.set(r.slug, ig); used.add(ig.id); }
  });
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  list.forEach(r => {                       // 2) fallback: the reel's title appears in exactly one unused caption
    if (matched.has(r.slug)) return;
    const t = norm(r.title);
    if (t.length < 5) return;
    const hits = snap.media.filter(m => !used.has(m.id) && (' ' + norm(m.caption) + ' ').includes(' ' + t + ' '));
    if (hits.length === 1) { matched.set(r.slug, hits[0]); used.add(hits[0].id); }
  });
  const reels = list.map(r => ({
    slug: r.slug, title: r.title, posted_at: r.posted_at || null, site_likes: likeCounts[r.slug] || 0,
    instagram: matched.get(r.slug) || null, linked_by: matched.has(r.slug) ? (instagram.shortcodeOf(r.url) ? 'link' : 'title') : null,
  }));
  const unmatched = snap.media.filter(m => !used.has(m.id));
  return { ...base, synced: true, fetched_at: snap.fetched_at, insights_at: snap.insights_at || null, account: snap.account, totals: snap.totals, reels, unmatched, history: snap.history || [] };
}

app.get('/api/instagram-stats', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(instagramReport());
});

app.post('/api/instagram-stats/refresh', requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!instagram.isConfigured()) return res.status(400).json({ ...instagramReport(), error: instagram.friendlyError({ code: 'not_configured' }) });
  try {
    await instagram.sync({ manual: true });
    res.json(instagramReport());
  } catch (e) {
    const status = e.code === 'rate_limited' ? 429 : 502;
    res.status(status).json({ ...instagramReport(e), error: instagram.friendlyError(e) });
  }
});

// Background sync (only when Instagram is connected):
//   - light every INSTAGRAM_LIGHT_MINUTES (default 10, min 5): followers, likes, comments;
//   - full  every INSTAGRAM_SYNC_MINUTES  (default 60, min 15): + views, reach, saves, shares.
if (instagram.isConfigured()) {
  const FULL_MIN = Math.max(15, Number(process.env.INSTAGRAM_SYNC_MINUTES) || 60);
  const LIGHT_MIN = Math.max(5, Number(process.env.INSTAGRAM_LIGHT_MINUTES) || 10);
  const run = light => () => instagram.sync({ light }).catch(e => console.warn('[instagram] sync failed:', instagram.friendlyError(e)));
  setTimeout(run(false), 20 * 1000).unref();
  setInterval(run(false), FULL_MIN * 60 * 1000).unref();
  setInterval(run(true), LIGHT_MIN * 60 * 1000).unref();
}

app.post('/api/likes/:slug', express.json({ limit: '1kb' }), (req, res) => {
  const slug = req.params.slug;
  if (!allowedSlugs().has(slug)) return res.status(404).json({ error: 'Unknown reel' });
  if (likeRateLimited(req.ip)) return res.status(429).json({ error: 'Too many requests' });

  const liked = !!(req.body && req.body.liked);
  const key = `${req.ip}|${slug}`;
  if (liked && !likedBy.has(key)) {
    likedBy.add(key);
    likeCounts[slug] = (likeCounts[slug] || 0) + 1;
    saveLikesSoon();
  } else if (!liked) {
    likedBy.delete(key);
    if ((likeCounts[slug] || 0) > 0) { likeCounts[slug] -= 1; saveLikesSoon(); }
  }
  res.set('Cache-Control', 'no-store');
  res.json({ slug, count: likeCounts[slug] || 0 });
});


// ---------------------------------------------------------------------------
// Reels API (public) + admin API
// ---------------------------------------------------------------------------
const INTERNAL_FIELDS = ['managed', 'source', 'hidden', 'meta', 'scheduled_publish_at', 'deleted'];
function publicView(r) {
  const out = { ...r };
  INTERNAL_FIELDS.forEach(k => delete out[k]);
  return out;
}
function sendPublicReels(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(store.getPublic().map(publicView));
}
app.get('/api/reels', sendPublicReels);
app.get('/reels.json', sendPublicReels);

// Everything the admin list needs, in one call.
app.get('/api/reels-admin', requireAdmin, (req, res) => {
  const reels = store.getAll().map(r => ({
    slug: r.slug, title: r.title, description: r.description || '', hashtags: r.hashtags || '',
    url: r.url || '', posted_at: r.posted_at || null, scheduled_publish_at: r.scheduled_publish_at || null,
    status: r.status, source: r.source, hidden: !!r.hidden,
    poster: `/images/posters/${r.slug}.jpg`, likes: likeCounts[r.slug] || 0,
  }));
  res.set('Cache-Control', 'no-store');
  res.json(reels);
});

function cleanFields(body) {
  const out = {};
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  if ('title' in body) { out.title = str(body.title, 120); if (!out.title) throw new Error('Title is required'); }
  if ('description' in body) out.description = str(body.description, 500);
  if ('hashtags' in body) out.hashtags = str(body.hashtags, 300);
  if ('url' in body) {
    out.url = str(body.url, 500);
    if (out.url && !/^https:\/\//i.test(out.url)) throw new Error('Instagram URL must start with https://');
  }
  if ('posted_at' in body && body.posted_at) {
    const d = new Date(body.posted_at);
    if (isNaN(d)) throw new Error('Invalid publish date');
    out.posted_at = d.toISOString();
  }
  if ('scheduled_publish_at' in body) {
    if (!body.scheduled_publish_at) out.scheduled_publish_at = null;
    else {
      const d = new Date(body.scheduled_publish_at);
      if (isNaN(d)) throw new Error('Invalid schedule date');
      out.scheduled_publish_at = d.toISOString();
    }
  }
  return out;
}

app.put('/api/reel/:slug', requireAdmin, (req, res) => {
  if (!store.findBySlug(req.params.slug)) return res.status(404).json({ error: 'Reel not found' });
  try {
    store.updateReel(req.params.slug, cleanFields(req.body || {}));
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/reel/:slug', requireAdmin, (req, res) => {
  if (!store.deleteReel(req.params.slug)) return res.status(404).json({ error: 'Reel not found' });
  res.json({ success: true });
});

app.post('/api/reel/:slug/restore', requireAdmin, (req, res) => {
  if (!store.restoreReel(req.params.slug)) return res.status(404).json({ error: 'Nothing to restore' });
  res.json({ success: true });
});

// ── Upload: accept the file, then compress / extract audio / make a poster in
// the background (one job at a time) while the admin polls for progress. ──
const MAX_UPLOAD_MB = 100; // Cloudflare's request-size limit on the free plan
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')}`),
  }),
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Only video files are allowed'), false)),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});
function receiveVideo(req, res, next) {
  upload.single('video')(req, res, err => {
    if (!err) return next();
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({ error: tooBig ? `Video is larger than ${MAX_UPLOAD_MB} MB (the upload limit)` : err.message });
  });
}

const jobs = new Map();
let jobQueue = Promise.resolve();
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, j] of jobs) if (j.createdAt < cutoff) jobs.delete(id);
}, 10 * 60 * 1000).unref();

async function processUpload(job, tmpFile, record) {
  const made = [];
  try {
    job.status = 'processing'; job.step = 'Reading the video'; job.progress = 0;
    let info;
    try { info = media.probeVideo(tmpFile); } catch (e) { throw new Error("This file is not a readable video"); }
    const n = store.nextReelNumber();
    const videoPath = path.join(MEDIA_DIR, 'video', `reel-${n}.mp4`);
    const audioPath = path.join(MEDIA_DIR, 'audio', `reel-${n}.mp3`);
    const posterPath = path.join(MEDIA_DIR, 'images', 'posters', `${record.slug}.jpg`);

    job.step = 'Compressing the video';
    made.push(videoPath);
    await media.compressVideo(tmpFile, videoPath, info.duration, p => { job.progress = p; });

    job.step = 'Extracting the audio'; job.progress = 100;
    let audioUrl;
    try { made.push(audioPath); await media.extractAudio(videoPath, audioPath); audioUrl = `/audio/reel-${n}.mp3`; }
    catch (e) { /* silent video: no hover audio */ }

    job.step = 'Creating the thumbnail';
    const meta = media.probeVideo(videoPath);
    made.push(posterPath);
    await media.makePoster(videoPath, posterPath, meta.duration);

    store.addReel({ ...record, video_url: `/video/reel-${n}.mp4`, ...(audioUrl ? { audio_url: audioUrl } : {}), meta });
    job.status = 'done'; job.step = 'Published'; job.reel = { slug: record.slug, title: record.title };
  } catch (err) {
    made.forEach(f => { try { fs.unlinkSync(f); } catch (e) { /* not created */ } });
    job.status = 'error'; job.error = err.message;
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

app.post('/api/upload-reel', requireAdmin, receiveVideo, (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No video file provided' });
  const fail = (code, error) => { fs.unlink(file.path, () => {}); return res.status(code).json({ error }); };

  let fields;
  try { fields = cleanFields({ title: req.body.title, description: req.body.description, hashtags: req.body.hashtags, url: req.body.url }); }
  catch (err) { return fail(400, err.message); }

  const slug = site.slugify(fields.title);
  if (!slug) return fail(400, 'Title must contain letters or numbers');
  if (store.findBySlug(slug) || site.FEATURED_VIDEOS.some(v => site.slugify(v.title) === slug)) {
    return fail(409, 'A reel with this title already exists');
  }

  let posted_at = new Date();
  if (req.body.posted_at) { posted_at = new Date(req.body.posted_at); if (isNaN(posted_at)) return fail(400, 'Invalid publish date'); }
  let scheduled;
  if (req.body.scheduledDate) {
    const d = new Date(req.body.scheduledDate);
    if (isNaN(d)) return fail(400, 'Invalid schedule date');
    scheduled = d.toISOString();
  }

  const record = {
    slug, title: fields.title, subtitle: '@irreallab · Watch on Instagram',
    url: fields.url || 'https://www.instagram.com/irreallab/',
    hashtags: fields.hashtags || '#irreallab',
    description: fields.description || '',
    posted_at: posted_at.toISOString(),
    ...(scheduled ? { scheduled_publish_at: scheduled } : {}),
  };

  const job = { id: crypto.randomBytes(8).toString('hex'), status: 'queued', step: 'Waiting', progress: 0, createdAt: Date.now() };
  jobs.set(job.id, job);
  jobQueue = jobQueue.then(() => processUpload(job, file.path, record));
  res.status(202).json({ jobId: job.id });
});

app.get('/api/upload-jobs/:id', requireAdmin, (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Unknown job' });
  res.set('Cache-Control', 'no-store');
  res.json({ status: j.status, step: j.step, progress: j.progress, error: j.error, reel: j.reel });
});

// ---------------------------------------------------------------------------
// Pages rendered on request, so admin-published reels get a real page,
// poster-backed SEO tags and a sitemap entry without any build step.
// ---------------------------------------------------------------------------
// Media published from the admin lives on the volume; repo media is static.
app.use((req, res, next) => {
  if (!/^\/(video|audio|images\/posters)\//.test(req.path)) return next();
  let rel;
  try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
  const file = path.join(MEDIA_DIR, rel);
  if (file.startsWith(MEDIA_DIR + path.sep) && fs.existsSync(file)) {
    return res.sendFile(file, { headers: { 'Cache-Control': 'public, max-age=86400' } });
  }
  next();
});

app.get('/reel/:slug.html', (req, res, next) => {
  const slug = req.params.slug;
  const pub = store.getPublic();
  const known = store.getAll().find(r => r.slug === slug);
  let reel; const neighbors = { prev: null, next: null };

  if (known) {
    if (known.hidden || known.status !== 'Live') return res.status(404).send('Not found');
    reel = known;
    const i = pub.findIndex(r => r.slug === slug);
    if (pub[i - 1]) neighbors.prev = { slug: pub[i - 1].slug, title: pub[i - 1].title };
    if (pub[i + 1]) neighbors.next = { slug: pub[i + 1].slug, title: pub[i + 1].title };
  } else {
    reel = site.FEATURED_VIDEOS.find(v => site.slugify(v.title) === slug);
    if (!reel) return next();
  }

  const meta = store.metaFor(reel);
  if (!meta) return next();
  res.set('Cache-Control', 'public, max-age=0, must-revalidate');
  res.type('html').send(site.renderPage(site.pageHtml(reel, { slug, ...meta }, neighbors)));
});

let sitemapCache = { key: '', xml: '' };
app.get('/sitemap.xml', (req, res) => {
  const key = store.revision() + '|' + new Date().toISOString().slice(0, 10);
  if (sitemapCache.key !== key) {
    const entries = [];
    store.getPublic().forEach(r => { const m = store.metaFor(r); if (m) entries.push({ reel: r, meta: { slug: r.slug, ...m } }); });
    site.FEATURED_VIDEOS.forEach(v => { const m = store.metaFor(v); if (m) entries.push({ reel: v, meta: { slug: site.slugify(v.title), ...m } }); });
    sitemapCache = { key, xml: site.sitemapXml(entries) };
  }
  res.set('Cache-Control', 'public, max-age=0, must-revalidate');
  res.type('application/xml').send(sitemapCache.xml);
});


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// main.html was merged into index.html (the homepage no longer has a
// separate splash page + hub page) — send old links straight to /.
app.get(['/main', '/main.html'], (req, res) => res.redirect(301, '/'));

// Serve HTML files without .html extension
app.use((req, res, next) => {
  // Skip files with extensions (images, css, js, etc)
  if (req.path.includes('.')) {
    return next();
  }

  const possiblePath = path.join(__dirname, req.path + '.html');
  if (fs.existsSync(possiblePath)) {
    return res.sendFile(possiblePath);
  }

  next();
});

// Static file serving (after API routes so routes take priority)
app.use(express.static(__dirname, {
  setHeaders(res, filePath) {
    // Code and data must always be revalidated (a CDN sits in front of us);
    // heavy media can be cached for a day.
    if (/\.(html|css|js|json|xml|txt)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.(mp4|mp3|jpg|jpeg|png|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

app.listen(PORT, () => {
  console.log(`\n🎬 Irreallab Server running at http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`\n✨ Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`🎞️  Reels page: http://localhost:${PORT}/reels.html\n`);
});
