/* ============================================================
   irreallab — animations2.js
   Already linked in irreallab.html via <script src="animations2.js" defer></script>
   ============================================================ */

(function () {
  'use strict';

  const qs    = (s, c = document) => c.querySelector(s);
  const qsa   = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const isMobile = () => window.matchMedia('(pointer: coarse)').matches;

  /* ─────────────────────────────────────────
     1. CUSTOM CURSOR (desktop only)
  ───────────────────────────────────────── */
  function initCursor() {
    if (isMobile()) return;

    const dot  = document.createElement('div');
    const ring = document.createElement('div');
    dot.id = 'ir-dot'; ring.id = 'ir-ring';

    const css = document.createElement('style');
    css.textContent = `
      #ir-dot,#ir-ring{position:fixed;border-radius:50%;pointer-events:none;
        z-index:99998;transform:translate(-50%,-50%);will-change:left,top;}
      #ir-dot{width:6px;height:6px;background:var(--accent,#d4f03a);
        transition:transform .1s,background .2s;}
      #ir-ring{width:30px;height:30px;border:1px solid var(--accent,#d4f03a);
        opacity:.4;transition:width .25s,height .25s,opacity .25s;}
      body.ir-hov #ir-dot{transform:translate(-50%,-50%) scale(2.8);}
      body.ir-hov #ir-ring{width:54px;height:54px;opacity:.18;}
      body.ir-clk #ir-dot{transform:translate(-50%,-50%) scale(.4);background:#fff;}
      .ir-trail{position:fixed;width:3px;height:3px;border-radius:50%;
        background:var(--accent,#d4f03a);pointer-events:none;z-index:99997;
        animation:ir-trail-fade .55s forwards;}
      @keyframes ir-trail-fade{to{opacity:0;transform:scale(0);}}
    `;
    document.head.appendChild(css);
    document.body.append(dot, ring);

    let mx = innerWidth/2, my = innerHeight/2, rx = mx, ry = my, lastT = 0;

    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      // trail
      const now = Date.now();
      if (now - lastT > 38) {
        lastT = now;
        const t = document.createElement('div');
        t.className = 'ir-trail';
        t.style.left = mx + 'px'; t.style.top = my + 'px';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 580);
      }
    });
    document.addEventListener('mousedown', () => document.body.classList.add('ir-clk'));
    document.addEventListener('mouseup',   () => document.body.classList.remove('ir-clk'));

    const hovSel = 'a,button,.reel-row,.cta-btn,.nav-cta,.reel-preview-cta,.hero-reel-open';
    document.addEventListener('mouseover', e => { if (e.target.closest(hovSel)) document.body.classList.add('ir-hov'); });
    document.addEventListener('mouseout',  e => { if (e.target.closest(hovSel)) document.body.classList.remove('ir-hov'); });

    (function loop() {
      dot.style.left  = mx + 'px'; dot.style.top  = my + 'px';
      rx += (mx - rx) * .11; ry += (my - ry) * .11;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();
  }

  /* ─────────────────────────────────────────
     2. PAGE LOAD — staggered entrance
  ───────────────────────────────────────── */
  function initPageLoad() {
    const css = document.createElement('style');
    css.textContent = `
      .ir-fade{opacity:0;transform:translateY(22px);
        transition:opacity .75s cubic-bezier(.16,1,.3,1),transform .75s cubic-bezier(.16,1,.3,1);}
      .ir-fade-l{opacity:0;transform:translateX(-18px);
        transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
      .ir-scale{opacity:0;transform:scale(.96);
        transition:opacity .85s cubic-bezier(.16,1,.3,1),transform .85s cubic-bezier(.16,1,.3,1);}
      .ir-in{opacity:1!important;transform:none!important;}
    `;
    document.head.appendChild(css);

    [
      [qs('nav'),           'ir-fade',   0  ],
      [qs('.hero-eyebrow'), 'ir-fade-l', 100],
      [qs('.hero-title'),   'ir-fade',   200],
      [qs('.hero-sub'),     'ir-fade',   320],
      [qs('.hero-meta'),    'ir-fade',   420],
      [qs('.hero-right'),   'ir-scale',  260],
    ].forEach(([el, cls, delay]) => {
      if (!el) return;
      el.classList.add(cls);
      setTimeout(() => el.classList.add('ir-in'), delay + 60);
    });
  }

  /* ─────────────────────────────────────────
     3. SCROLL REVEAL
  ───────────────────────────────────────── */
  function initScrollReveal() {
    const els = qsa('.section-head,.reel-row,.reel-preview-block,.cta-band,footer');
    els.forEach((el, i) => {
      el.classList.add('ir-fade');
      el.style.transitionDelay = (i % 4) * 55 + 'ms';
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('ir-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -28px 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ─────────────────────────────────────────
     4. BLINKING UNDERSCORE — nav, hero, footer
  ───────────────────────────────────────── */
  function initBlinkCursor() {
    const css = document.createElement('style');
    css.textContent = `
      @keyframes ir-blink{0%,49%{opacity:1;}50%,100%{opacity:0;}}
      .ir-blink{display:inline-block;animation:ir-blink .85s step-end infinite;
        color:var(--accent,#d4f03a);}
    `;
    document.head.appendChild(css);

    qsa('.nav-logo em, .footer-logo em, .hero-title em').forEach(el => {
      const t = el.textContent;
      if (t.endsWith('_')) {
        el.textContent = t.slice(0, -1);
        const c = document.createElement('span');
        c.className = 'ir-blink'; c.textContent = '_';
        el.appendChild(c);
      }
    });
  }

  /* ─────────────────────────────────────────
     5. GLITCH — hero title letters
  ───────────────────────────────────────── */
  function initGlitch() {
    const title = qs('.hero-title');
    if (!title) return;
    const node = title.childNodes[0];
    if (!node) return;
    const orig = node.textContent.trim();
    const CHARS = '!<>-_\\/[]{}=+*^?#@$%&~|';

    const css = document.createElement('style');
    css.textContent = `.ir-gl{position:absolute;top:0;left:0;pointer-events:none;
      user-select:none;font:inherit;letter-spacing:inherit;line-height:inherit;
      color:var(--accent,#d4f03a);opacity:0;white-space:nowrap;}`;
    document.head.appendChild(css);
    title.style.position = 'relative';

    const scr = (s, a) => s.split('').map(c => Math.random() < a
      ? CHARS[Math.floor(Math.random() * CHARS.length)] : c).join('');

    function run() {
      const g = document.createElement('span');
      g.className = 'ir-gl'; title.appendChild(g);
      let f = 0;
      const iv = setInterval(() => {
        f++;
        if      (f <= 4) { g.style.opacity='.7'; g.textContent=scr(orig,.4); g.style.transform=`translate(${(Math.random()-.5)*7}px,${(Math.random()-.5)*3}px)`; g.style.clipPath=`inset(${Math.random()*60}% 0 ${Math.random()*35}% 0)`; }
        else if (f <= 7) { g.style.opacity='.3'; g.textContent=scr(orig,.15); g.style.clipPath=`inset(${30+Math.random()*40}% 0 0 0)`; }
        else             { g.style.opacity='0'; }
        if (f >= 14) { clearInterval(iv); g.remove(); setTimeout(run, 3500 + Math.random()*4500); }
      }, 48);
    }
    setTimeout(run, 2800);
  }

  /* ─────────────────────────────────────────
     6. REEL ROW — number scramble on hover
  ───────────────────────────────────────── */
  function initRowScramble() {
    qsa('.reel-row').forEach(row => {
      const el = qs('.reel-row-num', row);
      if (!el) return;
      const orig = el.textContent.trim();
      let raf;
      row.addEventListener('mouseenter', () => {
        cancelAnimationFrame(raf);
        let f = 0;
        const go = () => { f++; el.textContent = f < 9 ? String(Math.floor(Math.random()*99)).padStart(2,'0') : orig; if (f < 9) raf = requestAnimationFrame(go); };
        raf = requestAnimationFrame(go);
      });
      row.addEventListener('mouseleave', () => { cancelAnimationFrame(raf); el.textContent = orig; });
    });
  }

  /* ─────────────────────────────────────────
     7. NAV — compact on scroll
  ───────────────────────────────────────── */
  function initNav() {
    const nav = qs('nav');
    if (!nav) return;
    const css = document.createElement('style');
    css.textContent = `
      nav{transition:height .35s cubic-bezier(.16,1,.3,1),background .35s,border-color .35s;}
      nav.ir-scrolled{height:44px;background:rgba(6,6,6,.95);backdrop-filter:blur(16px);border-color:#111;}
    `;
    document.head.appendChild(css);
    let tick = false;
    window.addEventListener('scroll', () => {
      if (!tick) { requestAnimationFrame(() => { nav.classList.toggle('ir-scrolled', scrollY > 55); tick = false; }); tick = true; }
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     8. MAGNETIC BUTTONS (desktop)
  ───────────────────────────────────────── */
  function initMagnetic() {
    if (isMobile()) return;
    qsa('.cta-btn,.nav-cta').forEach(btn => {
      btn.style.transition = 'transform .4s cubic-bezier(.16,1,.3,1),opacity .2s';
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${clamp((e.clientX-r.left-r.width/2)*.28,-12,12)}px,${clamp((e.clientY-r.top-r.height/2)*.28,-9,9)}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)'; });
    });
  }

  /* ─────────────────────────────────────────
     9. SECTION TITLE underline slide-in
  ───────────────────────────────────────── */
  function initUnderline() {
    const css = document.createElement('style');
    css.textContent = `
      .section-head h2 span{position:relative;display:inline-block;}
      .section-head h2 span::after{content:'';position:absolute;left:0;bottom:2px;
        width:0;height:3px;background:var(--accent,#d4f03a);
        transition:width .65s cubic-bezier(.16,1,.3,1);}
      .section-head.ir-in h2 span::after{width:100%;}
    `;
    document.head.appendChild(css);
  }

  /* ─────────────────────────────────────────
     10. LIVE DOT — organic flicker
  ───────────────────────────────────────── */
  function initLiveDot() {
    qsa('.live-dot').forEach(dot => {
      dot.style.transition = 'opacity .07s';
      const flicker = () => {
        setTimeout(() => {
          dot.style.opacity = '.2';
          setTimeout(() => { dot.style.opacity = '1'; flicker(); }, 65 + Math.random()*110);
        }, 1800 + Math.random()*3400);
      };
      flicker();
    });
  }

  /* ─────────────────────────────────────────
     11. PARALLAX — reel preview big number
  ───────────────────────────────────────── */
  function initParallax() {
    const numEl = qs('.reel-preview-num');
    if (!numEl) return;
    let tick = false;
    window.addEventListener('scroll', () => {
      if (!tick) {
        requestAnimationFrame(() => {
          const b = numEl.closest('.reel-preview-block');
          if (b) {
            const r = b.getBoundingClientRect();
            numEl.style.transform = `translateY(${clamp(((innerHeight - r.top) / (innerHeight + r.height) - .5) * 65, -32, 32)}px)`;
          }
          tick = false;
        });
        tick = true;
      }
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     12. COUNTER — hero stat count-up
  ───────────────────────────────────────── */
  function initCounters() {
    qsa('.hero-stat-num').filter(el => /^\d+$/.test(el.textContent.trim())).forEach(el => {
      const target = parseInt(el.textContent.trim(), 10);
      el.textContent = '00';
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        let f = 0, steps = 22;
        (function step() {
          f++; el.textContent = String(Math.round(f/steps*target)).padStart(2,'0');
          if (f < steps) requestAnimationFrame(step);
        })();
      }, { threshold: .5 });
      io.observe(el);
    });
  }

  /* ─────────────────────────────────────────
     13. MOBILE NAV — hamburger toggle
  ───────────────────────────────────────── */
  function initMobileNav() {
    const nav = qs('nav');
    const links = qs('.nav-links');
    if (!nav || !links) return;

    const css = document.createElement('style');
    css.textContent = `
      .ir-burger{display:none;flex-direction:column;gap:4px;cursor:pointer;
        padding:6px;background:none;border:none;}
      .ir-burger span{display:block;width:20px;height:1.5px;background:var(--text,#ede9df);
        transition:transform .3s,opacity .3s;}
      .ir-burger.open span:nth-child(1){transform:translateY(5.5px) rotate(45deg);}
      .ir-burger.open span:nth-child(2){opacity:0;}
      .ir-burger.open span:nth-child(3){transform:translateY(-5.5px) rotate(-45deg);}
      @media(max-width:480px){
        .ir-burger{display:flex;}
        .nav-links{
          position:fixed;top:0;left:0;right:0;bottom:0;
          background:rgba(6,6,6,.97);backdrop-filter:blur(20px);
          flex-direction:column;align-items:center;justify-content:center;
          gap:2.5rem;z-index:500;
          opacity:0;pointer-events:none;
          transition:opacity .35s cubic-bezier(.16,1,.3,1);
        }
        .nav-links.open{opacity:1;pointer-events:all;}
        .nav-links a{font-size:1.2rem!important;letter-spacing:.2em;}
        .nav-links .nav-hide{display:flex!important;}
      }
    `;
    document.head.appendChild(css);

    const burger = document.createElement('button');
    burger.className = 'ir-burger';
    burger.setAttribute('aria-label', 'Menu');
    burger.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(burger);

    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      links.classList.toggle('open');
      document.body.style.overflow = links.classList.contains('open') ? 'hidden' : '';
    });

    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        burger.classList.remove('open');
        links.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ─────────────────────────────────────────
     14. TOUCH RIPPLE on reel rows (mobile)
  ───────────────────────────────────────── */
  function initTouchRipple() {
    const css = document.createElement('style');
    css.textContent = `
      .ir-ripple{position:absolute;border-radius:50%;background:var(--accent,#d4f03a);
        opacity:.25;transform:scale(0);pointer-events:none;
        animation:ir-rip .5s cubic-bezier(.16,1,.3,1) forwards;}
      @keyframes ir-rip{to{transform:scale(4);opacity:0;}}
    `;
    document.head.appendChild(css);

    qsa('.reel-row').forEach(row => {
      row.addEventListener('touchstart', e => {
        const r = row.getBoundingClientRect();
        const t = e.touches[0];
        const rip = document.createElement('span');
        rip.className = 'ir-ripple';
        const size = Math.max(r.width, r.height) * .5;
        rip.style.cssText = `width:${size}px;height:${size}px;left:${t.clientX-r.left-size/2}px;top:${t.clientY-r.top-size/2}px;`;
        row.appendChild(rip);
        setTimeout(() => rip.remove(), 520);
      }, { passive: true });
    });
  }



  /* ─────────────────────────────────────────
     15. INTRO VIDEO — scroll to site content
  ───────────────────────────────────────── */
  function initIntroVideo() {
    const intro = qs('.intro-video');
    const target = qs('#site-content');
    if (!intro || !target) return;

    const go = () => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const btn = qs('.intro-enter', intro);
    if (btn) btn.addEventListener('click', go);

    let locked = false;
    intro.addEventListener('wheel', e => {
      if (e.deltaY <= 8 || locked) return;
      e.preventDefault();
      locked = true;
      go();
      setTimeout(() => { locked = false; }, 900);
    }, { passive: false });

    let touchStartY = null;
    intro.addEventListener('touchstart', e => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    intro.addEventListener('touchmove', e => {
      if (touchStartY === null || locked) return;
      const diff = touchStartY - e.touches[0].clientY;
      if (diff > 28) {
        e.preventDefault();
        locked = true;
        go();
        setTimeout(() => { locked = false; }, 900);
      }
    }, { passive: false });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    initCursor();
    initPageLoad();
    initScrollReveal();
    initBlinkCursor();
    initGlitch();
    initRowScramble();
    initNav();
    initMagnetic();
    initUnderline();
    initLiveDot();
    initParallax();
    initCounters();
    initMobileNav();
    initTouchRipple();
    initIntroVideo();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();


/* ============================================================
   irreallab — compact Instagram embeds + inline row preview
   Does not replace the original reel-row hover animation.
   ============================================================ */
(function () {
  'use strict';

  function processInstagramEmbeds() {
    if (window.instgrm && window.instgrm.Embeds && typeof window.instgrm.Embeds.process === 'function') {
      window.instgrm.Embeds.process();
    }
  }

  function compactEmbeds() {
    document.querySelectorAll('.hero-embed, .reel-preview-embed-inner, .reel-row-preview-frame').forEach(box => {
      box.style.overflow = 'hidden';
    });
  }

  function initInlinePreviewProcessing() {
    const panels = [...document.querySelectorAll('.reel-row-preview-panel')];
    panels.forEach(panel => {
      const row = panel.previousElementSibling;
      if (!row || !row.classList.contains('reel-row')) return;
      const run = () => {
        processInstagramEmbeds();
        setTimeout(compactEmbeds, 650);
        setTimeout(compactEmbeds, 1400);
      };
      row.addEventListener('mouseenter', run, { once: false });
      row.addEventListener('focusin', run, { once: false });
    });
  }

  function initCompactInstagram() {
    compactEmbeds();
    processInstagramEmbeds();
    setTimeout(compactEmbeds, 700);
    setTimeout(compactEmbeds, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initCompactInstagram();
      initInlinePreviewProcessing();
    });
  } else {
    initCompactInstagram();
    initInlinePreviewProcessing();
  }
})();
