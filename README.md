# irreallab

A platform for surreal visual experiments in short-form video. Motion, surrealism & the art of the unreal.

**Website:** [irreallab.fr](https://irreallab.fr)
**Instagram:** [@irreallab](https://www.instagram.com/irreallab/)

---

## Overview

irreallab showcases curated surreal visual reels with synchronized audio, direct video playback, and its own page per reel. It's a hand-written HTML/CSS/JS site served by a small Express app (`server.js`), which also powers a password-protected admin panel for uploading and managing reels.

---

## Project structure

```
/
├── index.html               # Homepage: intro video hero, latest reels, CTA
├── reels.html                # Full reels archive/gallery
├── reel/*.html                # One generated page per reel (see below)
├── about.html, contact.html, credits.html
├── admin.html                # Password-protected reel upload/management tool
├── styles/site.css           # Shared design system (tokens, nav, footer, effects)
├── partials/nav.html, partials/footer.html  # Single source for nav/footer markup
├── animations2.js            # Marquee/nav scroll behavior, typewriter, cursor, audio player
├── language-switcher.js      # Client-side i18n (en/fr/ro via translations/*.json)
├── translations/             # en.json, fr.json, ro.json
├── reels.json                # Canonical reel data (title, video/audio URLs, hashtags…)
├── server.js                 # Express app: static hosting, extensionless routes,
│                              #   admin auth + API, reel pages & sitemap rendered on request, likes
├── lib/                      # site.js (page templates, shared with the build script),
│                              #   reels-store.js (repo + admin catalogue), media.js (ffmpeg)
├── scripts/
│   ├── build-reel-pages.js   # Generates reel/*.html + sitemap.xml from reels.json
│   ├── inject-partials.js    # Injects partials/nav.html + footer.html into every page
│   └── sync-instagram.js     # Validates reels.json fields (manual workflow, see below)
├── audio/, video/, images/   # Media assets
├── robots.txt, sitemap.xml
└── Dockerfile                # Container build for deployment
```

---

## How pages are assembled

There's no build framework — every page is a plain, self-contained HTML file — but
nav and footer markup live in one place:

- `partials/nav.html` and `partials/footer.html` are the source of truth.
- Each page contains `<!-- @nav -->...<!-- /@nav --> ` and `<!-- @footer -->...<!-- /@footer -->`
  sentinel comments.
- `npm run build:pages` (wraps `scripts/inject-partials.js`) replaces everything between
  each pair of sentinels with the current partial content, in place.

Run it after editing `partials/nav.html` or `partials/footer.html` so every page picks
up the change:

```bash
npm run build:pages
```

Shared visual language (color tokens, nav/footer styling, the noise-grain overlay,
marquee, glitch/typewriter title effects, custom cursor, audio toggle) lives in
`styles/site.css`, linked by every page. Page-specific layout (hero, forms, reel
grid…) stays in that page's own `<style>` block.

---

## Reel pages

Each reel gets its own page under `reel/<slug>.html`, generated from `reels.json`:

```bash
npm run build:reels
```

This reads `reels.json`, uses `ffmpeg`/`ffprobe` (must be on `PATH`) to grab a poster
frame and video metadata for each reel, writes `reel/<slug>.html` (canonical URL,
Open Graph video tags, JSON-LD `VideoObject`, prev/next reel links), and regenerates
`sitemap.xml`. It also runs `build:pages` at the end so the freshly generated reel
pages pick up the current nav/footer.

### Reel data format (`reels.json`)

```json
{
  "title": "Reel Title",
  "subtitle": "@irreallab · Watch on Instagram",
  "url": "https://www.instagram.com/reel/...",
  "hashtags": "#surreal #visual #art",
  "status": "Live",
  "video_url": "/video/reel-N.mp4",
  "audio_url": "/audio/reel-N.mp3",
  "posted_at": "2026-05-15T00:00:00.000Z",
  "description": "One or two sentences used as the meta description and reel-page copy."
}
```

### Adding a reel

The admin panel (`/admin.html`) handles upload, compression, and audio extraction for
you — see below. To add one by hand instead: drop the video into `video/`, add an
entry to `reels.json`, then run `npm run build:reels`.

### Instagram sync

`scripts/sync-instagram.js` is **not** an automated sync — Instagram no longer exposes
data that can be scraped, and there is no GitHub Actions workflow wired up. It's a
manual-workflow helper that validates `reels.json` has the fields each reel needs.
Add new reels via the admin panel or by editing `reels.json` directly.

---

## Admin panel

`/admin.html` (owner only) lets you publish and manage reels without
touching git: **upload** a video (MP4/MOV, 100 MB max), **edit** title /
description / hashtags / Instagram link / date, **schedule** a publication,
**delete** (or hide / restore) a reel, and see the **likes ranking**.

What happens on upload (in the background, with a progress bar): the video is
compressed to H.264, the audio is extracted, a thumbnail is created, and the
reel immediately gets its own page (`/reel/<slug>.html`, rendered by the
server), a sitemap entry and likes support — no build step.

- **Storage:** everything published from the admin lives on the persistent
  volume (`$DATA_DIR`, e.g. `/data` on Railway): `reels.json` (catalogue),
  `media/` (video, audio, posters) and `likes.json`. Reels committed in the repo
  (`reels.json`) are merged in; "deleting" one of those only hides it, so you can
  restore it. Titles can be edited but a reel's URL slug never changes.
- **Auth:** set `ADMIN_USER` and `ADMIN_PASSWORD` as environment variables on the
  host — never commit them. Login is checked server-side (constant-time
  comparison), sessions are an httpOnly (and, over HTTPS, Secure) cookie, and
  login is limited to 5 failed attempts per 15 minutes per IP. If the variables
  are missing, login is refused.
- The page is `noindex` and excluded from `robots.txt`. Source files, `lib/`,
  `scripts/` and `data/` are never served by the static handler.

---

## Likes

Every reel has an anonymous heart button (reels archive, homepage "More Reels", and
each reel page), powered by `likes.js` and two endpoints in `server.js`
(`GET /api/likes`, `POST /api/likes/:slug`).

- Only counters are stored, in `$DATA_DIR/likes.json` — no personal data. A visitor's
  own hearts live in their browser's `localStorage`.
- Anti-spam is in memory: 30 requests/minute per IP, and one active like per IP per
  reel while the server is up.
- **Set `DATA_DIR` to a persistent volume.** On Railway the container filesystem is
  wiped on every deploy, so without a volume the counts reset on each push. Add a
  Volume (e.g. mounted at `/data`) and set `DATA_DIR=/data`.
- Any `<button class="like-btn" data-like="reel-slug">` is wired up automatically; the
  slug must match a reel in `reels.json` (or `sky-runway`).

---

## Development

### Local setup

```bash
git clone https://github.com/lenekita/irreallab-site.git
cd irreallab-site
npm install
ADMIN_USER=youruser ADMIN_PASSWORD=yourpassword npm start
```

Requires `ffmpeg`/`ffprobe` on `PATH` for `npm run build:reels` (video compression,
posters, and audio extraction on upload).

### Deploy

The site runs as a Node/Express app in a Docker container (see `Dockerfile`), deployed
on Railway. `server.js` serves the static files, rewrites extensionless URLs
(`/about` → `about.html`), and exposes the reel-management API. Configure
`ADMIN_USER`/`ADMIN_PASSWORD` as environment variables on the host.

---

## Technologies

- **Frontend:** HTML5, CSS3, vanilla JavaScript — no framework
- **Backend:** Node.js + Express (`server.js`), Multer for uploads, `ffmpeg`/`ffprobe`
  for video processing
- **Data:** `reels.json`
- **Deployment:** Docker container on Railway

---

## Configuration

- **Theme:** dark mode with neon-lime accents (`#d4f03a`)
- **Fonts:** Bebas Neue (headings), Space Mono (body), Cormorant Garamond (italic copy)
- **Domain:** irreallab.fr
- **i18n:** English (default), French, Romanian — `translations/*.json`, wired via
  `language-switcher.js` (`data-translate="key.path"` on any element, including
  `<title>` and `<meta>` tags)
- **Analytics:** Google Analytics 4 (`G-628Q19EM44`) and Microsoft Clarity (`wr62xdtgob`). Cookie consent is handled by CookieHub:
  GA4 uses Consent Mode (everything `denied` until accepted); Clarity is only loaded after the visitor accepts the
  *analytics* category (`window.irreallabLoadClarity()` called from CookieHub's `onAllow`). Both snippets live in the
  `<head>` of every page and in `lib/site.js` (template of the reel pages) — change them in both places.

### Instagram statistics (admin → Statistics)

The admin panel's **Statistics** tab shows Instagram followers, views, likes, comments, shares, saves, reach and
average watch time (totals, evolution curve and one row per reel, next to the site's own hearts).

- **Source:** the official *Instagram API with Instagram Login* (`lib/instagram.js`). The account must be a
  Professional (Creator/Business) account.
- **Setup:** create an app on developers.facebook.com → Instagram → *API setup with Instagram login* → add the
  account as a tester → *Generate token* (`instagram_business_basic`, `instagram_business_manage_insights`) → set
  `INSTAGRAM_ACCESS_TOKEN` in Railway and redeploy. Without it the tab shows the setup steps and nothing breaks.
- **Sync (two tiers, to stay far below Instagram's rate limit):**
  - *light*, every 10 min (`INSTAGRAM_LIGHT_MINUTES`, min 5): followers, likes, comments — about 3 API calls;
  - *full*, every 60 min (`INSTAGRAM_SYNC_MINUTES`, min 15): also views, reach, saves, shares, watch time for posts
    younger than 30 days (older posts at most once a day; brand-new posts are always fetched immediately).
  - plus the **Refresh** button (full sync, limited to 1/min). The admin page re-reads the cached numbers every minute
    while the Statistics tab is open. Instagram itself delays views/reach by minutes to hours and has no push
    notification for likes or views, so this is as close to "live" as the official API allows.
  Latest snapshot and one point per day (history, 400 days) are stored in `$DATA_DIR/instagram-stats.json`.
- **Hourly graph + last-hour recap:** every sync also records a point in `$DATA_DIR/instagram-points.json`
  (all points kept for 26 h with per-post numbers, then one point per hour for 14 days). The Statistics tab shows a
  *Last hour* text recap (follower/view/like/comment/share/save gains, then the posts that moved, by title) and a
  chart switchable between Hourly/Daily and Gain/Total for each metric. Instagram does not expose past hours, so the
  hourly history starts at the first sync after deployment. Views/reach only change on the hourly *full* sync.
- **Token:** long-lived tokens last 60 days; the server renews them (after 30 days) and keeps the renewed token in
  `$DATA_DIR/instagram-token.json`. If you paste a new `INSTAGRAM_ACCESS_TOKEN`, it takes over automatically.
- **Reel matching:** by the Instagram link stored on each reel (`url`, edit it in the admin if it is only the profile
  link); fallback: the reel title found in exactly one post caption. Unmatched posts are listed separately.
- **API:** `GET /api/instagram-stats`, `POST /api/instagram-stats/refresh` (both admin-only).
- **Optional env:** `INSTAGRAM_API_VERSION` (default `v23.0`).

### Audio

- Homepage background track: `audio/carbune-cobza.mp3` (looped, toggled by the visible
  sound button, with a smooth fade in/out; the mute preference persists in
  `localStorage`).
- Per-reel hover audio: `audio/reel-N.mp3`, referenced by each reel's `audio_url` in
  `reels.json`.
- See `credits.html` for music attribution.

---

## License

All original artwork © irreallab. All rights reserved.

Music used across the site is credited on the [Credits page](https://irreallab.fr/credits.html).

---

## Contact

For inquiries, visit the [contact page](https://irreallab.fr/contact.html) or reach out
on Instagram [@irreallab](https://www.instagram.com/irreallab/).

## Shop (merch)

`shop.html` is the merch page (four tees, "coming soon" for now). Product images live in `images/merch/`. To put a tee on sale, paste its store link and price into the `SHOP` block at the bottom of `shop.html`; the card switches from "Notify me" to "Buy" automatically. Texts are translated in `translations/*.json` under `shop.*`. The print-ready logo, artwork and mockup files are kept outside the repo, in `~/Desktop/irreallab-merch/` (see its README).
