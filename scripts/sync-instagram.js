#!/usr/bin/env node

/**
 * scripts/sync-instagram.js
 *
 * NOTE: Instagram no longer exposes public JSON data via web scraping.
 * This script is maintained as a placeholder for future API integration.
 *
 * Current workflow:
 * 1. Manually export reels from Instagram (or use third-party API like Instagrapi)
 * 2. Update reels.json with audio_url and posted_at fields
 * 3. Commit to version control
 *
 * To manually add reels:
 *   - Open https://instagram.com/irreallab
 *   - Add entries to reels.json with: title, video_url, thumbnail_url,
 *     audio_url (local file path), and other metadata
 *
 * Alternative: Use Instagrapi (Python library) or instagram-web-api for automated sync
 */

const fs = require('fs');
const path = require('path');

const REELS_FILE = path.join(__dirname, '../reels.json');
const USERNAME = 'irreallab';

console.log(`\n🎬 === INSTAGRAM REELS SYNC ===`);
console.log(`📍 Username: @${USERNAME}`);
console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

function loadExistingReels() {
  try {
    const data = fs.readFileSync(REELS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️ Could not load existing reels.json');
    return [];
  }
}

function validateReels(reels) {
  const requiredFields = ['title', 'url', 'video_url', 'thumbnail_url', 'audio_url', 'posted_at'];
  const missingFields = [];

  reels.forEach((reel, index) => {
    requiredFields.forEach(field => {
      if (!reel[field]) {
        missingFields.push(`Reel ${index + 1} (${reel.title}): missing "${field}"`);
      }
    });
  });

  return missingFields;
}

function sync() {
  console.log(`📋 Validating reels.json...\n`);

  const reels = loadExistingReels();

  if (reels.length === 0) {
    console.warn('⚠️ No reels found in reels.json');
    console.log('To add reels manually:');
    console.log('  1. Visit https://instagram.com/irreallab');
    console.log('  2. Add entries to reels.json with required fields');
    console.log('  3. Ensure each reel has an audio_url field (e.g., "/song-name.mp3")');
    console.log('  4. Commit changes to git\n');
    process.exit(1);
  }

  const missingFields = validateReels(reels);

  if (missingFields.length > 0) {
    console.error('❌ Validation errors found:\n');
    missingFields.forEach(msg => console.error(`  • ${msg}`));
    console.log('\nFix the errors above and try again.\n');
    process.exit(1);
  }

  console.log(`✅ Validation passed!`);
  console.log(`📊 Found ${reels.length} reels\n`);
  reels.forEach((reel, idx) => {
    console.log(`  ${idx + 1}. "${reel.title}" (${reel.audio_url})`);
  });

  console.log(`\n✨ reels.json is valid and ready to use!\n`);
  process.exit(0);
}

sync();
