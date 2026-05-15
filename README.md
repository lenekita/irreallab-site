# irreallab

A platform for surreal visual experiments in short-form video. Motion, surrealism & the art of the unreal.

**Website:** [irreallab.fr](https://irreallab.fr)  
**Instagram:** [@irreallab](https://www.instagram.com/irreallab/)

---

## Overview

irreallab showcases curated surreal visual reels with synchronized audio, direct video playback, and immersive design. Each reel is pulled from Instagram and displayed with custom audio overlays and cinematic presentation.

---

## Features

✨ **Audio-Synced Reels** — Hover over any reel to play synchronized audio  
🎬 **Direct Video Playback** — High-quality video players with custom thumbnails  
🎨 **Surreal Design** — Dark theme with neon accents and smooth animations  
📱 **Responsive Layout** — Optimized for desktop and mobile viewing  
⚡ **Fast Loading** — Lightweight, no external dependencies  

---

## Project Structure

```
/
├── index.html              # Landing page
├── main.html               # Main content hub
├── reels.html              # Reels gallery with audio sync
├── contact.html            # Contact page
├── reels.json              # Reel data (title, video URL, audio, etc.)
├── reels-audio-sync.js     # Audio sync functionality on hover
├── animations2.js          # Smooth animations and transitions
├── package.json            # Project dependencies
├── scripts/                # Backend utilities
│   └── sync-instagram.js   # GitHub Actions script for syncing new reels
├── .github/workflows/      # GitHub Actions automation
│   └── sync-instagram-reels.yml
├── logo.png, favicon.ico   # Branding assets
├── *.mp3, *.mp4            # Media files
└── robots.txt, sitemap.xml # SEO files
```

---

## Reel Data Format

Each reel in `reels.json` contains:

```json
{
  "title": "Reel Title",
  "subtitle": "@irreallab · Watch on Instagram",
  "url": "https://www.instagram.com/reel/...",
  "hashtags": "#surreal #visual #art",
  "status": "Live",
  "video_url": "https://scontent-cdg.../video.mp4",
  "thumbnail_url": "https://scontent-cdg.../thumbnail.jpg",
  "audio_url": "/audio-file.mp3",
  "posted_at": "2026-05-15T00:00:00.000Z"
}
```

---

## How It Works

### Audio Sync
`reels-audio-sync.js` automatically:
- Plays audio when you hover over a reel
- Stops and fades audio when you move away
- Syncs audio with video playback time

### Direct Video Playback
Videos embed as native `<video>` elements with:
- Custom poster thumbnails from Instagram
- Built-in hover controls
- Smooth loading from CDN

---

## Development

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/lenekita/irreallab-site.git
cd irreallab-site
```

2. Open in a browser:
```bash
open index.html
# or serve with a local server
npx http-server
```

### Adding New Reels

1. Extract the video URL from Instagram (see Instagram Graph API method below)
2. Update `reels.json` with the new reel data
3. Add the audio file (if different from existing)
4. Commit and push to deploy

### Deploy

Changes pushed to `main` automatically deploy to **irreallab.fr** via GitHub Pages.

```bash
git add .
git commit -m "Add new reel: [Title]"
git push origin main
```

---

## GitHub Actions (Optional)

The `.github/workflows/sync-instagram-reels.yml` workflow can automatically sync new reels from Instagram. To enable:

1. Set up Instagram Graph API credentials
2. Add `INSTAGRAM_TOKEN` and `INSTAGRAM_BUSINESS_ACCOUNT_ID` as GitHub secrets
3. Workflow runs daily at 2 AM UTC and pulls new reels automatically

---

## Technologies

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Data:** JSON
- **Deployment:** GitHub Pages
- **Media:** Instagram CDN for videos & thumbnails

---

## Configuration

### Site Settings
- **Theme:** Dark mode with neon lime accents (`#d4f03a`)
- **Fonts:** Bebas Neue (headings), Space Mono (body)
- **Domain:** irreallab.fr (via CNAME)

### Audio Files
All audio files are stored in the repo root and referenced in `reels.json`:
- `carved-origins.mp3`
- `chasing-speed.mp3`
- `closing-hours.mp3`
- `frame-shift.mp3`
- `art-heist.mp3`
- `drifting-through.mp3`
- `velvet-circuit.mp3`

---

## License

All original artwork and audio © irreallab. All rights reserved.

---

## Contact

For inquiries, visit the contact page or reach out on Instagram [@irreallab](https://www.instagram.com/irreallab/)
