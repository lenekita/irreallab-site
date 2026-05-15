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
    initLargeTitleTypewriter();
    initAudioToggle();
    initMobileVideoAutoplay();
    initCustomCursor();
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


  function initLargeTitleTypewriter() {
    const titles = document.querySelectorAll('.ir-title-typewriter');
    if (!titles.length) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    titles.forEach(function (title, titleIndex) {
      const firstText = title.dataset.titleFirst || '';
      const secondText = title.dataset.titleSecond || '';
      const secondElement = title.querySelector('span, em');

      if (!secondElement) return;

      let firstNode = null;

      for (let i = 0; i < title.childNodes.length; i += 1) {
        const node = title.childNodes[i];

        if (node.nodeType === 3 && node.nodeValue.trim().length > 0) {
          firstNode = node;
          break;
        }
      }

      if (!firstNode) return;

      const totalLength = firstText.length + secondText.length;
      let index = 0;
      let deleting = false;
      let pauseTicks = 0;

      const typeSpeed = 115;
      const deleteSpeed = 45;
      const pauseAtEnd = 18;
      const pauseAtStart = 6;

      function renderTitle() {
        const firstCount = Math.min(index, firstText.length);
        const secondCount = Math.max(0, index - firstText.length);

        firstNode.nodeValue = firstText.slice(0, firstCount);
        secondElement.textContent = secondText.slice(0, secondCount);
      }

      function tick() {
        if (!deleting) {
          index += 1;

          if (index >= totalLength) {
            index = totalLength;
            pauseTicks += 1;

            if (pauseTicks >= pauseAtEnd) {
              deleting = true;
              pauseTicks = 0;
            }
          }
        } else {
          index -= 1;

          if (index <= 0) {
            index = 0;
            pauseTicks += 1;

            if (pauseTicks >= pauseAtStart) {
              deleting = false;
              pauseTicks = 0;
            }
          }
        }

        renderTitle();

        window.setTimeout(tick, deleting ? deleteSpeed : typeSpeed);
      }

      firstNode.nodeValue = '';
      secondElement.textContent = '';

      window.setTimeout(tick, 450 + (titleIndex * 220));
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

  function initCustomCursor() {
    const cursor = document.querySelector('.ir-cursor');
    const trail = document.querySelector('.ir-cursor-trail');

    if (!cursor || !trail) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let trailX = mouseX;
    let trailY = mouseY;

    function setPosition(element, x, y) {
      element.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) translate(-50%, -50%)';
    }

    document.addEventListener('mousemove', function (event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      setPosition(cursor, mouseX, mouseY);
      document.body.classList.remove('ir-cursor-hidden');
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      document.body.classList.add('ir-cursor-hidden');
    });

    document.addEventListener('mouseenter', function () {
      document.body.classList.remove('ir-cursor-hidden');
    });

    function animateTrail() {
      trailX += (mouseX - trailX) * 0.14;
      trailY += (mouseY - trailY) * 0.14;
      setPosition(trail, trailX, trailY);
      window.requestAnimationFrame(animateTrail);
    }

    animateTrail();

    const hoverTargets = document.querySelectorAll('a, button, .reel-row, .audio-toggle, .intro-enter');

    hoverTargets.forEach(function (target) {
      target.addEventListener('mouseenter', function () {
        document.body.classList.add('ir-cursor-hover');
      });

      target.addEventListener('mouseleave', function () {
        document.body.classList.remove('ir-cursor-hover');
      });
    });
  }

})();
