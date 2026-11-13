#!/usr/bin/env node
/**
 * Instagram statistics in the terminal, straight from the live site.
 *
 *   npm run stats                 print the dashboard
 *   npm run stats -- --refresh    ask the site to re-sync with Instagram first
 *   npm run stats -- --json       raw JSON (for scripts)
 *   npm run stats -- --site http://localhost:3000
 *
 * It logs in to the admin API like the admin page does. Credentials, in order:
 *   1. IRREALLAB_ADMIN_USER / IRREALLAB_ADMIN_PASSWORD environment variables
 *   2. macOS Keychain (service "irreallab-admin", account = admin user)
 *   3. an interactive prompt (the password is hidden while you type)
 * Nothing is written to disk.
 */
const { execFileSync } = require('child_process');
const readline = require('readline');

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > -1 && args[i + 1] ? args[i + 1] : d; };
const SITE = opt('site', process.env.IRREALLAB_SITE || 'https://irreallab.fr').replace(/\/$/, '');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, t) => (useColor ? `\x1b[${code}m${t}\x1b[0m` : String(t));
const bold = t => c('1', t), dim = t => c('2', t), lime = t => c('38;5;190', t), red = t => c('31', t), green = t => c('32', t);

const fmt = n => (n == null ? '–' : Number(n).toLocaleString('en-US'));
const sgn = n => (n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)));
const tint = n => (n > 0 ? green(sgn(n)) : n < 0 ? red(sgn(n)) : dim(sgn(n)));
const strip = s => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const pad = (s, w, right) => { const l = strip(s).length; const sp = ' '.repeat(Math.max(0, w - l)); return right ? sp + s : s + sp; };
const ago = iso => {
  if (!iso) return 'never';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  return h < 48 ? h + ' h ago' : Math.floor(h / 24) + ' d ago';
};

function ask(question, hidden) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    if (hidden) {
      rl._writeToOutput = s => { if (s.includes(question)) process.stderr.write(s); };
    }
    rl.question(question, a => { rl.close(); if (hidden) process.stderr.write('\n'); resolve(a.trim()); });
  });
}

function keychainPassword(user) {
  if (process.platform !== 'darwin') return '';
  try { return execFileSync('security', ['find-generic-password', '-s', 'irreallab-admin', '-a', user, '-w'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch (e) { return ''; }
}

async function login() {
  let user = process.env.IRREALLAB_ADMIN_USER || '';
  let password = process.env.IRREALLAB_ADMIN_PASSWORD || '';
  if (!user) user = await ask('Admin user: ');
  if (!password) password = keychainPassword(user);
  if (!password) password = await ask('Admin password: ', true);
  const res = await fetch(SITE + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(res.status === 401 ? 'Incorrect admin user or password.' : (body.error || 'Login failed (' + res.status + ').'));
  }
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  const cookie = cookies.map(x => x.split(';')[0]).filter(Boolean).join('; ');
  if (!cookie) throw new Error('Login worked but no session cookie came back.');
  return cookie;
}

async function getJson(path, cookie, method) {
  const res = await fetch(SITE + path, { method: method || 'GET', headers: { Cookie: cookie } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.configured && !body.account) throw new Error(body.error || 'Request failed (' + res.status + ').');
  return body;
}

function weekDelta(d, key) {
  const val = h => (key === 'followers' ? h.followers : (h.totals ? h.totals[key] : null));
  const h = (d.history || []).filter(p => val(p) != null);
  if (h.length < 2) return null;
  const last = h[h.length - 1];
  const target = new Date(last.date).getTime() - 7 * 86400000;
  const ref = [...h].reverse().find(p => new Date(p.date).getTime() <= target) || h[0];
  return ref === last ? null : val(last) - val(ref);
}

function render(d) {
  const out = [];
  const a = d.account || {}, t = d.totals || {};
  out.push('');
  out.push(bold(lime('  IRREAL')) + bold('LAB_') + dim('  ·  Instagram statistics'));
  out.push(dim(`  @${a.username || '?'}  ·  likes & comments ${ago(d.fetched_at)}  ·  views & reach ${ago(d.insights_at || d.fetched_at)}`));
  out.push('');

  const kpis = [['Followers', a.followers, 'followers'], ['Views', t.views, 'views'], ['Likes', t.likes, 'likes'], ['Comments', t.comments, 'comments'], ['Shares', t.shares, 'shares'], ['Saves', t.saves, 'saves']];
  const w = 14;
  out.push('  ' + kpis.map(k => pad(dim(k[0]), w)).join(''));
  out.push('  ' + kpis.map(k => pad(bold(lime(fmt(k[1]))), w)).join(''));
  out.push('  ' + kpis.map(k => { const dl = weekDelta(d, k[2]); return pad(dl == null ? dim('') : tint(dl) + dim(' /7d'), w); }).join(''));
  out.push('');

  const r = d.recap;
  if (r && r.ready) {
    const tt = r.totals || {};
    out.push(bold('  Last hour') + dim(`  (${r.minutes} min)`));
    out.push('  ' + [['followers', r.followers], ['views', tt.views], ['likes', tt.likes], ['comments', tt.comments], ['shares', tt.shares], ['saves', tt.saves]]
      .map(([l, n]) => tint(n) + ' ' + dim(l)).join(dim('   ·   ')));
    (r.posts || []).forEach(p => {
      const bits = ['views', 'likes', 'comments', 'shares', 'saves'].filter(k => p[k]).map(k => sgn(p[k]) + ' ' + k);
      out.push(dim('    ' + p.title + (p.is_new ? ' (new)' : '') + ' — ') + (bits.join(', ') || dim('published')));
    });
    out.push('');
  }

  const reels = [...(d.reels || [])].sort((p, q) => ((q.instagram && q.instagram.views) || -1) - ((p.instagram && p.instagram.views) || -1));
  const cols = [['Reel', 30, false], ['Views', 8, true], ['Likes', 7, true], ['Comm.', 6, true], ['Shares', 7, true], ['Saves', 6, true], ['Reach', 8, true], ['Eng.', 6, true], ['Site ♥', 7, true]];
  out.push('  ' + cols.map(([n, wd, r2]) => pad(dim(n), wd, r2)).join('  '));
  out.push('  ' + dim('─'.repeat(cols.reduce((s, x) => s + x[1] + 2, -2))));
  reels.forEach(r2 => {
    const ig = r2.instagram;
    const title = r2.title.length > 29 ? r2.title.slice(0, 28) + '…' : r2.title;
    if (!ig) { out.push('  ' + pad(title, 30) + '  ' + dim('no Instagram post linked')); return; }
    const eng = ig.views ? (((ig.likes || 0) + (ig.comments || 0) + (ig.shares || 0) + (ig.saves || 0)) / ig.views * 100).toFixed(1) + '%' : '–';
    const row = [[title, 30, false], [lime(fmt(ig.views)), 8, true], [fmt(ig.likes), 7, true], [fmt(ig.comments), 6, true], [fmt(ig.shares), 7, true], [fmt(ig.saves), 6, true], [fmt(ig.reach), 8, true], [eng, 6, true], [fmt(r2.site_likes), 7, true]];
    out.push('  ' + row.map(([s, wd, r3]) => pad(s, wd, r3)).join('  '));
  });
  const other = d.unmatched || [];
  if (other.length) out.push(dim(`\n  + ${other.length} other Instagram post${other.length === 1 ? '' : 's'} not linked to a reel (see the admin page)`));
  out.push('');
  return out.join('\n');
}

(async () => {
  try {
    const cookie = await login();
    let data;
    if (flag('refresh')) {
      process.stderr.write(dim('Syncing with Instagram…\n'));
      data = await getJson('/api/instagram-stats/refresh', cookie, 'POST');
    } else {
      data = await getJson('/api/instagram-stats', cookie);
    }
    if (flag('json')) return console.log(JSON.stringify(data, null, 2));
    if (!data.configured) return console.log('\nInstagram is not connected on the server yet (INSTAGRAM_ACCESS_TOKEN is missing in Railway).\n');
    if (!data.synced) return console.log('\nWaiting for the first synchronisation with Instagram… try again in a minute.' + (data.error ? '\n' + data.error : '') + '\n');
    if (data.error) console.log(red('\n  Note: ' + data.error));
    console.log(render(data));
  } catch (e) {
    console.error(red('\n' + e.message + '\n'));
    process.exit(1);
  }
})();
