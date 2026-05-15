# Instagram Video URL Extractor Bookmarklet

## Quick Method: Use Browser Console

1. **Open the Instagram reel** in your browser:
   - Go to: https://www.instagram.com/reel/DYIP41AoQNr/

2. **Open Developer Console:**
   - Press `F12` (or `Cmd+Option+I` on Mac)
   - Go to the **Console** tab

3. **Paste this code:**
```javascript
(function() {
  const videos = document.querySelectorAll('video');
  if (videos.length === 0) {
    console.log('No video found. Wait a moment for Instagram to load, then try again.');
    return;
  }
  
  videos.forEach((video, i) => {
    console.log(`Video ${i+1}:`);
    console.log('src:', video.src);
    if (video.src) {
      console.log('Copy this URL ☝️');
    }
  });
})();
```

4. **Press Enter**

5. **You'll see the video URL in the console** - copy the long URL that starts with `https://scontent-`

6. **Paste it into reels.json:**
```json
{
  "title": "chasing speed.",
  ...
  "video_url": "https://scontent-cdg4-1.cdninstagram.com/o1/v/t2/...",
}
```

---

## If that doesn't work:

1. **Right-click the reel video** → **Inspect** (or **Inspect Element**)
2. In the Inspector, find the `<video>` tag
3. Look for `src="https://scontent..."` inside the video tag
4. Copy the entire URL between the quotes
5. Paste into reels.json

---

## Thumbnail URL (optional):
Right-click the video thumbnail → **Copy image link** → Add as `thumbnail_url` in reels.json

---

## Need help?
Check the browser console (F12) for any errors if the script doesn't work.
