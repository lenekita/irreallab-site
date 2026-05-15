#!/usr/bin/env node

/**
 * scripts/sync-instagram.js
 * 
 * Syncs Instagram reels from @irreallab to reels.json
 * No authentication needed - reads public Instagram profile
 * Run with: node scripts/sync-instagram.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REELS_FILE = path.join(__dirname, '../reels.json');
const USERNAME = 'irreallab';

console.log(`\n🎬 === INSTAGRAM REELS SYNC ===`);
console.log(`📍 Username: @${USERNAME}`);
console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchInstagramProfile() {
  try {
    console.log(`🔍 Fetching @${USERNAME} Instagram profile...\n`);
    
    // Fetch public Instagram profile page
    const html = await fetchUrl(`https://www.instagram.com/${USERNAME}/`);
    
    // Extract JSON data embedded in the page
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    if (!match) {
      throw new Error('Could not find profile data on Instagram');
    }
    
    const profileData = JSON.parse(match[1]);
    return profileData;
  } catch (error) {
    console.error('❌ Error fetching profile:', error.message);
    throw error;
  }
}

async function extractReels(profileData) {
  try {
    const reels = [];
    
    // Extract posts/reels from profile data
    if (profileData.itemListElement && Array.isArray(profileData.itemListElement)) {
      console.log(`📊 Found ${profileData.itemListElement.length} posts`);
      
      for (let i = 0; i < Math.min(profileData.itemListElement.length, 50); i++) {
        const item = profileData.itemListElement[i];
        const reel = {
          title: item.name || `Reel ${reels.length + 1}`,
          subtitle: '@irreallab · Watch on Instagram',
          url: item.url || `https://www.instagram.com/p/${item.identifier}/`,
          hashtags: extractHashtags(item.description),
          status: 'Live',
          video_url: item.image || '',
          thumbnail_url: item.image || '',
          posted_at: item.datePublished || new Date().toISOString(),
          order: reels.length + 1
        };
        
        reels.push(reel);
        console.log(`✓ ${reels.length}. "${reel.title.substring(0, 40)}..."`);
      }
    }
    
    return reels;
  } catch (error) {
    console.error('❌ Error extracting reels:', error.message);
    throw error;
  }
}

function extractHashtags(text) {
  if (!text) return '';
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags.slice(0, 10).join(' ');
}

function saveReelsFile(reels) {
  try {
    fs.writeFileSync(REELS_FILE, JSON.stringify(reels, null, 2), 'utf8');
    console.log(`\n💾 Saved ${reels.length} reels to reels.json`);
    console.log(`📍 File: ${REELS_FILE}`);
    console.log(`✨ Sync complete!\n`);
    return true;
  } catch (error) {
    console.error('❌ Error saving file:', error.message);
    throw error;
  }
}

async function sync() {
  try {
    const profileData = await fetchInstagramProfile();
    const reels = await extractReels(profileData);
    
    if (reels.length === 0) {
      console.warn('⚠️ No reels found');
      console.log('Make sure @irreallab account is public\n');
      process.exit(1);
    }
    
    saveReelsFile(reels);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error('\nMake sure:');
    console.error('  • @irreallab account is PUBLIC (not private)');
    console.error('  • Instagram is accessible');
    console.error('  • Try again in a few minutes\n');
    process.exit(1);
  }
}

sync();
