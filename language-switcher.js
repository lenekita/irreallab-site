// Multi-Language Support System (EN/FR/RO)
// Loads translations from JSON files and dynamically updates page content

(function() {
  // Prevent multiple initializations
  if (window.irreallabSwitcherInitialized) return;
  window.irreallabSwitcherInitialized = true;

  const LANGUAGE_KEY = 'irreallab_language_preference';
  const SUPPORTED_LANGUAGES = ['en', 'fr', 'ro'];
  const DEFAULT_LANGUAGE = 'en';
  let currentLanguage = DEFAULT_LANGUAGE;
  let translations = {};

  // Detect browser language
  function detectBrowserLanguage() {
    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(browserLang)) {
      return browserLang;
    }
    return DEFAULT_LANGUAGE;
  }

  // Get saved language preference or detect
  function getLanguagePreference() {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }
    return detectBrowserLanguage();
  }

  // Load translation JSON file
  async function loadTranslations(lang) {
    try {
      const response = await fetch(`/translations/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang} translations`);
      return await response.json();
    } catch (error) {
      console.warn(`Error loading ${lang} translations, falling back to English:`, error);
      if (lang !== DEFAULT_LANGUAGE) {
        return loadTranslations(DEFAULT_LANGUAGE);
      }
      return {};
    }
  }

  // Get translation value by key (supports nested keys like "nav.home")
  function getTranslation(key, defaultValue = key) {
    const keys = key.split('.');
    let value = translations;
    for (const k of keys) {
      value = value[k];
      if (value === undefined) return defaultValue;
    }
    return value;
  }

  // Update all elements with data-translate attribute
  function applyTranslations() {
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = getTranslation(key);

      // Handle different element types
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        // For form inputs, update placeholder if it exists in translations
        if (element.type === 'text' || element.type === 'email' || element.type === 'search') {
          element.placeholder = translation;
        }
      } else if (element.tagName === 'META') {
        // For meta tags, update content attribute
        element.setAttribute('content', translation);
      } else {
        // For regular elements, update text content
        element.textContent = translation;
      }
    });
  }

  // Create language switcher UI
  function createLanguageSwitcher() {
    const existingSwitcher = document.getElementById('lang-switcher-component');
    if (existingSwitcher) {
      existingSwitcher.remove();
    }

    const switcher = document.createElement('div');
    switcher.id = 'lang-switcher-component';
    switcher.className = 'lang-switcher';
    switcher.innerHTML = `
      <button id="lang-toggle" class="lang-toggle">${currentLanguage.toUpperCase()} ▼</button>
      <div id="lang-dropdown" class="lang-dropdown">
        <button data-lang="en" class="lang-option ${currentLanguage === 'en' ? 'active' : ''}">English</button>
        <button data-lang="fr" class="lang-option ${currentLanguage === 'fr' ? 'active' : ''}">Français</button>
        <button data-lang="ro" class="lang-option ${currentLanguage === 'ro' ? 'active' : ''}">Română</button>
      </div>
    `;

    // Add styles if not already in page
    if (!document.getElementById('lang-switcher-styles')) {
      const styles = document.createElement('style');
      styles.id = 'lang-switcher-styles';
      styles.textContent = `
        .lang-switcher {
          position: relative;
          display: flex;
          align-items: center;
          z-index: 1000;
        }

        .lang-toggle {
          background: transparent;
          border: 1px solid rgba(212, 240, 58, 0.3);
          color: #d4f03a;
          padding: 6px 12px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 3px;
        }

        .lang-toggle:hover {
          background: #d4f03a;
          color: #060606;
          border-color: #d4f03a;
          transform: translateY(-2px);
        }

        .lang-dropdown {
          position: fixed;
          background: #0d0d0d;
          border: 1px solid #1c1c1c;
          border-radius: 3px;
          min-width: 120px;
          display: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 100000;
        }

        .lang-dropdown.active {
          display: block;
        }

        .lang-option {
          display: block;
          width: 100%;
          padding: 0.5rem 1rem;
          color: #4a4a4a;
          text-decoration: none;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: all 0.2s;
          border-bottom: 1px solid #242424;
          border: none;
          background: transparent;
          cursor: pointer;
          font: inherit;
          text-align: left;
        }

        .lang-option:last-child {
          border-bottom: none;
        }

        .lang-option:hover,
        .lang-option.active {
          background: rgba(212, 240, 58, 0.1);
          color: #d4f03a;
        }

        @media (max-width: 600px) {
          .lang-toggle {
            padding: 5px 10px;
            font-size: 0.6rem;
          }

          .lang-option {
            padding: 0.4rem 0.8rem;
            font-size: 0.7rem;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    return switcher;
  }

  // Handle language change
  async function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      lang = DEFAULT_LANGUAGE;
    }

    currentLanguage = lang;
    localStorage.setItem(LANGUAGE_KEY, lang);

    // Load translations
    translations = await loadTranslations(lang);

    // Update page
    applyTranslations();
    updateSwitcher();
  }

  // Update switcher button and dropdown
  function updateSwitcher() {
    const toggle = document.getElementById('lang-toggle');
    const options = document.querySelectorAll('.lang-option');

    if (toggle) {
      toggle.textContent = `${currentLanguage.toUpperCase()} ▼`;
    }

    options.forEach(option => {
      const lang = option.getAttribute('data-lang');
      if (lang === currentLanguage) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }

  // Initialize when DOM is ready
  window.addEventListener('DOMContentLoaded', async () => {
    // Get language preference
    currentLanguage = getLanguagePreference();

    // Load initial translations
    translations = await loadTranslations(currentLanguage);

    // Insert switcher into navigation - try multiple selectors for different page structures
    let insertionPoint = null;
    const navLinks = document.querySelector('.nav-links');
    const nav = document.querySelector('nav');
    const mainNav = document.getElementById('main-nav');

    console.log('Language switcher init - navLinks:', !!navLinks, 'nav:', !!nav, 'mainNav:', !!mainNav);

    const switcher = createLanguageSwitcher();

    if (navLinks) {
      // Insert after nav-links
      navLinks.parentElement.appendChild(switcher);
      console.log('Language switcher inserted after nav-links');
    } else if (mainNav) {
      // Fallback for main page: append to main-nav directly
      mainNav.appendChild(switcher);
      console.log('Language switcher inserted to main-nav');
    } else if (nav) {
      // Fallback: append to any nav
      nav.appendChild(switcher);
      console.log('Language switcher inserted to nav (fallback)');
    } else {
      console.warn('Could not find navigation element to insert language switcher');
    }

    // Wait a moment then verify switcher exists
    setTimeout(() => {
      const checkSwitcher = document.getElementById('lang-switcher-component');
      console.log('Switcher verification:', !!checkSwitcher);
      if (!checkSwitcher) {
        console.error('Switcher was not found after insertion');
      }
    }, 100);

    // Apply translations to page
    applyTranslations();

    // Setup event listeners
    const toggle = document.getElementById('lang-toggle');
    const dropdown = document.getElementById('lang-dropdown');
    const options = document.querySelectorAll('.lang-option');

    if (toggle && dropdown) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.classList.toggle('active');

        // Position dropdown below toggle button if active
        if (dropdown.classList.contains('active')) {
          const rect = toggle.getBoundingClientRect();
          dropdown.style.top = (rect.bottom + 8) + 'px';
          dropdown.style.right = window.innerWidth - rect.right + 'px';
          dropdown.style.left = 'auto';
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.lang-switcher')) {
          dropdown.classList.remove('active');
        }
      });

      // Use event delegation on dropdown for language option clicks
      dropdown.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Check if clicked element is a language option
        const option = e.target.closest('.lang-option');
        if (option) {
          const lang = option.getAttribute('data-lang');
          console.log('Language option clicked:', lang);
          await setLanguage(lang);
          dropdown.classList.remove('active');
        }
      });
    }
  });

  // Expose setLanguage globally for manual switching
  window.irreallab = window.irreallab || {};
  window.irreallab.setLanguage = setLanguage;
})();
