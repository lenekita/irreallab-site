const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const https = require('https');

const app = express();
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
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Middleware
app.use(express.json());

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
app.post('/api/upload-reel', upload.single('video'), async (req, res) => {
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

    // Check file size and compress if needed
    const stats = fs.statSync(compressedVideoPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    let finalVideoPath = compressedVideoPath;

    if (fileSizeMB > 50) {
      console.log(`Compressing video (${fileSizeMB.toFixed(2)}MB)...`);
      const compressionSuccess = compressVideo(compressedVideoPath, videoPath);
      if (compressionSuccess) {
        fs.unlinkSync(compressedVideoPath);
        finalVideoPath = videoPath;
      } else {
        // If compression fails, use original
        fs.renameSync(compressedVideoPath, videoPath);
        finalVideoPath = videoPath;
      }
    } else {
      fs.renameSync(compressedVideoPath, videoPath);
      finalVideoPath = videoPath;
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
app.post('/api/fetch-instagram-metadata', express.json(), async (req, res) => {
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
app.put('/api/reel/:index', express.json(), (req, res) => {
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
app.get('/api/reels-admin', (req, res) => {
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
app.delete('/api/reel/:index', (req, res) => {
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
app.post('/api/reorder', express.json(), (req, res) => {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Static file serving (after API routes so routes take priority)
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\n🎬 Irreallab Server running at http://localhost:${PORT}`);
  console.log(`📁 Video uploads directory: ${videosDir}`);
  console.log(`\n✨ Admin panel: http://localhost:${PORT}/newreels.html`);
  console.log(`🎞️  Reels page: http://localhost:${PORT}/reels.html\n`);
});
