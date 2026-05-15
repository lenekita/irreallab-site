#!/usr/bin/env node

/**
 * Extract video and thumbnail URLs from Instagram reel
 * Usage: node scripts/extract-reel-video.js <reel-url>
 * Example: node scripts/extract-reel-video.js https://www.instagram.com/reel/DYIP41AoQNr/
 */

const https = require('https');
const url = require('url');

function fetchUrl(urlString) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(urlString);
    https.get(parsedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractVideoUrl(html) {
  // Method 1: Look for video src in the page HTML
  const videoMatch = html.match(/<video[^>]*><source[^>]*src="([^"]+)"/);
  if (videoMatch) return videoMatch[1];

  // Method 2: Look for mp4 URLs in script tags
  const mp4Match = html.match(/"video_url":"([^"]*https:\/\/scontent[^"]+\.mp4[^"]*)"/);
  if (mp4Match) return mp4Match[1];

  // Method 3: Look for video URLs in data attributes
  const dataMatch = html.match(/data-video-url="([^"]+)"/);
  if (dataMatch) return dataMatch[1];

  // Method 4: Search for Instagram CDN video URLs
  const cdnMatch = html.match(/(https:\/\/scontent[^"<>\s]+\.mp4[^"<>\s]*)/);
  if (cdnMatch) return cdnMatch[1];

  return null;
}

function extractThumbnailUrl(html) {
  // Look for thumbnail/cover image
  const ogMatch = html.match(/og:image[^>]*content="([^"]+)"/);
  if (ogMatch) return ogMatch[1];

  const thumbMatch = html.match(/img[^>]*data-testid="photo"[^>]*src="([^"]+)"/);
  if (thumbMatch) return thumbMatch[1];

  return null;
}

async function extractReel(reelUrl) {
  try {
    if (!reelUrl) {
      console.error('Usage: node extract-reel-video.js <instagram-reel-url>');
      console.error('Example: node extract-reel-video.js https://www.instagram.com/reel/DYIP41AoQNr/');
      process.exit(1);
    }

    console.log('\n🎬 Extracting video from:', reelUrl);
    const html = await fetchUrl(reelUrl);

    const videoUrl = extractVideoUrl(html);
    const thumbnailUrl = extractThumbnailUrl(html);

    if (!videoUrl) {
      console.error('\n❌ Could not extract video URL from:', reelUrl);
      console.error('The Instagram reel might require login or the page structure has changed.');
      process.exit(1);
    }

    console.log('\n✅ Extracted successfully!\n');
    const result = {
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl || '',
    };

    console.log(JSON.stringify(result, null, 2));
    console.log('\n📋 Copy the JSON above and paste it into reels.json\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

const reelUrl = process.argv[2];
extractReel(reelUrl);
