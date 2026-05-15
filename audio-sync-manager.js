// audio-sync-manager.js
// Manage audio playback synchronized with hover state

export class AudioSyncManager {
  constructor() {
    this.audioElements = new Map(); // docId -> audio element
    this.hoveredReelId = null;
    this.playbackState = new Map(); // docId -> { playing, currentTime }
  }

  // Register an audio element for a reel
  registerAudio(reelId, audioElement) {
    if (!audioElement) return;
    
    this.audioElements.set(reelId, audioElement);
    
    // Track playback state
    audioElement.addEventListener("play", () => {
      this.playbackState.set(reelId, { 
        playing: true, 
        currentTime: audioElement.currentTime 
      });
    });
    
    audioElement.addEventListener("pause", () => {
      this.playbackState.set(reelId, { 
        playing: false, 
        currentTime: audioElement.currentTime 
      });
    });
    
    audioElement.addEventListener("timeupdate", () => {
      if (this.playbackState.has(reelId)) {
        const state = this.playbackState.get(reelId);
        state.currentTime = audioElement.currentTime;
      }
    });
  }

  // Handle hover start - play audio
  onReelHover(reelId) {
    // Stop all other audio
    this.stopAllExcept(reelId);
    
    this.hoveredReelId = reelId;
    const audioElement = this.audioElements.get(reelId);
    
    if (audioElement) {
      audioElement.currentTime = 0; // Restart from beginning
      audioElement.play().catch(err => {
        console.warn(`Could not play audio for reel ${reelId}:`, err);
      });
    }
  }

  // Handle hover end - stop audio with fade
  onReelHoverEnd(reelId) {
    if (this.hoveredReelId !== reelId) return;
    
    this.hoveredReelId = null;
    const audioElement = this.audioElements.get(reelId);
    
    if (audioElement) {
      this.fadeOutAudio(audioElement, 300); // 300ms fade
    }
  }

  // Stop all audio except specified reel
  stopAllExcept(excludeReelId) {
    this.audioElements.forEach((audioElement, reelId) => {
      if (reelId !== excludeReelId && !audioElement.paused) {
        this.fadeOutAudio(audioElement, 100);
      }
    });
  }

  // Fade out audio smoothly
  fadeOutAudio(audioElement, duration = 300) {
    if (!audioElement) return;
    
    const startVolume = audioElement.volume;
    const startTime = Date.now();
    
    const fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      audioElement.volume = startVolume * (1 - progress);
      
      if (progress >= 1) {
        clearInterval(fadeInterval);
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = startVolume;
      }
    }, 16); // ~60fps
  }

  // Sync audio playback rate with video
  syncPlaybackRate(reelId, videoPlaybackRate) {
    const audioElement = this.audioElements.get(reelId);
    if (audioElement) {
      audioElement.playbackRate = videoPlaybackRate;
    }
  }

  // Sync audio time with video
  syncAudioTime(reelId, videoCurrentTime) {
    const audioElement = this.audioElements.get(reelId);
    if (audioElement && Math.abs(audioElement.currentTime - videoCurrentTime) > 0.1) {
      audioElement.currentTime = videoCurrentTime;
    }
  }

  // Get playback state for a reel
  getPlaybackState(reelId) {
    return this.playbackState.get(reelId) || { playing: false, currentTime: 0 };
  }

  // Get currently hovered reel
  getHoveredReelId() {
    return this.hoveredReelId;
  }

  // Cleanup
  destroy() {
    this.stopAllExcept(null);
    this.audioElements.clear();
    this.playbackState.clear();
  }
}

// Create singleton instance
export const audioSyncManager = new AudioSyncManager();
