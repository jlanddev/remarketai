/**
 * Remarket AI - Universal Tracking Script
 * Lightweight visitor tracking and behavior analysis
 */

(function() {
  'use strict';

  // Configuration - Dynamic API URL (works everywhere)
  const SCRIPT_SRC = document.currentScript.src;
  const SCRIPT_URL = new URL(SCRIPT_SRC);
  const API_BASE = `${SCRIPT_URL.protocol}//${SCRIPT_URL.host}`;
  const TRACK_API = `${API_BASE}/api/track`;
  const IDENTIFY_API = `${API_BASE}/api/identify`;
  const CLIENT_ID = new URLSearchParams(SCRIPT_SRC.split('?')[1]).get('id') || 'demo';

  // Generate or retrieve visitor ID
  function getVisitorId() {
    let visitorId = localStorage.getItem('remarket_visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem('remarket_visitor_id', visitorId);
    }
    return visitorId;
  }

  // Generate session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem('remarket_session_id');
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).substr(2, 9) + Date.now();
      sessionStorage.setItem('remarket_session_id', sessionId);
    }
    return sessionId;
  }

  // Browser fingerprinting (lightweight)
  function getFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Remarket', 2, 2);

    return {
      canvas: canvas.toDataURL().slice(-50),
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent.slice(0, 100)
    };
  }

  // Parse property information from URL
  function getPropertyInfo() {
    const path = window.location.pathname;
    const propertyMatch = path.match(/\/properties\/([^\/]+)/);

    if (propertyMatch) {
      const slug = propertyMatch[1];
      // Convert slug to readable name (oak-hill -> Oak Hill)
      const name = slug.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      return {
        property_slug: slug,
        property_name: name,
        viewing_property: true
      };
    }

    return { viewing_property: false };
  }

  // Send tracking event
  function track(eventType, data = {}) {
    const propertyInfo = getPropertyInfo();

    const payload = {
      client_id: CLIENT_ID,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      page: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        path: window.location.pathname,
        clean_path: window.location.pathname.split('?')[0] // Remove query params for clean display
      },
      ...propertyInfo,
      ...data
    };

    // Send via beacon API (non-blocking)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_API, JSON.stringify(payload));
    } else {
      // Fallback to fetch
      fetch(TRACK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  }

  // Track page view
  track('pageview', {
    fingerprint: getFingerprint()
  });

  // Track clicks
  document.addEventListener('click', function(e) {
    const target = e.target;

    // Check if clicking on an image or image container
    const isImage = target.tagName === 'IMG' ||
                   target.querySelector('img') ||
                   (target.parentElement && target.parentElement.tagName === 'IMG');

    const data = {
      element: target.tagName,
      text: target.textContent.slice(0, 100),
      href: target.href || null,
      id: target.id || null,
      classes: target.className || null
    };

    // If it's an image, capture the image src
    if (isImage) {
      let imgSrc = null;
      if (target.tagName === 'IMG') {
        imgSrc = target.src;
      } else if (target.querySelector('img')) {
        imgSrc = target.querySelector('img').src;
      } else if (target.parentElement && target.parentElement.tagName === 'IMG') {
        imgSrc = target.parentElement.src;
      }

      data.image_clicked = true;
      data.image_src = imgSrc;
      data.is_property_image = imgSrc && imgSrc.includes('/images/');
    }

    track('click', { click_data: data });
  }, true);

  // Track form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const formData = new FormData(form);
    const data = {};

    // Capture form fields (but not sensitive data)
    for (let [key, value] of formData.entries()) {
      // Skip password, credit card, SSN fields
      if (!key.match(/password|pwd|pass|cc|cvv|ssn|card/i)) {
        // Only capture email fields for remarketing
        if (key.match(/email|e-mail/i)) {
          data.email = value;
        }
        if (key.match(/name|firstname|lastname/i)) {
          data.name = value;
        }
        if (key.match(/phone|tel/i)) {
          data.phone = value;
        }
      }
    }

    track('form_submit', {
      form_id: form.id || null,
      form_action: form.action || null,
      captured_data: data
    });
  }, true);

  // Track form field focus (for abandoned forms)
  let formFields = {};
  document.addEventListener('focus', function(e) {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const fieldName = target.name || target.id;
      if (fieldName && !fieldName.match(/password|pwd|pass|cc|cvv|ssn/i)) {
        formFields[fieldName] = target.value;
      }
    }
  }, true);

  // Track scroll depth
  let maxScroll = 0;
  window.addEventListener('scroll', function() {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    if (scrollPercent > maxScroll) {
      maxScroll = Math.round(scrollPercent);
      if (maxScroll % 25 === 0) { // Track at 25%, 50%, 75%, 100%
        track('scroll', { depth: maxScroll });
      }
    }
  });

  // Track time on page
  let timeOnPage = 0;
  setInterval(function() {
    timeOnPage += 5;
    if (timeOnPage % 30 === 0) { // Track every 30 seconds
      track('time_on_page', { seconds: timeOnPage });
    }
  }, 5000);

  // Track page exit
  window.addEventListener('beforeunload', function() {
    track('page_exit', {
      time_on_page: timeOnPage,
      max_scroll: maxScroll,
      abandoned_form_data: Object.keys(formFields).length > 0 ? formFields : null
    });
  });

  // Automatic visitor identification (on every page load)
  function attemptAutoIdentification() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign'),
      utm_content: urlParams.get('utm_content'),
      utm_term: urlParams.get('utm_term')
    };

    // Send identification request
    fetch(IDENTIFY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: getVisitorId(),
        referrer: document.referrer,
        utm_params: utmParams,
        url: window.location.href
      })
    }).then(res => res.json())
      .then(data => {
        if (data.identified) {
          console.log(`🎯 Visitor auto-identified via ${data.source}!`, data);

          // Store identification data
          localStorage.setItem('remarket_identified', JSON.stringify({
            email: data.email,
            name: data.name,
            company: data.company,
            source: data.source,
            confidence: data.confidence,
            timestamp: new Date().toISOString()
          }));

          // Send identify event
          track('auto_identify', {
            user_data: {
              email: data.email,
              name: data.name,
              company: data.company
            },
            identification_source: data.source,
            confidence: data.confidence
          });
        } else {
          console.log('ℹ️  Visitor not yet identified. Methods attempted:', data.methods_attempted);
        }
      })
      .catch(err => console.error('Auto-identification error:', err));
  }

  // Run auto-identification on load
  attemptAutoIdentification();

  // Expose public API
  window.RemarketAI = {
    track: track,
    identify: function(userData) {
      localStorage.setItem('remarket_user_data', JSON.stringify(userData));
      track('identify', { user_data: userData });
    },
    getVisitorId: getVisitorId,
    attemptIdentification: attemptAutoIdentification
  };

  console.log('✅ Remarket AI tracking initialized');
})();
