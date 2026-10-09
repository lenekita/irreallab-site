/* Reel catalogue = reels committed in the repo (reels.json) merged with
   reels managed from the admin panel (stored on the persistent volume at
   $DATA_DIR). Admin edits to a repo reel are stored as small overrides, and
   "deleting" a repo reel hides it (a tombstone), so git stays untouched. */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./site');
const { probeVideo } = require('./media');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const TMP_DIR = path.join(DATA_DIR, 'tmp');
const STORE_FILE = path.join(DATA_DIR, 'reels.json');
const REPO_FILE = path.join(ROOT, 'reels.json');

['video', 'audio', path.join('images', 'posters')].forEach(d => fs.mkdirSync(path.join(MEDIA_DIR, d), { recursive: true }));
fs.mkdirSync(TMP_DIR, { recursive: true });

let revision = 0;
let managed = [];
try { managed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch (e) { managed = []; }

function saveManaged() {
  revision += 1;
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(managed, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

let repoCache = { mtime: 0, reels: [] };
function repoReels() {
  try {
    const mtime = fs.statSync(REPO_FILE).mtimeMs;
    if (mtime !== repoCache.mtime) {
      const raw = JSON.parse(fs.readFileSync(REPO_FILE, 'utf8'));
      repoCache = {
        mtime,
        reels: raw
          .filter(r => r.title && r.video_url && r.video_url.startsWith('/'))
          .map(r => ({ ...r, slug: r.slug || slugify(r.title), source: 'repo' })),
      };
      revision += 1;
    }
  } catch (e) { /* keep last known */ }
  return repoCache.reels;
}

function withStatus(r, now) {
  const scheduled = r.scheduled_publish_at && new Date(r.scheduled_publish_at) > now;
  return { ...r, status: scheduled ? 'Scheduled' : 'Live' };
}

function merged({ includeScheduled = false, includeHidden = false } = {}) {
  const now = new Date();
  const hiddenSlugs = new Set(managed.filter(r => r.deleted).map(r => r.slug));
  const overrides = new Map(managed.filter(r => !r.deleted && !r.managed).map(r => [r.slug, r]));

  let list = repoReels().map(r => {
    const o = overrides.get(r.slug);
    const out = o ? { ...r, ...o, source: 'repo' } : { ...r };
    if (hiddenSlugs.has(r.slug)) out.hidden = true;
    return out;
  });

  // admin-published reels, newest first, slotted in by date among the repo list
  const added = managed.filter(r => r.managed && !r.deleted)
    .map(r => ({ ...r, source: 'admin' }))
    .sort((a, b) => String(b.posted_at).localeCompare(String(a.posted_at)));
  added.forEach(m => {
    const i = list.findIndex(r => !r.posted_at || String(r.posted_at) < String(m.posted_at));
    if (i === -1) list.push(m); else list.splice(i, 0, m);
  });

  if (!includeHidden) list = list.filter(r => !r.hidden);
  list = list.map(r => withStatus(r, now));
  if (!includeScheduled) list = list.filter(r => r.status === 'Live');
  return list;
}

const getPublic = () => merged();
const getAll = () => merged({ includeScheduled: true, includeHidden: true });
const findBySlug = slug => getAll().find(r => r.slug === slug);

function nextReelNumber() {
  const nums = [path.join(MEDIA_DIR, 'video'), path.join(ROOT, 'video')].flatMap(dir => {
    try { return fs.readdirSync(dir); } catch (e) { return []; }
  }).map(f => (f.match(/^reel-(\d+)\.mp4$/) || [])[1]).filter(Boolean).map(Number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

// A URL like /video/reel-3.mp4 lives on the volume (admin) or in the repo.
function resolveMedia(urlPath) {
  if (!urlPath) return null;
  const onVolume = path.join(MEDIA_DIR, urlPath);
  if (onVolume.startsWith(MEDIA_DIR) && fs.existsSync(onVolume)) return onVolume;
  const inRepo = path.join(ROOT, urlPath);
  return fs.existsSync(inRepo) ? inRepo : null;
}

const metaCache = new Map();
function metaFor(reel) {
  if (reel.meta) return reel.meta;
  if (metaCache.has(reel.video_url)) return metaCache.get(reel.video_url);
  const file = resolveMedia(reel.video_url);
  if (!file) return null;
  try {
    const meta = probeVideo(file);
    metaCache.set(reel.video_url, meta);
    return meta;
  } catch (e) { return null; }
}

function addReel(record) {
  managed.unshift({ ...record, managed: true });
  saveManaged();
}

const EDITABLE = ['title', 'description', 'hashtags', 'url', 'posted_at', 'scheduled_publish_at'];
function updateReel(slug, fields) {
  const clean = {};
  EDITABLE.forEach(k => { if (k in fields) clean[k] = fields[k]; });
  const existing = managed.find(r => r.slug === slug && !r.deleted);
  if (existing) Object.assign(existing, clean);
  else {
    managed.push({ slug, ...clean });
  }
  saveManaged();
}

function removeMediaFiles(reel) {
  [reel.video_url, reel.audio_url, `/images/posters/${reel.slug}.jpg`].forEach(u => {
    if (!u) return;
    const f = path.join(MEDIA_DIR, u);
    if (f.startsWith(MEDIA_DIR)) { try { fs.unlinkSync(f); } catch (e) { /* already gone */ } }
  });
}

// Admin-published reels are removed for good; repo reels are hidden (restorable).
function deleteReel(slug) {
  const reel = findBySlug(slug);
  if (!reel) return false;
  if (reel.source === 'admin') {
    managed = managed.filter(r => r.slug !== slug);
    removeMediaFiles(reel);
  } else {
    managed = managed.filter(r => !(r.slug === slug && r.deleted));
    managed.push({ slug, deleted: true });
  }
  saveManaged();
  return true;
}

function restoreReel(slug) {
  const before = managed.length;
  managed = managed.filter(r => !(r.slug === slug && r.deleted));
  if (managed.length !== before) saveManaged();
  return managed.length !== before;
}

function allowedSlugs(featuredSlugs) {
  const set = new Set(featuredSlugs);
  getAll().filter(r => !r.hidden).forEach(r => set.add(r.slug));
  return set;
}

module.exports = {
  DATA_DIR, MEDIA_DIR, TMP_DIR,
  getPublic, getAll, findBySlug, addReel, updateReel, deleteReel, restoreReel,
  nextReelNumber, resolveMedia, metaFor, allowedSlugs,
  revision: () => revision,
};
