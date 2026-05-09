/* irreallab animations2.js — complete file
   Fix included: intro typewriter loops on one single line.
*/

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initStickyMarquee();
    initIntroEnterButton();
    initReelsReveal();
    initTypewriterLoop();
    initAudioToggle();
    initMobileVideoAutoplay();
    initReelNumberGlitch();
  });

  function initStickyMarquee() {
    const introSection = document.querySelector('.intro-video');
    const marquee = document.querySelector('.marquee');
    const marqueeSpacer = document.getElementById('marquee-spacer');
    const nav = document.getElementById('main-nav') || document.querySelector('nav');
    const navSpacer = document.getElementById('nav-spacer');

    function updateStickyHeader() {
      if (!introSection || !marquee || !marqueeSpacer) return;

      const marqueeHeight = marquee.offsetHeight || 34;
      const navHeight = nav ? (nav.offsetHeight || 60) : 60;

      document.documentElement.style.setProperty('--marquee-height', `${marqueeHeight}px`);
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);

      const triggerPoint = introSection.offsetTop + introSection.offsetHeight;
      const shouldStick = window.scrollY >= triggerPoint;

      marquee.classList.toggle('is-sticky', shouldStick);
      marqueeSpacer.classList.toggle('is-active', shouldStick);

      if (nav && navSpacer) {
        nav.classList.toggle('is-sticky', shouldStick);
        navSpacer.classList.toggle('is-active', shouldStick);
      }
    }

    window.addEventListener('scroll', updateStickyHeader, { passive: true });
    window.addEventListener('resize', updateStickyHeader);
    window.addEventListener('load', updateStickyHeader);
    updateStickyHeader();
  }

  function initIntroEnterButton() {
    const button = document.querySelector('.intro-enter');
    const target = document.querySelector('#reels');

    if (!button || !target) return;

    button.addEventListener('click', function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function initReelsReveal() {
    const reelsPage = document.querySelector('.reels-page');
    if (!reelsPage) return;

    if (!('IntersectionObserver' in window)) {
      reelsPage.classList.add('ir-reels-in');
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reelsPage.classList.add('ir-reels-in');
          observer.unobserve(reelsPage);
        }
      });
    }, { threshold: 0.15 });

    observer.observe(reelsPage);
  }

  function initTypewriterLoop() {
    const elements = document.querySelectorAll('.ir-typewriter');
    if (!elements.length) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    elements.forEach(function (el) {
      const fullText = el.dataset.typewriterText || el.textContent.trim();
      el.dataset.typewriterText = fullText;

      if (prefersReducedMotion) {
        el.textContent = fullText;
        return;
      }

      let index = 0;
      let deleting = false;
      let pauseTicks = 0;

      const typeSpeed = Number(el.dataset.typeSpeed || 85);
      const deleteSpeed = Number(el.dataset.deleteSpeed || 38);
      const pauseAtEnd = Number(el.dataset.pauseEnd || 18);
      const pauseAtStart = Number(el.dataset.pauseStart || 6);

      function tick() {
        if (!deleting) {
          index += 1;
          el.textContent = fullText.slice(0, index);

          if (index >= fullText.length) {
            el.classList.add('is-done');
            pauseTicks += 1;
            if (pauseTicks >= pauseAtEnd) {
              deleting = true;
              pauseTicks = 0;
            }
          }
        } else {
          index -= 1;
          el.textContent = fullText.slice(0, Math.max(index, 0));

          if (index <= 0) {
            el.classList.remove('is-done');
            pauseTicks += 1;
            if (pauseTicks >= pauseAtStart) {
              deleting = false;
              pauseTicks = 0;
            }
          }
        }

        const nextDelay = deleting ? deleteSpeed : typeSpeed;
        window.setTimeout(tick, nextDelay);
      }

      el.textContent = '';
      window.setTimeout(tick, 400);
    });
  }


  function initReelNumberGlitch() {
    const numbers = document.querySelectorAll('.reel-row-num');
    if (!numbers.length) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    numbers.forEach(function (num, index) {
      function trigger() {
        num.classList.add('ir-num-glitch');
        window.setTimeout(function () {
          num.classList.remove('ir-num-glitch');
        }, 650);

        const nextDelay = 2600 + (index * 420) + Math.random() * 1900;
        window.setTimeout(trigger, nextDelay);
      }

      window.setTimeout(trigger, 900 + (index * 380));
    });
  }

  function initAudioToggle() {
    const audio = document.getElementById('site-audio');
    const button = document.getElementById('audio-toggle');

    if (!audio || !button) return;

    audio.loop = true;
    audio.preload = 'auto';

    function setAudioState(isOn) {
      button.classList.toggle('is-on', isOn);
      button.textContent = isOn ? 'SOUND ON' : 'SOUND OFF';
      button.setAttribute('aria-label', isOn ? 'Désactiver la musique' : 'Activer la musique');
    }

    function playAudio() {
      audio.muted = false;
      const playPromise = audio.play();

      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(function () {
            setAudioState(true);
          })
          .catch(function () {
            setAudioState(false);
          });
      } else {
        setAudioState(true);
      }
    }

    function pauseAudio() {
      audio.pause();
      setAudioState(false);
    }

    button.addEventListener('click', function () {
      if (audio.paused) {
        playAudio();
      } else {
        pauseAudio();
      }
    });

    // Browsers often block autoplay with sound. This tries, then waits for first user interaction.
    playAudio();

    ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(function (eventName) {
      window.addEventListener(eventName, function firstInteraction() {
        if (audio.paused) playAudio();
        window.removeEventListener(eventName, firstInteraction);
      }, { once: true, passive: true });
    });
  }

  function initMobileVideoAutoplay() {
    const videos = document.querySelectorAll('video');
    if (!videos.length) return;

    function tryPlay(video) {
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.muted = true;
      video.defaultMuted = true;

      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(function () {});
      }
    }

    videos.forEach(function (video) {
      tryPlay(video);
    });

    ['pointerdown', 'touchstart', 'scroll'].forEach(function (eventName) {
      window.addEventListener(eventName, function () {
        videos.forEach(tryPlay);
      }, { once: true, passive: true });
    });
  }
})();
