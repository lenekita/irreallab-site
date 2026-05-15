// 3D Scroll Animation System
(function() {
  'use strict';

  const config = {
    parallaxIntensity: 0.5,
    cardRotationIntensity: 8,
    scaleIntensity: 0.1,
  };

  let scrollY = 0;
  let windowHeight = window.innerHeight;

  // Update scroll position
  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    updateAnimations();
  }, { passive: true });

  // Update on resize
  window.addEventListener('resize', () => {
    windowHeight = window.innerHeight;
  }, { passive: true });

  // Parallax effect for intro-video
  function updateIntroParallax() {
    const introVideo = document.querySelector('.intro-video');
    if (!introVideo) return;

    const rect = introVideo.getBoundingClientRect();
    const elementProgress = 1 - (rect.bottom / windowHeight);

    if (elementProgress >= -0.2 && elementProgress <= 1.2) {
      const offset = scrollY * config.parallaxIntensity;
      const videoMedia = introVideo.querySelector('.intro-video-media');
      if (videoMedia) {
        videoMedia.style.transform = `translateY(${offset * 0.3}px) scale(${1 + offset * 0.00005})`;
      }

      const content = introVideo.querySelector('.intro-video-content');
      if (content) {
        const opacity = Math.max(0, 1 - elementProgress);
        content.style.opacity = opacity;
        content.style.transform = `translateY(${elementProgress * 40}px)`;
      }
    }
  }

  // 3D perspective effect for hero section
  function updateHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const rect = hero.getBoundingClientRect();
    const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

    if (elementProgress >= -0.2 && elementProgress <= 1.2) {
      const rotateX = (elementProgress - 0.5) * 4;
      hero.style.perspective = '1200px';
      hero.style.transform = `rotateX(${rotateX}deg)`;
      hero.style.transformOrigin = 'center center';
    }
  }

  // Staggered 3D flip effect for reel rows
  function updateReelRows() {
    const rows = document.querySelectorAll('.reel-row');

    rows.forEach((row, index) => {
      const rect = row.getBoundingClientRect();
      const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

      if (elementProgress >= -0.3 && elementProgress <= 1.3) {
        // Staggered animation based on index
        const stagger = index * 0.08;
        const adjustedProgress = Math.max(0, Math.min(1, elementProgress - stagger));

        // 3D flip and slide effect
        const rotateY = (1 - adjustedProgress) * 25;
        const scaleEffect = 0.95 + adjustedProgress * 0.05;
        const translateX = (1 - adjustedProgress) * -40;

        row.style.perspective = '1200px';
        row.style.transform = `
          translateX(${translateX}px)
          rotateY(${rotateY}deg)
          scale(${scaleEffect})
        `;
        row.style.opacity = adjustedProgress;
      }
    });
  }

  // 3D card effect for reel-row-preview-panel
  function updatePreviewPanels() {
    const panels = document.querySelectorAll('.reel-row-preview-panel');

    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

      if (elementProgress >= -0.3 && elementProgress <= 1.3) {
        const adjustedProgress = Math.max(0, Math.min(1, elementProgress));

        // Depth effect
        const scaleZ = 0.8 + adjustedProgress * 0.2;
        const opacity = adjustedProgress;

        panel.style.perspective = '1200px';
        panel.style.transform = `scale(${scaleZ})`;
        panel.style.opacity = opacity;
      }
    });
  }

  // Section fade-in with 3D effect
  function updateSections() {
    const sections = document.querySelectorAll('section');

    sections.forEach((section, index) => {
      if (section.classList.contains('intro-video')) return; // Skip intro-video
      if (section.classList.contains('reels-page')) return; // Skip reels-page

      const rect = section.getBoundingClientRect();
      const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

      if (elementProgress >= -0.1 && elementProgress <= 1.1) {
        const adjustedProgress = Math.max(0, Math.min(1, elementProgress));
        const rotateX = (1 - adjustedProgress) * 15;

        section.style.perspective = '1200px';
        section.style.transform = `
          rotateX(${rotateX}deg)
          translateZ(0)
        `;
        section.style.opacity = Math.max(0.3, adjustedProgress);
      }
    });
  }

  // Hero reel (right side) 3D rotation
  function updateHeroReel() {
    const heroReel = document.querySelector('.hero-right');
    if (!heroReel) return;

    const rect = heroReel.getBoundingClientRect();
    const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

    if (elementProgress >= -0.3 && elementProgress <= 1.3) {
      const adjustedProgress = Math.max(0, Math.min(1, elementProgress));

      // 3D rotation effect
      const rotateY = (adjustedProgress - 0.5) * 25;
      const rotateX = (adjustedProgress - 0.5) * 10;
      const scale = 0.9 + adjustedProgress * 0.1;

      heroReel.style.perspective = '1200px';
      heroReel.style.transform = `
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
        scale(${scale})
      `;
    }
  }

  // Hero left text parallax
  function updateHeroLeft() {
    const heroLeft = document.querySelector('.hero-left');
    if (!heroLeft) return;

    const rect = heroLeft.getBoundingClientRect();
    const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

    if (elementProgress >= -0.3 && elementProgress <= 1.3) {
      const adjustedProgress = Math.max(0, Math.min(1, elementProgress));
      const translateY = (1 - adjustedProgress) * 60;

      heroLeft.style.transform = `translateY(${translateY}px)`;
      heroLeft.style.opacity = adjustedProgress;
    }
  }

  // CTA band slide-up effect
  function updateCtaBand() {
    const ctaBand = document.querySelector('.cta-band');
    if (!ctaBand) return;

    const rect = ctaBand.getBoundingClientRect();
    const elementProgress = (windowHeight - rect.top) / (windowHeight + rect.height);

    if (elementProgress >= -0.2 && elementProgress <= 1.2) {
      const adjustedProgress = Math.max(0, Math.min(1, elementProgress));
      const translateY = (1 - adjustedProgress) * 50;
      const scaleX = 0.95 + adjustedProgress * 0.05;

      ctaBand.style.transform = `translateY(${translateY}px) scaleX(${scaleX})`;
      ctaBand.style.opacity = adjustedProgress;
    }
  }

  // Main animation update function
  function updateAnimations() {
    // Enable 3D perspective on body
    document.documentElement.style.perspective = '1200px';

    updateIntroParallax();
    updateHeroParallax();
    updateHeroLeft();
    updateHeroReel();
    updateReelRows();
    updatePreviewPanels();
    updateSections();
    updateCtaBand();
  }

  // Initial call
  updateAnimations();

  // Performance optimization: throttle on low-end devices
  let ticking = false;
  let lastScrollTime = 0;

  function throttledUpdate() {
    const now = Date.now();
    if (now - lastScrollTime > 16) { // ~60fps
      updateAnimations();
      lastScrollTime = now;
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(throttledUpdate);
      ticking = true;
    }
  }, { passive: true });
})();
