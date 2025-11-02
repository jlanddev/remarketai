/**
 * Remarket AI - Universal Tracking Script
 * Lightweight visitor tracking and behavior analysis
 */

(function() {
  'use strict';

  // Configuration
  const TRACK_API = 'http://localhost:3003/api/track';
  const CLIENT_ID = new URLSearchParams(document.currentScript.src.split('?')[1]).get('id') || 'demo';

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

  // Send tracking event
  function track(eventType, data = {}) {
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
        path: window.location.pathname
      },
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
    const data = {
      element: target.tagName,
      text: target.textContent.slice(0, 100),
      href: target.href || null,
      id: target.id || null,
      classes: target.className || null
    };

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
    fetch('http://localhost:3003/api/identify', {
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
