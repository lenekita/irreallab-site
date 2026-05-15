#!/usr/bin/env node

/**
 * scripts/sync-instagram.js
 * 
 * Syncs Instagram reels from @irreallab to reels.json using Instagram Graph API
 * Run with: node scripts/sync-instagram.js
 * 
 * Required environment variables:
 * - INSTAGRAM_TOKEN: Long-lived access token with instagram_basic, instagram_content_publishing
 * - INSTAGRAM_BUSINESS_ACCOUNT_ID: Business account ID (get from Graph API Explorer)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REELS_FILE = path.join(__dirname, '../reels.json');
const API_VERSION = 'v18.0';
const BASE_URL = `https://graph.instagram.com/${API_VERSION}`;

const TOKEN = process.env.INSTAGRAM_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

console.log(`\n🎬 === INSTAGRAM REELS SYNC (Graph API) ===`);
console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Error: Missing required environment variables:');
  console.error('   - INSTAGRAM_TOKEN');
  console.error('   - INSTAGRAM_BUSINESS_ACCOUNT_ID\n');
  process.exit(1);
}

function makeGraphAPIRequest(endpoint, fields = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (fields) url.searchParams.append('fields', fields);
    url.searchParams.append('access_token', TOKEN);

    const options = {
      hostname: 'graph.instagram.com',
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'irreallab-sync/1.0'
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
          if (res.statusCode >= 400) {
            console.error(`❌ API Error (${res.statusCode}):`, json.error?.message || data);
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          console.error('❌ Failed to parse API response:', data.substring(0, 200));
          reject(new Error('Invalid JSON from Instagram API'));
        }
      });
    }).on('error', reject);
  });
}

function extractHashtags(caption) {
  if (!caption) return '';
  const hashtags = caption.match(/#\w+/g) || [];
  return hashtags.join(' ');
}

function extractTitle(caption) {
  if (!caption) return 'Untitled Reel';
  
  const lines = caption.split('\n');
  const firstLine = lines[0];
  
  if (firstLine.length > 50) {
    return firstLine.substring(0, 50).trim();
  }
  return firstLine.trim();
}

async function fetchMediaDetails(mediaId) {
  try {
    const fields = 'id,media_type,caption,media_product_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count';
    const response = await makeGraphAPIRequest(`/${mediaId}`, fields);
    return response;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch details for ${mediaId}:`, error.message);
    return null;
  }
}

async function fetchInstagramReels() {
  try {
    console.log(`🔍 Fetching reels from Instagram Business Account...`);
    
    const fields = 'id,media_type,caption,media_product_type,permalink,media_url,thumbnail_url,timestamp';
    const response = await makeGraphAPIRequest(`/${ACCOUNT_ID}/media`, fields);
    
    if (!response.data) {
      console.warn('⚠️ No media data in response');
      return [];
    }

    const reels = [];
    console.log(`📊 Processing ${response.data.length} media items...`);

    for (const media of response.data) {
      try {
        // Filter for video reels only
        if (media.media_type !== 'VIDEO' && media.media_type !== 'CAROUSEL') {
          continue;
        }
        
        if (media.media_product_type !== 'REELS') {
          continue;
        }

        const reel = {
          title: extractTitle(media.caption),
          subtitle: '@irreallab · Watch on Instagram',
          url: media.permalink,
          hashtags: extractHashtags(media.caption),
          status: 'Live',
          video_url: media.media_url || '',
          thumbnail_url: media.thumbnail_url || '',
          posted_at: media.timestamp || new Date().toISOString(),
          instagram_id: media.id,
          order: reels.length + 1
        };

        reels.push(reel);
        console.log(`✓ Added: "${reel.title}"`);
      } catch (err) {
        console.warn(`⚠️ Error processing media ${media.id}:`, err.message);
      }
    }

    console.log(`✅ Extracted ${reels.length} video reels`);
    return reels;
  } catch (error) {
    console.error('❌ Error fetching Instagram reels:', error.message);
    throw error;
  }
}

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

async function syncInstagramReels() {
  try {
    const reels = await fetchInstagramReels();
    
    if (reels.length === 0) {
      console.warn('⚠️ No reels found. Checking account...');
      console.log('ℹ️  Make sure:');
      console.log('   1. Account is a Business/Creator account');
      console.log('   2. Account is publicly visible');
      console.log('   3. Token has correct permissions\n');
      process.exit(1);
    }

    saveReelsFile(reels);
    
    console.log('✨ Instagram reels sync complete!');
    console.log(`📊 Total reels: ${reels.length}`);
    console.log(`📍 File: ${REELS_FILE}`);
    console.log(`📅 Last updated: ${new Date().toISOString()}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Verify INSTAGRAM_TOKEN is valid and not expired');
    console.error('  2. Check INSTAGRAM_BUSINESS_ACCOUNT_ID is correct');
    console.error('  3. Ensure token has instagram_basic & instagram_content_publishing scopes');
    console.error('  4. Check network connection');
    console.error('  5. Instagram API may be rate-limited — try again in a few minutes\n');
    
    process.exit(1);
  }
}

syncInstagramReels();
