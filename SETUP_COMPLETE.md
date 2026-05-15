# Reels Setup - What's Done ✅

## Completed Tasks

### 1. **Audio Sync is Now Working**
- ✅ All reels (2-5) now have `audio_url` pointing to `/velvet-circuit.mp3`
- ✅ Updated `reels.html` to add `data-audio-url` attributes to cards
- ✅ `reels-audio-sync.js` will automatically:
  - Play audio when you hover over a reel
  - Stop audio when you move away
  - Keep audio synced with video time
  - Fade audio in/out smoothly

**Test it:** Hover over reels 2-5 on https://irreallab.fr/reels.html - you should hear the audio!

### 2. **Direct Video Display** (Reels 2-5)
- ✅ Reels with `video_url` display as direct video players (not Instagram embeds)
- ✅ Hover to play/pause video (built into HTML `<video>` element)
- ✅ Custom poster thumbnails from Instagram

### 3. **GitHub Actions Ready** (Optional)
- ✅ Workflow file at `.github/workflows/sync-instagram-reels.yml`
- ✅ Can be triggered manually to sync new reels (when you add video URLs)
- ✅ Requires: INSTAGRAM_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID secrets

---

## What You Need to Do

### Get Video URL for Reel 1: "chasing speed."
This reel currently displays as Instagram embed (blockquote) instead of direct video player.

**Choose one method:**

#### **Method 1: Browser Console (Easiest)**
See `BOOKMARKLET.md` - paste a script into your browser console

#### **Method 2: Manual Inspector**
See `GET_VIDEO_URL.md` - step-by-step instructions

#### **Method 3: Web Tool**
Use `extract-video.html` - fill in the URL and get JSON

---

## File Structure

```
/reels.html              ← Displays all reels (audio+video working)
/reels.json              ← Data with video URLs & audio URLs
/reels-audio-sync.js     ← Audio sync on hover (auto-initialized)
/admin-lite.html         ← Form to submit new reels (no auth)
/extract-video.html      ← Tool to extract Instagram video URLs
/velvet-circuit.mp3      ← Audio file (used by all reels)
/scripts/extract-reel-video.js  ← CLI tool for extraction
/GET_VIDEO_URL.md        ← Instructions for manual extraction
/BOOKMARKLET.md          ← Browser console method
```

---

## Testing Checklist

- [ ] Visit https://irreallab.fr/reels.html
- [ ] Hover over reels 2-5 - audio should play ✓
- [ ] Hover away - audio should fade out ✓
- [ ] Reels 2-5 show video players (not Instagram embeds) ✓
- [ ] Reel 1 still shows Instagram embed (no video_url yet)
- [ ] No JavaScript errors in browser console

---

## Next Steps

1. **Extract video URL for reel 1** using one of the methods above
2. **Update reels.json** with the video_url and thumbnail_url
3. **Push to GitHub** - changes auto-deploy to site
4. **Reel 1 will now display like reels 2-5** with audio on hover!

---

## Audio Management

Currently using `velvet-circuit.mp3` for all reels. To use different audio:

1. Add audio files to repo root (e.g., `reel-2-audio.mp3`)
2. Update `reels.json` with different audio_url for each reel
3. Commit and push - site updates automatically

---

## GitHub Actions (Optional)

When you have Instagram Graph API set up:
- Edit `.github/workflows/sync-instagram-reels.yml`
- Add `INSTAGRAM_TOKEN` and `INSTAGRAM_BUSINESS_ACCOUNT_ID` secrets
- Workflow runs daily at 2 AM UTC
- Automatically pulls new reels from @irreallab and updates reels.json

See `INSTAGRAM_SYNC_SETUP.md` for detailed instructions.

---

## Questions?

All tools and guides are in the repo:
- `GET_VIDEO_URL.md` - How to extract video URLs
- `BOOKMARKLET.md` - Quick browser console method  
- `extract-video.html` - Web-based extractor
- Files are committed to `main` and deployed to https://irreallab.fr/
