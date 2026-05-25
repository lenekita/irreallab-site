// Cookie Consent Banner - RGPD Compliant
(function() {
  const CONSENT_KEY = 'irreallab_cookie_consent';
  const CONSENT_EXPIRY_DAYS = 365;

  function getCookieConsent() {
    const cookie = localStorage.getItem(CONSENT_KEY);
    return cookie ? JSON.parse(cookie) : null;
  }

  function saveCookieConsent(accepted) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + CONSENT_EXPIRY_DAYS);

    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      accepted: accepted,
      timestamp: new Date().toISOString(),
      expiry: expiry.toISOString()
    }));
  }

  function createBanner() {
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML = `
      <div class="cookie-banner">
        <div class="cookie-content">
          <div class="cookie-text">
            <h3 data-translate="cookies.title">🍪 We Respect Your Privacy</h3>
            <p data-translate="cookies.message">We use Google Analytics to understand how you use our site and improve your experience. No personal data is collected.</p>
          </div>
          <div class="cookie-actions">
            <button id="cookie-reject" class="cookie-btn cookie-reject" data-translate="cookies.decline">Decline</button>
            <button id="cookie-accept" class="cookie-btn cookie-accept" data-translate="cookies.accept">Accept</button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #cookie-consent-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 2147483646;
        background: rgba(6, 6, 6, 0.95);
        backdrop-filter: blur(10px);
        border-top: 1px solid rgba(212, 240, 58, 0.2);
        padding: 1.5rem 2rem;
        animation: slideUp 0.3s ease-out;
      }

      /* Ensure cursor stays on top of banner */
      .ir-cursor, .ir-cursor-trail {
        z-index: 2147483647 !important;
      }

      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .cookie-banner {
        max-width: 1200px;
        margin: 0 auto;
      }

      .cookie-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 2rem;
        flex-wrap: wrap;
      }

      .cookie-text {
        flex: 1;
        min-width: 250px;
      }

      .cookie-text h3 {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 1.2rem;
        color: #d4f03a;
        margin-bottom: 0.5rem;
        letter-spacing: 0.05em;
      }

      .cookie-text p {
        font-family: 'Space Mono', monospace;
        font-size: 0.85rem;
        color: #ede9df;
        line-height: 1.5;
        margin: 0;
      }

      .cookie-actions {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .cookie-btn {
        padding: 0.7rem 1.5rem;
        font-family: 'Bebas Neue', sans-serif;
        font-size: 0.85rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        border: 1px solid rgba(212, 240, 58, 0.3);
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .cookie-accept {
        background: #d4f03a;
        color: #060606;
        border-color: #d4f03a;
      }

      .cookie-accept:hover {
        background: #e0ff52;
        box-shadow: 0 4px 12px rgba(212, 240, 58, 0.3);
        transform: translateY(-2px);
      }

      .cookie-reject {
        background: rgba(212, 240, 58, 0.1);
        color: #d4f03a;
        border-color: rgba(212, 240, 58, 0.3);
      }

      .cookie-reject:hover {
        background: rgba(212, 240, 58, 0.15);
        border-color: #d4f03a;
      }

      @media (max-width: 768px) {
        #cookie-consent-banner {
          padding: 1rem;
        }

        .cookie-content {
          flex-direction: column;
          gap: 1rem;
        }

        .cookie-actions {
          width: 100%;
          justify-content: flex-end;
        }

        .cookie-text h3 {
          font-size: 1rem;
        }

        .cookie-text p {
          font-size: 0.75rem;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Handle button clicks
    document.getElementById('cookie-accept').addEventListener('click', () => {
      saveCookieConsent(true);
      loadGoogleAnalytics();
      closeBanner();
    });

    document.getElementById('cookie-reject').addEventListener('click', () => {
      saveCookieConsent(false);
      closeBanner();
    });
  }

  function closeBanner() {
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.style.animation = 'slideDown 0.3s ease-out';
      setTimeout(() => banner.remove(), 300);
    }
  }

  function loadGoogleAnalytics() {
    // Load Google Analytics only if consent given
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-ZDN63BSS5T';
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-ZDN63BSS5T');
  }

  // Check consent and display banner
  window.addEventListener('DOMContentLoaded', () => {
    const consent = getCookieConsent();

    if (!consent) {
      // No consent given, show banner
      createBanner();
    } else if (consent.accepted) {
      // Consent already given, load GA
      loadGoogleAnalytics();
    }
    // If consent.accepted is false, do nothing (no GA)
  });
})();
