const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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

// API Routes (must be before static middleware)
// Upload endpoint
app.post('/api/upload-reel', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, hashtags, url } = req.body;

    if (!title || !hashtags) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Title and hashtags are required' });
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
    const audioPath = path.join(audioDir, audioFilename);

    // Move uploaded file to video directory
    fs.renameSync(req.file.path, videoPath);

    // Extract audio from video
    const audioExtracted = extractAudio(videoPath, audioPath);

    // Create new reel object
    const newReel = {
      title: title.trim(),
      subtitle: '@irreallab · Watch on Instagram',
      url: url || 'https://www.instagram.com/irreallab/',
      hashtags: hashtags.trim(),
      status: 'Live',
      video_url: `/video/${videoFilename}`,
      posted_at: new Date().toISOString()
    };

    // Add audio_url if extraction was successful
    if (audioExtracted) {
      newReel.audio_url = `/audio/${audioFilename}`;
    }

    // Add new reel to the beginning of the array (most recent first)
    reels.unshift(newReel);

    // Save updated reels.json
    fs.writeFileSync(reelsPath, JSON.stringify(reels, null, 2));

    res.json({
      success: true,
      message: `Reel uploaded and published successfully${audioExtracted ? ' with audio' : ''}`,
      reel: newReel
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

// Get all reels
app.get('/api/reels', (req, res) => {
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
