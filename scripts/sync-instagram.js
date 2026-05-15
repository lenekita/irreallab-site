#!/usr/bin/env node

/**
 * scripts/sync-instagram.js
 * 
 * Syncs Instagram reels from @irreallab to reels.json
 * Run with: node scripts/sync-instagram.js
 * 
 * This script is executed by GitHub Actions workflow automatically
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REELS_FILE = path.join(__dirname, '../reels.json');
const USERNAME = 'irreallab';

console.log(`\n🎬 === INSTAGRAM REELS SYNC ===`);
console.log(`📍 Username: @${USERNAME}`);
console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

/**
 * Fetch Instagram profile data
 */
function fetchInstagramProfile(username) {
  return new Promise((resolve, reject) => {
    const url = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
    
    console.log(`🔍 Fetching Instagram profile...`);
    
    const options = {
      hostname: 'www.instagram.com',
      path: `/${username}/?__a=1&__d=dis`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://www.instagram.com/${username}/`
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅ Successfully fetched Instagram profile');
          resolve(json);
        } catch (e) {
          console.error('❌ Failed to parse Instagram response');
          console.error('Response:', data.substring(0, 200));
          reject(new Error('Invalid JSON from Instagram'));
        }
      });
    }).on('error', (err) => {
      console.error('❌ Network error:', err.message);
      reject(err);
    });
  });
}

/**
 * Extract hashtags from caption
 */
function extractHashtags(captionEdges) {
  try {
    if (!captionEdges || captionEdges.length === 0) return '';
    
    const caption = captionEdges[0]?.node?.text || '';
    const hashtags = caption.match(/#\w+/g) || [];
    
    return hashtags.join(' ');
  } catch (error) {
    return '';
  }
}

/**
 * Extract reels from Instagram data
 */
function extractReels(instagramData) {
  try {
    const reels = [];
    const user = instagramData.graphql?.user;
    
    if (!user) {
      console.warn('⚠️ No user data found in Instagram response');
      return reels;
    }

    const posts = user.edge_owner_to_timeline_media?.edges || [];
    console.log(`📊 Found ${posts.length} posts, extracting videos...`);

    posts.forEach((edge, index) => {
      const node = edge.node;
      
      // Only include videos (reels)
      if (node.is_video) {
        const reel = {
          title: node.accessibility_caption?.substring(0, 50) || `Reel ${reels.length + 1}`,
          subtitle: '@irreallab · Watch on Instagram',
          url: `https://www.instagram.com/p/${node.shortcode}/`,
          hashtags: extractHashtags(node.edge_media_to_caption?.edges || []),
          status: 'Live',
          video_url: node.video_url || node.display_url,
          thumbnail_url: node.display_url,
          order: reels.length + 1,
          instagram_id: node.id,
          instagram_shortcode: node.shortcode,
          posted_at: new Date(node.taken_at_timestamp * 1000).toISOString()
        };
        
        reels.push(reel);
      }
    });

    console.log(`✅ Extracted ${reels.length} video reels`);
    return reels;
  } catch (error) {
    console.error('❌ Error extracting reels:', error.message);
    throw error;
  }
}

/**
 * Save reels to reels.json
 */
function saveReelsFile(reels) {
  try {
    fs.writeFileSync(REELS_FILE, JSON.stringify(reels, null, 2), 'utf8');
    console.log(`💾 Saved ${reels.length} reels to reels.json\n`);
    return true;
  } catch (error) {
    console.error('❌ Error saving reels:', error.message);
    throw error;
  }
}

/**
 * Main sync function
 */
async function syncInstagramReels() {
  try {
    // Fetch Instagram profile
    const profileData = await fetchInstagramProfile(USERNAME);
    
    // Extract reels
    const reels = extractReels(profileData);
    
    if (reels.length === 0) {
      console.warn('⚠️ No video reels found');
      console.log('ℹ️  Make sure @irreallab profile is public\n');
      process.exit(1);
    }
    
    // Save to file
    saveReelsFile(reels);
    
    console.log('✨ Instagram reels sync complete!');
    console.log(`📊 Total reels: ${reels.length}`);
    console.log(`📍 File: ${REELS_FILE}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error('\n💡 Possible solutions:');
    console.error('  1. Check @irreallab profile is public');
    console.error('  2. Wait a few minutes (rate limiting)');
    console.error('  3. Check network connection\n');
    
    process.exit(1);
  }
}

// Run sync
syncInstagramReels();
