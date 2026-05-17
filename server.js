const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const videosDir = path.join(__dirname, 'video');
const uploadsDir = path.join(__dirname, 'uploads');

[videosDir, uploadsDir].forEach(dir => {
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
app.use(express.static(__dirname));

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

    // Move uploaded file to video directory
    const videoFilename = `reel-${reels.length + 1}.mp4`;
    const videoPath = path.join(videosDir, videoFilename);

    fs.renameSync(req.file.path, videoPath);

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

    // Add new reel to the beginning of the array
    reels.unshift(newReel);

    // Save updated reels.json
    fs.writeFileSync(reelsPath, JSON.stringify(reels, null, 2));

    res.json({
      success: true,
      message: 'Reel uploaded and published successfully',
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`\n🎬 Irreallab Server running at http://localhost:${PORT}`);
  console.log(`📁 Video uploads directory: ${videosDir}`);
  console.log(`\n✨ Admin panel: http://localhost:${PORT}/newreels.html`);
  console.log(`🎞️  Reels page: http://localhost:${PORT}/reels.html\n`);
});
