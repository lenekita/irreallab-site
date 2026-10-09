/* irreallab likes — heart buttons for reels.
   Any <button class="like-btn" data-like="reel-slug"> gets wired up.
   The visitor's own hearts live in localStorage; counts come from /api/likes. */
(function () {
  'use strict';

  var KEY = 'irreallab_likes';
  var HEART = '<svg viewBox="-1 -1 11 10" aria-hidden="true" focusable="false"><path d="M1 0H3V1H4V2H5V1H6V0H8V1H9V4H8V5H7V6H6V7H5V8H4V7H3V6H2V5H1V4H0V1H1Z"/></svg>';

  var mine = new Set();
  try { mine = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}

  var counts = {};
  var loaded = false;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(mine))); } catch (e) {}
  }

  function format(n) {
    if (n >= 10000) return Math.round(n / 1000) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function paint(btn) {
    var slug = btn.getAttribute('data-like');
    var on = mine.has(slug);
    var count = Math.max(counts[slug] || 0, on ? 1 : 0);
    btn.classList.toggle('is-liked', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', (on ? 'Unlike this reel' : 'Like this reel') + (loaded ? ' (' + count + (count === 1 ? ' like)' : ' likes)') : ''));
    var label = btn.querySelector('.like-count');
    if (label) label.textContent = loaded ? format(count) : '';
  }

  function paintSlug(slug) {
    document.querySelectorAll('.like-btn[data-like="' + slug + '"]').forEach(paint);
  }

  function send(slug, liked) {
    return fetch('/api/likes/' + encodeURIComponent(slug), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked: liked })
    }).then(function (res) {
      if (!res.ok) throw new Error('like failed');
      return res.json();
    });
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    var btn = e.currentTarget;
    var slug = btn.getAttribute('data-like');
    var wasLiked = mine.has(slug);
    var willLike = !wasLiked;

    if (willLike) mine.add(slug); else mine.delete(slug);
    counts[slug] = Math.max(0, (counts[slug] || 0) + (willLike ? 1 : -1));
    save();
    paintSlug(slug);

    if (willLike) {
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }

    send(slug, willLike).then(function (data) {
      counts[slug] = data.count;
      paintSlug(slug);
    }).catch(function () {
      if (wasLiked) mine.add(slug); else mine.delete(slug);
      counts[slug] = Math.max(0, (counts[slug] || 0) + (willLike ? -1 : 1));
      save();
      paintSlug(slug);
    });
  }

  function bind(root) {
    (root || document).querySelectorAll('.like-btn[data-like]:not([data-bound])').forEach(function (btn) {
      btn.setAttribute('data-bound', '1');
      if (!btn.querySelector('svg')) btn.insertAdjacentHTML('afterbegin', HEART);
      if (!btn.querySelector('.like-count')) btn.insertAdjacentHTML('beforeend', '<span class="like-count"></span>');
      btn.addEventListener('click', onClick);
      paint(btn);
    });
  }

  function button(slug) {
    return '<button type="button" class="like-btn" data-like="' + slug + '">' + HEART + '<span class="like-count"></span></button>';
  }

  function load() {
    fetch('/api/likes', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (data) {
        counts = data || {};
        loaded = true;
        document.querySelectorAll('.like-btn[data-like]').forEach(paint);
      })
      .catch(function () {});
  }

  window.irreallabLikes = { bind: bind, button: button };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(); load(); });
  } else {
    bind(); load();
  }
})();
