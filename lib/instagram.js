/*
 * lib/instagram.js — Instagram statistics sync (official "Instagram API with Instagram Login").
 *
 * What it does
 *   - pulls the account (followers…) and every post/reel with likes, comments and insights
 *     (views, reach, saves, shares, interactions, average watch time);
 *   - keeps the latest snapshot + one small snapshot per day (history) in $DATA_DIR/instagram-stats.json;
 *   - renews the long-lived access token before it expires (60 days) and stores the renewed one in
 *     $DATA_DIR/instagram-token.json, so nobody has to touch it again.
 *
 * Two ways to connect (Railway variables), the first one found wins:
 *   A) "Facebook Login" route — works without any tester invitation:
 *        META_APP_ID, META_APP_SECRET, META_USER_TOKEN
 *      (a user token from Graph API Explorer). The server turns it into a long-lived token, finds the
 *      Facebook Page linked to the Instagram professional account and keeps the never-expiring Page token.
 *      Optional: INSTAGRAM_PAGE_ID, INSTAGRAM_USERNAME to choose when several Pages are returned.
 *   B) "Instagram Login" route: INSTAGRAM_ACCESS_TOKEN (long-lived, renewed by the server).
 * Optional: INSTAGRAM_API_VERSION (default v23.0). INSTAGRAM_GRAPH_BASE / FACEBOOK_GRAPH_BASE are for tests.
 * Tokens never leave the server and are never written to the stats file.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DATA_DIR } = require('./reels-store');

const BASE = (process.env.INSTAGRAM_GRAPH_BASE || 'https://graph.instagram.com').replace(/\/$/, '');
const FB_BASE = (process.env.FACEBOOK_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '');
const VERSION = process.env.INSTAGRAM_API_VERSION || 'v23.0';
const STATS_FILE = path.join(DATA_DIR, 'instagram-stats.json');
const TOKEN_FILE = path.join(DATA_DIR, 'instagram-token.json');
const POINTS_FILE = path.join(DATA_DIR, 'instagram-points.json');   // one point per sync, for hourly graph + recap

const MAX_MEDIA = 100;            // most recent posts to read
const CONCURRENCY = 4;
const REFRESH_AFTER_DAYS = 30;    // tokens last 60 days; renew well before
const HISTORY_DAYS = 400;
const RECENT_DAYS = 30;           // posts newer than this get fresh insights on every full sync
const MIN_MANUAL_INTERVAL_MS = 60 * 1000;

const REEL_METRICS = ['reach', 'views', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'];
const POST_METRICS = ['reach', 'views', 'saved', 'shares', 'total_interactions'];
const BASIC_METRICS = ['reach', 'views'];

let syncing = null;
let lastRun = 0;

/* ---------------------------------------------------------------- helpers */
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

class IgError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

async function get(urlPath, params, token, base) {
  const url = new URL(/^https?:/.test(urlPath) ? urlPath : `${base || BASE}/${VERSION}${urlPath}`);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('access_token', token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try { res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } }); }
  catch (e) { throw new IgError('Instagram is unreachable (' + (e.name === 'AbortError' ? 'timeout' : e.message) + ')', 'network', 0); }
  finally { clearTimeout(timer); }
  let body = {};
  try { body = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok || body.error) {
    const err = body.error || {};
    throw new IgError(err.message || ('Instagram API error ' + res.status), err.code || res.status, res.status);
  }
  return body;
}

/* ---------------------------------------------------------------- token */
function envToken() { return (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim(); }

/** Returns the token to use: the renewed one on disk, unless the env var was changed since. */
function currentToken() {
  const env = envToken();
  if (!env) return '';
  const saved = readJson(TOKEN_FILE, null);
  if (saved && saved.token && saved.env_sha === sha(env)) return saved.token;
  return env;
}

function fbEnv() {
  return {
    appId: (process.env.META_APP_ID || '').trim(),
    secret: (process.env.META_APP_SECRET || '').trim(),
    userToken: (process.env.META_USER_TOKEN || '').trim(),
  };
}
function facebookMode() { const e = fbEnv(); return !!(e.appId && e.secret && e.userToken); }
function isConfigured() { return facebookMode() || !!envToken(); }

/* ---- route A: Facebook Login (user token -> long-lived -> Page token + Instagram id) ---- */
async function deriveFacebookAuth(userToken, e) {
  const ll = await get('/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: e.appId, client_secret: e.secret, fb_exchange_token: userToken }, userToken, FB_BASE);
  const longLived = ll.access_token || userToken;
  const pages = await get('/me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '50' }, longLived, FB_BASE);
  const withIg = (pages.data || []).filter(p => p.instagram_business_account && p.access_token);
  if (!withIg.length) {
    throw new IgError('No Facebook Page linked to an Instagram professional account was found for this token. Link @irreallab to a Facebook Page, then generate the token again with the pages_show_list permission.', 'no_page', 400);
  }
  const wantId = (process.env.INSTAGRAM_PAGE_ID || '').trim();
  const wantUser = (process.env.INSTAGRAM_USERNAME || '').trim().toLowerCase();
  const page = withIg.find(p => wantId && p.id === wantId)
    || withIg.find(p => wantUser && (p.instagram_business_account.username || '').toLowerCase() === wantUser)
    || withIg[0];
  return {
    mode: 'facebook', fp: sha(e.appId + ':' + e.userToken),
    user_token: longLived, page_token: page.access_token, page_id: page.id,
    ig_user_id: page.instagram_business_account.id, ig_username: page.instagram_business_account.username || '',
    derived_at: Date.now(),
  };
}

async function facebookAuth() {
  const e = fbEnv();
  const saved = readJson(TOKEN_FILE, null);
  const fp = sha(e.appId + ':' + e.userToken);
  if (saved && saved.mode === 'facebook' && saved.fp === fp && saved.page_token && saved.ig_user_id) {
    // Re-derive monthly from the stored long-lived user token (keeps everything valid, cheap).
    if ((Date.now() - saved.derived_at) / 86400000 < REFRESH_AFTER_DAYS) return saved;
    try {
      const fresh = await deriveFacebookAuth(saved.user_token, e);
      fresh.fp = fp; writeJson(TOKEN_FILE, fresh); return fresh;
    } catch (err) { return saved; }   // keep using the Page token; it normally does not expire
  }
  const fresh = await deriveFacebookAuth(e.userToken, e);
  writeJson(TOKEN_FILE, fresh);
  return fresh;
}

async function maybeRefreshToken() {
  const env = envToken();
  if (!env) return;
  const saved = readJson(TOKEN_FILE, null);
  const same = saved && saved.env_sha === sha(env);
  const token = same ? saved.token : env;
  const refreshedAt = same ? saved.refreshed_at : 0;
  const ageDays = (Date.now() - refreshedAt) / 86400000;
  if (same && ageDays < REFRESH_AFTER_DAYS) return;
  try {
    const body = await get(`${BASE}/refresh_access_token`, { grant_type: 'ig_refresh_token' }, token);
    if (body.access_token) {
      writeJson(TOKEN_FILE, {
        token: body.access_token, env_sha: sha(env), refreshed_at: Date.now(),
        expires_at: Date.now() + (body.expires_in || 5184000) * 1000,
      });
    }
  } catch (e) {
    // A token younger than 24h cannot be refreshed yet; that is not a failure.
    if (!/24 hours|too young|not old enough/i.test(e.message)) console.warn('[instagram] token refresh failed:', e.message);
  }
}

/* ---------------------------------------------------------------- sync */
async function pool(items, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) { const n = i++; out[n] = await worker(items[n], n); }
  }));
  return out;
}

function metricValue(m) {
  if (!m) return null;
  if (Array.isArray(m.values) && m.values[0] && m.values[0].value != null) return Number(m.values[0].value);
  if (m.total_value && m.total_value.value != null) return Number(m.total_value.value);
  return null;
}

async function insightsFor(media, token, base) {
  const isReel = media.media_product_type === 'REELS' || media.media_type === 'VIDEO';
  const attempts = isReel ? [REEL_METRICS, POST_METRICS, BASIC_METRICS] : [POST_METRICS, BASIC_METRICS];
  for (const metrics of attempts) {
    try {
      const body = await get(`/${media.id}/insights`, { metric: metrics.join(',') }, token, base);
      const out = {};
      (body.data || []).forEach(m => { out[m.name] = metricValue(m); });
      return out;
    } catch (e) {
      if (e.code === 190 || e.code === 102 || e.code === 'network') throw e;   // token / network: no point retrying
      /* unsupported metric for this media: try the smaller set */
    }
  }
  return {};
}

function shortcodeOf(permalinkOrUrl) {
  const m = /instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.exec(String(permalinkOrUrl || ''));
  return m ? m[1] : '';
}

async function doSync(opts) {
  const light = !!(opts && opts.light);
  if (!isConfigured()) throw new IgError('Instagram is not connected (no token is set).', 'not_configured', 0);
  let token, base, me;
  if (facebookMode()) {
    const auth = await facebookAuth();
    token = auth.page_token; base = FB_BASE; me = '/' + auth.ig_user_id;
  } else {
    await maybeRefreshToken();
    token = currentToken(); base = BASE; me = '/me';
  }

  const account = await get(me, { fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url' + (base === BASE ? ',user_id,account_type' : '') }, token, base);

  const list = [];
  let page = await get(me + '/media', {
    fields: 'id,caption,media_type,media_product_type,permalink,shortcode,timestamp,like_count,comments_count,thumbnail_url,media_url',
    limit: '50',
  }, token, base);
  for (;;) {
    (page.data || []).forEach(m => list.push(m));
    if (list.length >= MAX_MEDIA || !page.paging || !page.paging.next) break;
    page = await get(page.paging.next, {}, token, base);
  }
  const media = list.slice(0, MAX_MEDIA);

  // Tiered refresh keeps the number of API calls low:
  //   light  = account + post list only (likes, comments, followers) — a handful of calls;
  //   full   = also the insights (views, reach, saves, shares…) of recent posts, and of older
  //            posts at most once a day. Posts never seen before always get their insights.
  const previous = readJson(STATS_FILE, null);
  const prevById = new Map(((previous && previous.media) || []).map(m => [m.id, m]));
  const isLight = light && !!(previous && previous.media);
  const nowMs = Date.now(), nowIso = new Date(nowMs).toISOString();
  const needsInsights = m => {
    const old = prevById.get(m.id);
    if (!old || !old.insights_at) return true;
    if (isLight) return false;
    const ageDays = (nowMs - new Date(m.timestamp).getTime()) / 86400000;
    if (ageDays <= RECENT_DAYS) return true;
    return nowMs - new Date(old.insights_at).getTime() > 24 * 3600 * 1000;
  };
  const need = media.filter(needsInsights);
  const fetched = await pool(need, m => insightsFor(m, token, base));
  const fresh = new Map();
  need.forEach((m, i) => { if (fetched[i] && Object.keys(fetched[i]).length) fresh.set(m.id, fetched[i]); });

  const items = media.map(m => {
    const old = prevById.get(m.id) || {};
    const ins = fresh.get(m.id);
    const likes = m.like_count != null ? Number(m.like_count) : 0;
    const comments = m.comments_count != null ? Number(m.comments_count) : 0;
    const pick = (insKey, oldKey) => (ins ? (ins[insKey] != null ? ins[insKey] : null) : (old[oldKey] != null ? old[oldKey] : null));
    const interactions = ins ? (ins.total_interactions != null ? ins.total_interactions : likes + comments) : (old.interactions != null ? old.interactions : likes + comments);
    const watchRaw = ins ? ins.ig_reels_avg_watch_time : null;
    return {
      id: m.id,
      shortcode: m.shortcode || shortcodeOf(m.permalink),
      permalink: m.permalink,
      type: m.media_product_type || m.media_type,
      posted_at: m.timestamp,
      caption: (m.caption || '').slice(0, 140),
      thumbnail: m.thumbnail_url || m.media_url || '',
      likes, comments,
      views: pick('views', 'views'),
      reach: pick('reach', 'reach'),
      saves: pick('saved', 'saves'),
      shares: pick('shares', 'shares'),
      interactions,
      avg_watch_seconds: ins ? (watchRaw != null ? Math.round(watchRaw / 100) / 10 : null) : (old.avg_watch_seconds != null ? old.avg_watch_seconds : null),
      insights_at: ins ? nowIso : (old.insights_at || null),
    };
  });

  const sum = key => items.reduce((n, x) => n + (x[key] || 0), 0);
  const totals = { views: sum('views'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), saves: sum('saves'), reach: sum('reach'), posts: items.length };

  const history = Array.isArray(previous && previous.history) ? previous.history.slice() : [];
  const today = new Date().toISOString().slice(0, 10);
  const point = {
    date: today, followers: account.followers_count != null ? account.followers_count : null, totals,
    by_media: Object.fromEntries(items.filter(x => x.shortcode).map(x => [x.shortcode, { views: x.views, likes: x.likes, comments: x.comments }])),
  };
  const last = history[history.length - 1];
  if (last && last.date === today) history[history.length - 1] = point; else history.push(point);
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString().slice(0, 10);
  const trimmed = history.filter(h => h.date >= cutoff);

  const snapshot = {
    fetched_at: nowIso,
    mode: isLight ? 'light' : 'full',
    insights_at: fresh.size ? nowIso : ((previous && previous.insights_at) || null),
    account: {
      username: account.username, name: account.name || '', account_type: account.account_type || 'BUSINESS',
      followers: account.followers_count != null ? account.followers_count : null,
      following: account.follows_count != null ? account.follows_count : null,
      media_count: account.media_count != null ? account.media_count : null,
      picture: account.profile_picture_url || '',
    },
    totals, media: items, history: trimmed,
  };
  writeJson(STATS_FILE, snapshot);
  try { recordPoint(snapshot); } catch (e) { console.warn('[instagram] could not record hourly point:', e.message); }
  return snapshot;
}

/** Runs one sync at a time. `manual` calls are rate-limited to 1/min; `light` skips the insights. */
function sync({ manual = false, light = false } = {}) {
  if (syncing) return syncing;
  if (manual && Date.now() - lastRun < MIN_MANUAL_INTERVAL_MS) {
    return Promise.reject(new IgError('Just refreshed — wait a minute before refreshing again.', 'rate_limited', 429));
  }
  lastRun = Date.now();
  syncing = doSync({ light }).finally(() => { syncing = null; });
  return syncing;
}

function snapshot() { return readJson(STATS_FILE, null); }

/* ---------------------------------------------------------------- hourly points + recap */
const KEEP_DETAIL_HOURS = 26;     // every sync point (with per-post numbers) is kept this long
const KEEP_HOURLY_DAYS = 14;      // afterwards one point per hour, totals only

function recordPoint(snap) {
  const data = readJson(POINTS_FILE, { points: [] });
  const pts = Array.isArray(data.points) ? data.points : [];
  const m = {};
  (snap.media || []).forEach(x => { m[x.id] = [x.views, x.likes, x.comments, x.shares, x.saves]; });
  const t = snap.totals || {};
  pts.push({
    at: snap.fetched_at,
    f: snap.account && snap.account.followers != null ? snap.account.followers : null,
    tot: [t.views || 0, t.likes || 0, t.comments || 0, t.shares || 0, t.saves || 0, t.reach || 0],
    m,
  });
  const now = Date.now();
  const detailCut = now - KEEP_DETAIL_HOURS * 3600000;
  const hourCut = now - KEEP_HOURLY_DAYS * 86400000;
  const lastOfHour = new Map();
  const recent = [];
  pts.forEach(p => {
    const ms = Date.parse(p.at);
    if (!(ms >= hourCut)) return;
    if (ms >= detailCut) { recent.push(p); return; }
    lastOfHour.set(Math.floor(ms / 3600000), { at: p.at, f: p.f, tot: p.tot });   // drops per-post detail
  });
  const out = [...lastOfHour.values()].sort((a, b) => a.at < b.at ? -1 : 1).concat(recent);
  writeJson(POINTS_FILE, { points: out });
}

/** End-of-hour series for the graph: [{t, f, tot:[views,likes,comments,shares,saves,reach]}] */
function hourlySeries() {
  const pts = (readJson(POINTS_FILE, { points: [] }).points) || [];
  const byHour = new Map();
  pts.forEach(p => { byHour.set(Math.floor(Date.parse(p.at) / 3600000), p); });   // later points overwrite earlier ones
  return [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, p]) => ({
    t: new Date((h + 1) * 3600000).toISOString(),   // end of that hour
    at: p.at, f: p.f, tot: p.tot,
  }));
}

/** Text recap: what changed between ~1 hour ago and the latest sync. */
function lastHourRecap() {
  const pts = (readJson(POINTS_FILE, { points: [] }).points) || [];
  if (!pts.length) return { ready: false, collected_minutes: 0 };
  const latest = pts[pts.length - 1];
  const latestMs = Date.parse(latest.at);
  const collected = Math.round((latestMs - Date.parse(pts[0].at)) / 60000);
  const cands = pts.filter(p => p.m && latestMs - Date.parse(p.at) >= 35 * 60000);
  if (!cands.length || !latest.m) return { ready: false, collected_minutes: collected };
  const target = latestMs - 3600000;
  const base = cands.reduce((best, p) => Math.abs(Date.parse(p.at) - target) < Math.abs(Date.parse(best.at) - target) ? p : best);
  const d = (a, b) => (a == null || b == null) ? null : a - b;
  const totals = {};
  ['views', 'likes', 'comments', 'shares', 'saves', 'reach'].forEach((k, i) => { totals[k] = d(latest.tot[i], base.tot[i]); });
  const posts = [];
  Object.keys(latest.m).forEach(id => {
    const now = latest.m[id], was = base.m[id];
    const isNew = !was;
    const delta = isNew
      ? { views: now[0] || 0, likes: now[1] || 0, comments: now[2] || 0, shares: now[3] || 0, saves: now[4] || 0 }
      : { views: d(now[0], was[0]) || 0, likes: d(now[1], was[1]) || 0, comments: d(now[2], was[2]) || 0, shares: d(now[3], was[3]) || 0, saves: d(now[4], was[4]) || 0 };
    if (isNew || Object.values(delta).some(v => v !== 0)) posts.push({ id, is_new: isNew, ...delta });
  });
  posts.sort((a, b) => (b.views + b.likes * 5 + b.comments * 10 + b.shares * 10 + b.saves * 5) - (a.views + a.likes * 5 + a.comments * 10 + a.shares * 10 + a.saves * 5));
  return {
    ready: true, from: base.at, to: latest.at, minutes: Math.round((latestMs - Date.parse(base.at)) / 60000),
    followers: d(latest.f, base.f), followers_now: latest.f, totals, posts,
  };
}

function friendlyError(e) {
  if (!e) return '';
  if (e.code === 'not_configured') return 'Instagram is not connected yet.';
  if (e.code === 'no_page') return e.message;
  if (e.code === 190 || e.code === 102) return 'The Instagram/Meta access token is invalid or has expired. Generate a new one and update the token variable in Railway (META_USER_TOKEN or INSTAGRAM_ACCESS_TOKEN).';
  if (e.code === 101 || e.code === 1) return 'Meta rejected the app credentials (check META_APP_ID and META_APP_SECRET).';
  if (e.code === 10 || e.code === 200) return 'Instagram refused access to this data (permission missing on the token).';
  if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) return 'Instagram rate limit reached — try again in a little while.';
  return e.message || 'Instagram sync failed.';
}

module.exports = { isConfigured, sync, snapshot, hourlySeries, lastHourRecap, shortcodeOf, friendlyError, IgError };
