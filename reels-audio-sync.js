// reels-audio-sync.js
// Syncs audio playback with video hover on the reels page

class ReelsAudioManager {
  constructor() {
    this.audioElements = new Map(); // DOM element -> audio element
    this.hoveredCard = null;
    this.currentAudio = null;
    this.fadeSpeed = 300; // milliseconds
  }

  /**
   * Initialize audio for a reel card
   * @param {HTMLElement} cardElement - The .card element
   * @param {string} audioUrl - URL to audio file
   */
  initCard(cardElement, audioUrl) {
    if (!audioUrl) return; // Skip if no audio URL

    // Create audio element
    const audio = document.createElement('audio');
    audio.src = audioUrl;
    audio.style.display = 'none';
    document.body.appendChild(audio);

    // Store reference
    this.audioElements.set(cardElement, audio);

    // Add hover listeners
    cardElement.addEventListener('mouseenter', () => this.onCardHover(cardElement));
    cardElement.addEventListener('mouseleave', () => this.onCardHoverEnd(cardElement));

    // Sync video with audio if video exists
    const video = cardElement.querySelector('video');
    if (video) {
      video.addEventListener('timeupdate', () => this.syncAudio(cardElement, video));
    }
  }

  /**
   * Handle card hover start
   */
  onCardHover(cardElement) {
    // Stop previous audio
    if (this.currentAudio && this.currentAudio !== this.audioElements.get(cardElement)) {
      this.fadeOutAudio(this.currentAudio);
    }

    this.hoveredCard = cardElement;
    const audio = this.audioElements.get(cardElement);
    const video = cardElement.querySelector('video');

    if (audio && video) {
      // Reset audio to start
      audio.currentTime = 0;
      
      // Fade in and play
      this.fadeInAudio(audio);
      
      // Also play video
      video.play().catch(() => {});
      
      this.currentAudio = audio;
    }
  }

  /**
   * Handle card hover end
   */
  onCardHoverEnd(cardElement) {
    if (this.hoveredCard !== cardElement) return;

    this.hoveredCard = null;
    const audio = this.audioElements.get(cardElement);
    const video = cardElement.querySelector('video');

    if (audio) {
      // Fade out with smooth transition
      this.fadeOutAudio(audio);
    }

    if (video) {
      // Pause video smoothly
      video.pause();
    }
  }

  /**
   * Fade in audio
   */
  fadeInAudio(audio) {
    audio.volume = 0;
    audio.play().catch(() => {});

    const startTime = Date.now();
    const targetVolume = 0.7; // Max volume

    const fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.fadeSpeed, 1);

      audio.volume = targetVolume * progress;

      if (progress >= 1) {
        clearInterval(fadeInterval);
        audio.volume = targetVolume;
      }
    }, 16); // ~60fps
  }

  /**
   * Fade out audio
   */
  fadeOutAudio(audio) {
    if (!audio) return;

    const startTime = Date.now();
    const startVolume = audio.volume;

    const fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.fadeSpeed, 1);

      audio.volume = startVolume * (1 - progress);

      if (progress >= 1) {
        clearInterval(fadeInterval);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
      }
    }, 16);
  }

  /**
   * Keep audio time synced with video
   */
  syncAudio(cardElement, video) {
    const audio = this.audioElements.get(cardElement);
    if (!audio || !this.hoveredCard) return;

    // Only sync if audio is playing
    if (!audio.paused) {
      // If out of sync by more than 100ms, resync
      if (Math.abs(audio.currentTime - video.currentTime) > 0.1) {
        audio.currentTime = video.currentTime;
      }
    }
  }

  /**
   * Cleanup all audio elements
   */
  destroy() {
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.parentNode?.removeChild(audio);
    });
    this.audioElements.clear();
  }
}

// Create global instance
window.reelsAudioManager = new ReelsAudioManager();

/**
 * Initialize audio for all reel cards
 * Call this after reels are rendered to the DOM
 */
window.initializeReelsAudio = function(audioUrlMap) {
  /**
   * audioUrlMap should be an object mapping reel titles to audio URLs:
   * {
   *   "Closing Hours": "https://example.com/audio1.mp3",
   *   "Frame Shift": "https://example.com/audio2.mp3",
   *   ...
   * }
   */

  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    const titleElement = card.querySelector('h2');
    if (titleElement) {
      const title = titleElement.textContent.trim();
      const audioUrl = audioUrlMap[title];

      if (audioUrl) {
        window.reelsAudioManager.initCard(card, audioUrl);
      }
    }
  });
};

/**
 * Alternative: Initialize with data attributes
 * Usage: <article class="card" data-audio-url="https://...">
 */
window.initializeReelsAudioFromAttributes = function() {
  const cards = document.querySelectorAll('.card[data-audio-url]');
  cards.forEach(card => {
    const audioUrl = card.getAttribute('data-audio-url');
    if (audioUrl) {
      window.reelsAudioManager.initCard(card, audioUrl);
    }
  });
};
