# How to Get Instagram Reel Video URL

Since Instagram blocks automated extraction, follow these manual steps:

## For "chasing speed." reel (https://www.instagram.com/reel/DYIP41AoQNr/)

### Step 1: Open the reel in your browser
Visit: https://www.instagram.com/reel/DYIP41AoQNr/

### Step 2: Open Developer Tools
- **Chrome/Edge**: Press `F12` or right-click → **Inspect**
- **Firefox**: Press `F12` or right-click → **Inspect Element**
- **Safari**: Enable develop menu first, then press `Cmd+Option+I`

### Step 3: Find the video tag
In the Inspector panel, look for the `<video>` tag:
```html
<video src="https://scontent-cdg..." ...></video>
```

**Quick way:**
- Press `Ctrl+F` (or `Cmd+F` on Mac) in the Inspector
- Search for: `<video src`
- Copy the entire URL between the quotes

### Step 4: The URL looks like this:
```
https://scontent-cdg4-1.cdninstagram.com/o1/v/t2/f2/m86/AQN...very-long-url...&oe=6A089609
```

### Step 5: Update reels.json
In `reels.json`, find the "chasing speed." reel and add:

```json
{
  "title": "chasing speed.",
  ...
  "video_url": "https://scontent-cdg4-1.cdninstagram.com/o1/v/t2/...",
  "thumbnail_url": "https://scontent-cdg4-1.cdninstagram.com/v/t51.71878-15/..."
}
```

---

## Need a thumbnail too?

Go to Instagram page → Right-click the reel thumbnail → **Copy image link** → Paste as `thumbnail_url`

---

## Questions?
This is the most reliable way since Instagram protects their video URLs.
