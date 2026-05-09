/* irreallab animations2.js — v3 CINEMATIC EDITION
   Advanced motion system: cursor FX, parallax, scanlines,
   staggered reveals, scramble text, ambient particles, glitch bursts.
*/

(function () {
  'use strict';

  /* ─── UTILS ─────────────────────────────────────────────── */
  function ready(fn) {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn)
      : fn();
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  function mapRange(v, a, b, c, d) { return c + ((v - a) / (b - a)) * (d - c); }

  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── BOOT ───────────────────────────────────────────────── */
  ready(function () {
    initCustomCursor();
    initPageReveal();
    initStickyMarquee();
    initIntroParallax();
    initIntroEnterButton();
    initReelsReveal();
    initTypewriterLoop();
    initScrambleTitles();
    initAudioToggle();
    initMobileVideoAutoplay();
    initReelRowStagger();
    initAmbientParticles();
    initScanlineFlicker();
    initHeroCardTilt();
    initMagneticButtons();
    initScrollProgress();
  });

  /* ─────────────────────────────────────────────────────────
   * 1. CUSTOM CURSOR
   * ─────────────────────────────────────────────────────────*/
  function initCustomCursor() {
    if (prefersReducedMotion || window.matchMedia('(pointer: coarse)').matches) return;

    const dot  = document.createElement('div');
    const ring = document.createElement('div');
    dot.className  = 'ir-cursor-dot';
    ring.className = 'ir-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    injectStyle(`
      .ir-cursor-dot, .ir-cursor-ring {
        position: fixed; top: 0; left: 0;
        pointer-events: none; z-index: 999999;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        will-change: transform;
      }
      .ir-cursor-dot {
        width: 6px; height: 6px;
        background: var(--accent);
        transition: opacity .2s, transform .1s;
        box-shadow: 0 0 10px rgba(212,240,58,.8), 0 0 22px rgba(212,240,58,.35);
      }
      .ir-cursor-ring {
        width: 36px; height: 36px;
        border: 1px solid rgba(212,240,58,.55);
        transition: width .25s cubic-bezier(.16,1,.3,1),
                    height .25s cubic-bezier(.16,1,.3,1),
                    opacity .25s,
                    border-color .25s,
                    background .25s;
      }
      body.ir-cursor-hover .ir-cursor-ring {
        width: 60px; height: 60px;
        border-color: var(--accent);
        background: rgba(212,240,58,.06);
      }
      body.ir-cursor-active .ir-cursor-dot {
        transform: translate(-50%, -50%) scale(2);
      }
      body.ir-cursor-active .ir-cursor-ring {
        width: 24px; height: 24px;
        background: rgba(212,240,58,.12);
      }
    `);

    let mx = -200, my = -200;
    let rx = -200, ry = -200;
    let raf;

    function loop() {
      rx = lerp(rx, mx, 0.12);
      ry = lerp(ry, my, 0.12);
      dot.style.transform  = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    }
    loop();

    window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });

    document.querySelectorAll('a, button, .reel-row, .intro-enter, .nav-cta, .cta-btn, .audio-toggle').forEach(function (el) {
      el.addEventListener('mouseenter', function () { document.body.classList.add('ir-cursor-hover'); });
      el.addEventListener('mouseleave', function () { document.body.classList.remove('ir-cursor-hover'); });
    });

    document.addEventListener('mousedown', function () { document.body.classList.add('ir-cursor-active'); });
    document.addEventListener('mouseup',   function () { document.body.classList.remove('ir-cursor-active'); });
  }

  /* ─────────────────────────────────────────────────────────
   * 2. PAGE REVEAL — cinematic fade-in from black
   * ─────────────────────────────────────────────────────────*/
  function initPageReveal() {
    if (prefersReducedMotion) return;

    const veil = document.createElement('div');
    veil.className = 'ir-page-veil';
    document.body.prepend(veil);

    injectStyle(`
      .ir-page-veil {
        position: fixed; inset: 0; z-index: 9000000;
        background: #000;
        pointer-events: none;
        transition: opacity 1.1s cubic-bezier(.4,0,.2,1);
      }
      .ir-page-veil.ir-veil-out { opacity: 0; }
    `);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        veil.classList.add('ir-veil-out');
        setTimeout(function () { veil.remove(); }, 1200);
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 3. STICKY MARQUEE (enhanced from original)
   * ─────────────────────────────────────────────────────────*/
  function initStickyMarquee() {
    const introSection  = document.querySelector('.intro-video');
    const marquee       = document.querySelector('.marquee');
    const marqueeSpacer = document.getElementById('marquee-spacer');
    const nav           = document.getElementById('main-nav') || document.querySelector('nav');
    const navSpacer     = document.getElementById('nav-spacer');

    function update() {
      if (!introSection || !marquee || !marqueeSpacer) return;
      const marqueeH = marquee.offsetHeight || 34;
      const navH     = nav ? (nav.offsetHeight || 60) : 60;

      document.documentElement.style.setProperty('--marquee-height', marqueeH + 'px');
      document.documentElement.style.setProperty('--nav-height',     navH     + 'px');

      const trigger    = introSection.offsetTop + introSection.offsetHeight;
      const shouldStick = window.scrollY >= trigger;

      marquee.classList.toggle('is-sticky', shouldStick);
      marqueeSpacer.classList.toggle('is-active', shouldStick);

      if (nav && navSpacer) {
        nav.classList.toggle('is-sticky', shouldStick);
        navSpacer.classList.toggle('is-active', shouldStick);
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('load',   update);
    update();
  }

  /* ─────────────────────────────────────────────────────────
   * 4. INTRO PARALLAX — video + content layers drift
   * ─────────────────────────────────────────────────────────*/
  function initIntroParallax() {
    if (prefersReducedMotion) return;

    const section = document.querySelector('.intro-video');
    const media   = document.querySelector('.intro-video-media');
    const brand   = document.querySelector('.intro-brand');
    const topline = document.querySelector('.intro-topline');
    const bottom  = document.querySelector('.intro-bottom');
    if (!section || !media) return;

    let ticking = false;

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        const rect     = section.getBoundingClientRect();
        const progress = clamp(-rect.top / section.offsetHeight, 0, 1);

        /* Video drifts back (subtle Ken-Burns-like) */
        const vScale = 1 + progress * 0.06;
        const vY     = progress * 55;
        media.style.transform = `scale(${vScale}) translateY(${vY}px)`;
        media.style.opacity   = (1 - progress * 1.15).toFixed(3);

        /* Content layers at different depths */
        if (brand)   brand.style.transform   = `translateY(${progress * -38}px)`;
        if (topline) topline.style.transform = `translateY(${progress * -18}px)`;
        if (bottom)  bottom.style.transform  = `translateY(${progress * -8}px)`;

        ticking = false;
      });
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────
   * 5. ENTER BUTTON + scroll reveal
   * ─────────────────────────────────────────────────────────*/
  function initIntroEnterButton() {
    const button = document.querySelector('.intro-enter');
    const target = document.querySelector('#reels');
    if (!button || !target) return;

    button.addEventListener('click', function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* Subtle animated border pulse */
    if (!prefersReducedMotion) {
      injectStyle(`
        @keyframes ir-btn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,240,58,0), inset 0 0 0 0 rgba(212,240,58,0); }
          50%       { box-shadow: 0 0 22px 3px rgba(212,240,58,.12), inset 0 0 10px 0 rgba(212,240,58,.06); }
        }
        .intro-enter { animation: ir-btn-pulse 2.8s ease-in-out infinite; }
        .intro-enter:hover { animation: none; }
      `);
    }
  }

  /* ─────────────────────────────────────────────────────────
   * 6. REELS REVEAL — staggered row entrances
   * ─────────────────────────────────────────────────────────*/
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
    }, { threshold: 0.1 });

    observer.observe(reelsPage);
  }

  /* ─────────────────────────────────────────────────────────
   * 7. TYPEWRITER LOOP (refined timing + chromatic ghost)
   * ─────────────────────────────────────────────────────────*/
  function initTypewriterLoop() {
    const elements = document.querySelectorAll('.ir-typewriter');
    if (!elements.length) return;

    elements.forEach(function (el) {
      const fullText = el.dataset.typewriterText || el.textContent.trim();
      el.dataset.typewriterText = fullText;

      if (prefersReducedMotion) { el.textContent = fullText; return; }

      const typeSpeed   = Number(el.dataset.typeSpeed   || 72);
      const deleteSpeed = Number(el.dataset.deleteSpeed || 32);
      const pauseAtEnd  = Number(el.dataset.pauseEnd    || 22);
      const pauseAtStart= Number(el.dataset.pauseStart  || 8);

      let index = 0, deleting = false, pauseTicks = 0;

      function tick() {
        if (!deleting) {
          index++;
          el.textContent = fullText.slice(0, index);
          if (index >= fullText.length) {
            el.classList.add('is-done');
            if (++pauseTicks >= pauseAtEnd) { deleting = true; pauseTicks = 0; }
          }
        } else {
          index = Math.max(0, index - 1);
          el.textContent = fullText.slice(0, index);
          if (index <= 0) {
            el.classList.remove('is-done');
            if (++pauseTicks >= pauseAtStart) { deleting = false; pauseTicks = 0; }
          }
        }
        /* Micro-random speed variation for organic feel */
        const jitter = (Math.random() - .5) * 18;
        setTimeout(tick, (deleting ? deleteSpeed : typeSpeed) + jitter);
      }

      el.textContent = '';
      setTimeout(tick, 500 + Math.random() * 300);
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 8. SCRAMBLE TITLES — on scroll entry + hover
   * ─────────────────────────────────────────────────────────*/
  const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&';

  function scrambleText(el, finalText, duration) {
    if (prefersReducedMotion) { el.textContent = finalText; return; }

    const len   = finalText.length;
    const start = performance.now();
    let   frame;

    function step(now) {
      const elapsed  = now - start;
      const progress = clamp(elapsed / duration, 0, 1);
      const revealed = Math.floor(progress * len);

      let text = '';
      for (let i = 0; i < len; i++) {
        if (i < revealed || finalText[i] === ' ') {
          text += finalText[i];
        } else {
          text += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = text;

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        el.textContent = finalText;
      }
    }
    cancelAnimationFrame(frame);
    requestAnimationFrame(step);
  }

  function initScrambleTitles() {
    /* Scramble on first scroll reveal */
    const scrambleTargets = document.querySelectorAll('.hero-title, .reels-page .section-head h2, .section-head h2');

    if (!('IntersectionObserver' in window)) return;

    scrambleTargets.forEach(function (el) {
      /* Store the text of the first text-node (before any child em/span) */
      const textNode = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
      if (!textNode) return;

      const originalText = textNode.textContent.trim();
      let   hasRun = false;

      const obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !hasRun) {
            hasRun = true;
            scrambleText(textNode, originalText, 900);
            obs.unobserve(el);
          }
        });
      }, { threshold: 0.25 });

      obs.observe(el);

      /* Hover re-scramble */
      el.addEventListener('mouseenter', function () {
        scrambleText(textNode, originalText, 600);
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 9. AUDIO TOGGLE
   * ─────────────────────────────────────────────────────────*/
  function initAudioToggle() {
    const audio  = document.getElementById('site-audio');
    const button = document.getElementById('audio-toggle');
    if (!audio || !button) return;

    audio.loop    = true;
    audio.preload = 'auto';

    function setAudioState(on) {
      button.classList.toggle('is-on', on);
      button.textContent = on ? 'SOUND ON' : 'SOUND OFF';
      button.setAttribute('aria-label', on ? 'Désactiver la musique' : 'Activer la musique');
    }

    function playAudio() {
      audio.muted = false;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(function () { setAudioState(true); }).catch(function () { setAudioState(false); });
      } else {
        setAudioState(true);
      }
    }

    function pauseAudio() { audio.pause(); setAudioState(false); }

    button.addEventListener('click', function () {
      audio.paused ? playAudio() : pauseAudio();
    });

    playAudio();

    ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(function (evt) {
      window.addEventListener(evt, function firstInt() {
        if (audio.paused) playAudio();
        window.removeEventListener(evt, firstInt);
      }, { once: true, passive: true });
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 10. MOBILE VIDEO AUTOPLAY
   * ─────────────────────────────────────────────────────────*/
  function initMobileVideoAutoplay() {
    const videos = document.querySelectorAll('video');
    if (!videos.length) return;

    function tryPlay(video) {
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.muted = true;
      video.defaultMuted = true;
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }

    videos.forEach(tryPlay);
    ['pointerdown', 'touchstart', 'scroll'].forEach(function (evt) {
      window.addEventListener(evt, function () { videos.forEach(tryPlay); }, { once: true, passive: true });
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 11. REEL ROW STAGGER — rows slide-in sequentially
   * ─────────────────────────────────────────────────────────*/
  function initReelRowStagger() {
    if (prefersReducedMotion) return;

    injectStyle(`
      .reel-row, .reels-page .reel-row {
        opacity: 0;
        transform: translateY(28px);
        transition: opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1);
      }
      .reel-row.ir-row-visible {
        opacity: 1 !important;
        transform: none !important;
      }
    `);

    const rows = document.querySelectorAll('.reel-row');
    if (!('IntersectionObserver' in window)) {
      rows.forEach(function (r) { r.classList.add('ir-row-visible'); });
      return;
    }

    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const row   = entry.target;
          const index = Array.from(rows).indexOf(row);
          setTimeout(function () {
            row.classList.add('ir-row-visible');
          }, index * 80);
          obs.unobserve(row);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    rows.forEach(function (row) { obs.observe(row); });
  }

  /* ─────────────────────────────────────────────────────────
   * 12. AMBIENT PARTICLES — floating in intro section
   * ─────────────────────────────────────────────────────────*/
  function initAmbientParticles() {
    if (prefersReducedMotion) return;

    const section = document.querySelector('.intro-video');
    if (!section) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'ir-particles';
    canvas.setAttribute('aria-hidden', 'true');
    section.appendChild(canvas);

    injectStyle(`
      .ir-particles {
        position: absolute; inset: 0; z-index: 1;
        pointer-events: none; opacity: .65;
      }
    `);

    const ctx   = canvas.getContext('2d');
    const count = 48;
    let   W, H, particles, raf;

    function resize() {
      W = canvas.width  = section.offsetWidth;
      H = canvas.height = section.offsetHeight;
    }

    function createParticle() {
      const hue = Math.random() < .7 ? 'rgba(212,240,58,' : 'rgba(237,233,223,';
      return {
        x:    Math.random() * (W || 800),
        y:    Math.random() * (H || 600),
        vx:   (Math.random() - .5) * 0.28,
        vy:   -(Math.random() * 0.45 + 0.08),
        size: Math.random() * 1.8 + 0.4,
        alpha: Math.random() * 0.55 + 0.1,
        decay: Math.random() * 0.0018 + 0.0004,
        color: hue,
        twinkle: Math.random() * Math.PI * 2
      };
    }

    function reset(p) {
      Object.assign(p, createParticle());
      p.y = H + 4;
      p.alpha = 0;
    }

    resize();
    particles = Array.from({ length: count }, createParticle);
    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const now = performance.now() / 1000;

      particles.forEach(function (p) {
        p.twinkle += 0.018;
        const flicker = 0.85 + Math.sin(p.twinkle) * 0.15;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y < -10) reset(p);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (p.alpha * flicker).toFixed(3) + ')';
        ctx.fill();

        /* Tiny glow for accent particles */
        if (p.color.includes('212')) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color + (p.alpha * 0.12 * flicker).toFixed(3) + ')';
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    }
    draw();
  }

  /* ─────────────────────────────────────────────────────────
   * 13. SCANLINE FLICKER — periodic CRT glitch burst
   * ─────────────────────────────────────────────────────────*/
  function initScanlineFlicker() {
    if (prefersReducedMotion) return;

    const overlay = document.createElement('div');
    overlay.className = 'ir-scanline-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    injectStyle(`
      .ir-scanline-overlay {
        position: fixed; inset: 0; z-index: 9000;
        pointer-events: none;
        opacity: 0;
        background: repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 3px,
          rgba(212,240,58,.018) 3px,
          rgba(212,240,58,.018) 4px
        );
        transition: opacity .08s linear;
        mix-blend-mode: screen;
      }
      .ir-scanline-overlay.ir-scan-on { opacity: 1; }

      @keyframes ir-global-glitch {
        0%   { clip-path: inset(0 0 100% 0); opacity: 0; }
        10%  { clip-path: inset(18% 0 72% 0); opacity: .7; transform: translateX(-3px); }
        22%  { clip-path: inset(44% 0 48% 0); opacity: .4; transform: translateX(4px); }
        34%  { clip-path: inset(68% 0 22% 0); opacity: .6; transform: translateX(-2px); }
        46%  { clip-path: inset(82% 0 8%  0); opacity: .3; transform: translateX(3px); }
        58%  { clip-path: inset(6%  0 87% 0); opacity: .55; transform: translateX(-1px); }
        70%  { clip-path: inset(30% 0 60% 0); opacity: .25; transform: translateX(2px); }
        100% { clip-path: inset(0 0 100% 0); opacity: 0; transform: translateX(0); }
      }
    `);

    function triggerFlicker() {
      overlay.classList.add('ir-scan-on');
      setTimeout(function () { overlay.classList.remove('ir-scan-on'); }, 120 + Math.random() * 80);

      /* Occasional double-flicker */
      if (Math.random() < .35) {
        setTimeout(function () {
          overlay.classList.add('ir-scan-on');
          setTimeout(function () { overlay.classList.remove('ir-scan-on'); }, 60);
        }, 180);
      }
    }

    /* Random interval between 4-14 seconds */
    function schedule() {
      const delay = 4000 + Math.random() * 10000;
      setTimeout(function () { triggerFlicker(); schedule(); }, delay);
    }
    setTimeout(schedule, 2000);
  }

  /* ─────────────────────────────────────────────────────────
   * 14. HERO CARD TILT — 3D mouse-tracking on hero-right
   * ─────────────────────────────────────────────────────────*/
  function initHeroCardTilt() {
    if (prefersReducedMotion || window.matchMedia('(pointer: coarse)').matches) return;

    const card = document.querySelector('.hero-right');
    if (!card) return;

    injectStyle(`
      .hero-right {
        transition: transform .05s linear, box-shadow .3s ease !important;
        will-change: transform;
      }
    `);

    let targetRX = 0, targetRY = 0, currentRX = 0, currentRY = 0, tiltRaf;

    function tiltLoop() {
      currentRX = lerp(currentRX, targetRX, 0.1);
      currentRY = lerp(currentRY, targetRY, 0.1);
      card.style.transform =
        `perspective(900px) rotateY(${currentRY}deg) rotateX(${currentRX}deg) translateZ(8px)`;
      card.style.boxShadow =
        `${-currentRY * 3}px ${currentRX * 3}px 70px rgba(0,0,0,.38), 0 0 ${28 + Math.abs(currentRY) * 2}px rgba(212,240,58,${.04 + Math.abs(currentRY) * .01})`;
      tiltRaf = requestAnimationFrame(tiltLoop);
    }

    card.addEventListener('mouseenter', function () { tiltLoop(); });

    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      const x    = (e.clientX - rect.left) / rect.width  - .5;
      const y    = (e.clientY - rect.top)  / rect.height - .5;
      targetRY = x * 10;
      targetRX = -y * 7;
    });

    card.addEventListener('mouseleave', function () {
      targetRX = 0;
      targetRY = 0;
      setTimeout(function () {
        cancelAnimationFrame(tiltRaf);
        card.style.transform = '';
        card.style.boxShadow = '';
      }, 600);
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 15. MAGNETIC BUTTONS — subtle pull toward cursor
   * ─────────────────────────────────────────────────────────*/
  function initMagneticButtons() {
    if (prefersReducedMotion || window.matchMedia('(pointer: coarse)').matches) return;

    const btns = document.querySelectorAll('.intro-enter, .cta-btn, .nav-cta');

    btns.forEach(function (btn) {
      let tx = 0, ty = 0, cx = 0, cy = 0, magRaf;

      btn.addEventListener('mouseenter', function () {
        btn.style.transition = 'none';
        function loop() {
          cx = lerp(cx, tx, 0.14);
          cy = lerp(cy, ty, 0.14);
          btn.style.transform = `translate(${cx}px, ${cy}px)`;
          magRaf = requestAnimationFrame(loop);
        }
        loop();
      });

      btn.addEventListener('mousemove', function (e) {
        const rect    = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width  / 2;
        const centerY = rect.top  + rect.height / 2;
        tx = (e.clientX - centerX) * 0.28;
        ty = (e.clientY - centerY) * 0.28;
      });

      btn.addEventListener('mouseleave', function () {
        cancelAnimationFrame(magRaf);
        tx = 0; ty = 0; cx = 0; cy = 0;
        btn.style.transition = '';
        btn.style.transform  = '';
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 16. SCROLL PROGRESS — thin accent line at top
   * ─────────────────────────────────────────────────────────*/
  function initScrollProgress() {
    if (prefersReducedMotion) return;

    const bar = document.createElement('div');
    bar.className = 'ir-scroll-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    injectStyle(`
      .ir-scroll-bar {
        position: fixed; top: 0; left: 0; height: 2px; width: 0%;
        background: linear-gradient(90deg, transparent, var(--accent) 20%, var(--accent) 80%, transparent);
        z-index: 10000000; pointer-events: none;
        box-shadow: 0 0 14px rgba(212,240,58,.55), 0 0 28px rgba(212,240,58,.22);
        transition: width .1s linear;
      }
    `);

    window.addEventListener('scroll', function () {
      const max     = document.documentElement.scrollHeight - window.innerHeight;
      const percent = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = percent.toFixed(2) + '%';
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────
   * UTIL — inject <style> once
   * ─────────────────────────────────────────────────────────*/
  const _injectedStyles = new Set();
  function injectStyle(css) {
    const key = css.slice(0, 40);
    if (_injectedStyles.has(key)) return;
    _injectedStyles.add(key);
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

})();
