const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const https = require('https');

const app = express();
// Railway (and Cloudflare) sit in front of the app; needed for the real client IP.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const videosDir = path.join(__dirname, 'video');
const audioDir = path.join(__dirname, 'audio');
const uploadsDir = path.join(__dirname, 'uploads');

[videosDir, audioDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
    cb(null, `reel-${timestamp}-${originalName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (safe for Cloudflare on Railway)
  }
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

function createAdminSession(res) {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, Date.now() + SESSION_TTL_MS);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
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

app.post('/api/admin/login', express.json(), (req, res) => {
  const { id, password } = req.body || {};
  if (!ADMIN_USER || !ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin login is not configured on this server' });
  }
  const idOk = timingSafeEqualStr(id || '', ADMIN_USER);
  const passOk = timingSafeEqualStr(password || '', ADMIN_PASSWORD);
  if (idOk && passOk) {
    createAdminSession(res);
    return res.json({ success: true });
  }
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

// Helper function to find next reel number
function getNextReelNumber() {
  try {
    const files = fs.readdirSync(videosDir);
    const reelNumbers = files
      .filter(f => f.match(/^reel-\d+\.mp4$/))
      .map(f => parseInt(f.match(/\d+/)[0]))
      .sort((a, b) => b - a);

    return reelNumbers.length > 0 ? reelNumbers[0] + 1 : 1;
  } catch (e) {
    return 1;
  }
}

// Helper function to calculate file hash
function calculateFileHash(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Helper function to check for duplicate videos
async function checkDuplicateVideo(videoPath) {
  try {
    const reelsPath = path.join(__dirname, 'reels.json');
    if (!fs.existsSync(reelsPath)) return false;

    const reels = JSON.parse(fs.readFileSync(reelsPath, 'utf8'));
    const newHash = await calculateFileHash(videoPath);

    for (const reel of reels) {
      if (reel.video_url) {
        const existingPath = path.join(__dirname, reel.video_url);
        if (fs.existsSync(existingPath)) {
          const existingHash = await calculateFileHash(existingPath);
          if (existingHash === newHash) {
            return true; // Duplicate found
          }
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Duplicate check error:', error.message);
    return false;
  }
}

// Helper function to extract audio from video
function extractAudio(videoPath, audioPath) {
  try {
    // Use ffmpeg to extract audio as MP3
    execSync(`ffmpeg -i "${videoPath}" -q:a 9 -n "${audioPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch (error) {
    console.error('Audio extraction error:', error.message);
    return false;
  }
}

// Helper function to compress video
function compressVideo(inputPath, outputPath) {
  try {
    // Compress video using ffmpeg with H.264 codec
    execSync(`ffmpeg -i "${inputPath}" -c:v libx264 -crf 28 -preset medium -c:a aac -b:a 128k -n "${outputPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch (error) {
    console.error('Video compression error:', error.message);
    return false;
  }
}

// Helper function to fetch Instagram metadata from URL
async function fetchInstagramMetadata(igUrl) {
  return new Promise((resolve) => {
    if (!igUrl || !igUrl.includes('instagram.com')) {
      resolve({ success: false });
      return;
    }

    // Extract post/reel ID from various Instagram URL formats
    // Supports: /p/ID, /reel/ID, /reels/ID, /tv/ID
    let postId = null;
    const postMatch = igUrl.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      postId = postMatch[1];
    } else {
      resolve({ success: false });
      return;
    }

    // Try to fetch metadata from Instagram's embed API
    const embedUrl = `https://www.instagram.com/p/${postId}/embed/captioned/`;

    const options = {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    https.get(embedUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Try multiple patterns to extract caption
          let caption = '';

          // Pattern 1: "caption":"..."
          const captionMatch1 = data.match(/"caption":"([^"]*(?:\\.[^"]*)*?)"/);
          if (captionMatch1) {
            caption = captionMatch1[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }

          // Pattern 2: caption from script tags
          if (!caption) {
            const scriptMatch = data.match(/"caption":\s*"([^"]+)"/);
            if (scriptMatch) {
              caption = scriptMatch[1];
            }
          }

          // Extract hashtags from caption
          const hashtags = (caption.match(/#\w+/g) || []).join('\n');

          if (caption || hashtags) {
            resolve({
              success: true,
              caption: caption,
              hashtags: hashtags
            });
          } else {
            resolve({ success: false });
          }
        } catch (e) {
          console.error('Parse error:', e.message);
          resolve({ success: false });
        }
      });
    }).on('error', (err) => {
      console.error('Fetch error:', err.message);
      resolve({ success: false });
    });
  });
}

// API Routes (must be before static middleware)
// Upload endpoint
app.post('/api/upload-reel', requireAdmin, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, hashtags, url, scheduledDate, position } = req.body;

    if (!title || !hashtags) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Title and hashtags are required' });
    }

    // Validate position if provided
    let insertPosition = 0; // Default to beginning
    if (position !== undefined && position !== null) {
      const pos = parseInt(position);
      if (!isNaN(pos) && pos >= 0) {
        insertPosition = pos;
      }
    }

    // Check for duplicate video
    const isDuplicate = await checkDuplicateVideo(req.file.path);
    if (isDuplicate) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'This video already exists in your library' });
    }

    // Read existing reels
    const reelsPath = path.join(__dirname, 'reels.json');
    let reels = [];

    if (fs.existsSync(reelsPath)) {
      try {
        reels = JSON.parse(fs.readFileSync(reelsPath, 'utf8'));
      } catch (e) {
        reels = [];
      }
    }

    // Get next reel number
    const nextReelNum = getNextReelNumber();
    const videoFilename = `reel-${nextReelNum}.mp4`;
    const audioFilename = `reel-${nextReelNum}.mp3`;
    const videoPath = path.join(videosDir, videoFilename);
    const compressedVideoPath = path.join(videosDir, `reel-${nextReelNum}-temp.mp4`);
    const audioPath = path.join(audioDir, audioFilename);

    // Move uploaded file to temp location
    fs.renameSync(req.file.path, compressedVideoPath);

    // Always compress video for consistency and smaller file size
    const stats = fs.statSync(compressedVideoPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    console.log(`Compressing video (${fileSizeMB.toFixed(2)}MB)...`);
    const compressionSuccess = compressVideo(compressedVideoPath, videoPath);

    let finalVideoPath = videoPath;
    if (compressionSuccess) {
      // Compression succeeded, use compressed version
      fs.unlinkSync(compressedVideoPath);
      const compressedStats = fs.statSync(videoPath);
      const compressedMB = compressedStats.size / (1024 * 1024);
      console.log(`✓ Compressed: ${fileSizeMB.toFixed(2)}MB → ${compressedMB.toFixed(2)}MB`);
    } else {
      // If compression fails, still use the original but rename it
      console.log(`⚠ Compression failed, using original`);
      fs.renameSync(compressedVideoPath, videoPath);
    }

    // Extract audio from video
    const audioExtracted = extractAudio(finalVideoPath, audioPath);

    // Create new reel object
    const newReel = {
      title: title.trim(),
      subtitle: '@irreallab · Watch on Instagram',
      url: url || 'https://www.instagram.com/irreallab/',
      hashtags: hashtags.trim(),
      status: scheduledDate ? 'Scheduled' : 'Live',
      video_url: `/video/${videoFilename}`,
      posted_at: new Date().toISOString()
    };

    // Add scheduled publish time if provided
    if (scheduledDate) {
      newReel.scheduled_publish_at = scheduledDate;
    }

    // Add audio_url if extraction was successful
    if (audioExtracted) {
      newReel.audio_url = `/audio/${audioFilename}`;
    }

    // Insert reel at specified position
    if (insertPosition >= reels.length) {
      // If position is beyond array length, add at end
      reels.push(newReel);
    } else {
      // Insert at specified position
      reels.splice(insertPosition, 0, newReel);
    }

    // Save updated reels.json
    fs.writeFileSync(reelsPath, JSON.stringify(reels, null, 2));

    res.json({
      success: true,
      message: `Reel uploaded ${scheduledDate ? 'and scheduled' : 'and published'} at position #${insertPosition + 1}${audioExtracted ? ' with audio' : ''}`,
      reel: newReel,
      videoSize: fileSizeMB.toFixed(2),
      position: insertPosition + 1
    });

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Upload error:', error);
    res.status(500).json({
      error: error.message || 'Error uploading reel'
    });
  }
});

// Fetch Instagram metadata
app.post('/api/fetch-instagram-metadata', requireAdmin, express.json(), async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Instagram URL required' });
    }

    const metadata = await fetchInstagramMetadata(url);

    if (metadata.success) {
      res.json({
        success: true,
        caption: metadata.caption,
        hashtags: metadata.hashtags
      });
    } else {
      res.status(400).json({ error: 'Could not fetch metadata from Instagram URL' });
    }
  } catch (error) {
    console.error('Instagram fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Edit reel metadata
app.put('/api/reel/:index', requireAdmin, express.json(), (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const { title, hashtags, url } = req.body;
    const reelsPath = path.join(__dirname, 'reels.json');

    if (!fs.existsSync(reelsPath)) {
      return res.status(404).json({ error: 'Reels file not found' });
    }

    let reels = JSON.parse(fs.readFileSync(reelsPath, 'utf8'));

    if (index < 0 || index >= reels.length) {
      return res.status(400).json({ error: 'Invalid reel index' });
    }

    // Update reel metadata
    if (title) reels[index].title = title.trim();
    if (hashtags) reels[index].hashtags = hashtags.trim();
    if (url) reels[index].url = url.trim();

    fs.writeFileSync(reelsPath, JSON.stringify(reels, null, 2));

    res.json({
      success: true,
      message: 'Reel updated successfully',
      reel: reels[index]
    });
  } catch (error) {
    console.error('Edit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all reels (filtered by scheduled publish time for public view)
app.get('/api/reels', (req, res) => {
  try {
    const reelsPath = path.join(__dirname, 'reels.json');
    if (!fs.existsSync(reelsPath)) {
      return res.json([]);
    }
    let reels = JSON.parse(fs.readFileSync(reelsPath, 'utf8'));

    // Filter out scheduled reels that haven't been published yet
    const now = new Date();
    reels = reels.filter(reel => {
      if (reel.scheduled_publish_at) {
        const scheduledTime = new Date(reel.scheduled_publish_at);
        return scheduledTime <= now;
      }
      return true;
    });

    res.json(reels);
  } catch (error) {
    res.status(500).json({ error: 'Error reading reels' });
  }
});

// Get all reels (admin - includes scheduled)
app.get('/api/reels-admin', requireAdmin, (req, res) => {
  try {
    const reelsPath = path.join(__dirname, 'reels.json');
    if (!fs.existsSync(reelsPath)) {
      return res.json([]);
    }
    const reels = JSON.parse(fs.readFileSync(reelsPath, 'utf8'));
    res.json(reels);
  } catch (error) {
    res.status(500).json({ error: 'Error reading reels' });
  }
});

// Delete a reel by index
app.delete('/api/reel/:index', requireAdmin, (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const reelsPath = path.join(__dirname, 'reels.json');

    if (!fs.existsSync(reelsPath)) {
      return res.status(404).json({ error: 'Reels file not found' });
    }

    let reels = JSON.parse(fs.readFileSync(reelsPath, 'utf8'));

    if (index < 0 || index >= reels.length) {
      return res.status(400).json({ error: 'Invalid reel index' });
    }

    const reel = reels[index];

    // Delete video file
    if (reel.video_url) {
      const videoFile = path.join(__dirname, reel.video_url);
      if (fs.existsSync(videoFile)) {
        fs.unlinkSync(videoFile);
      }
    }

    // Delete audio file
    if (reel.audio_url) {
      const audioFile = path.join(__dirname, reel.audio_url);
      if (fs.existsSync(audioFile)) {
        fs.unlinkSync(audioFile);
      }
    }

    reels.splice(index, 1);
    fs.writeFileSync(reelsPath, JSON.stringify(reels, null, 2));

    res.json({
      success: true,
      message: 'Reel deleted successfully',
      remainingReels: reels.length
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder reels
app.post('/api/reorder', requireAdmin, express.json(), (req, res) => {
  try {
    const { reels } = req.body;
    const reelsPath = path.join(__dirname, 'reels.json');

    if (!Array.isArray(reels)) {
      return res.status(400).json({ error: 'Invalid reels array' });
    }

    fs.writeFileSync(reelsPath, JSON.stringify(reels, null, 2));

    res.json({
      success: true,
      message: 'Reels reordered successfully'
    });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Reel likes — anonymous hearts. Only counters are stored (no personal data).
// Anti-spam is in-memory: a per-IP rate limit and one active like per
// IP+reel while the server is up. Set DATA_DIR to a persistent volume
// (e.g. a Railway volume) or the counts reset whenever the app redeploys.
// ---------------------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
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

function slugifyTitle(title) {
  return String(title).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let slugCache = { mtime: 0, slugs: new Set(FEATURED_SLUGS) };
function allowedSlugs() {
  try {
    const file = path.join(__dirname, 'reels.json');
    const mtime = fs.statSync(file).mtimeMs;
    if (mtime !== slugCache.mtime) {
      const reels = JSON.parse(fs.readFileSync(file, 'utf8'));
      const slugs = new Set(FEATURED_SLUGS);
      reels.forEach(r => { if (r.title && r.video_url && r.video_url.startsWith('/')) slugs.add(slugifyTitle(r.title)); });
      slugCache = { mtime, slugs };
    }
  } catch (e) { /* keep last known list */ }
  return slugCache.slugs;
}

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
  console.log(`📁 Video uploads directory: ${videosDir}`);
  console.log(`\n✨ Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`🎞️  Reels page: http://localhost:${PORT}/reels.html\n`);
});
