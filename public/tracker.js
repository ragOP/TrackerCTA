(function (window, document) {
  'use strict';

  var cfg = window.TrackerCTAConfig || {};
  var endpoint = (cfg.endpoint || 'http://localhost:3847').replace(/\/$/, '');
  var site = cfg.site || window.location.hostname;
  var page = cfg.page || (window.location.pathname.split('/').pop() || 'index.html');
  var selector = cfg.selector || 'a[data-cta-id], a.cta-primary, button[data-cta-id]';
  var debug = cfg.debug !== false && (cfg.debug || location.protocol === 'file:' || location.port === '3847');

  function log() {
    if (debug && window.console) console.log.apply(console, ['[TrackerCTA]'].concat([].slice.call(arguments)));
  }

  function warn() {
    if (window.console) console.warn.apply(console, ['[TrackerCTA]'].concat([].slice.call(arguments)));
  }

  function uid() {
    return 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function getVisitorId() {
    try {
      var key = 'tracker_cta_vid';
      var id = localStorage.getItem(key);
      if (!id) {
        id = uid();
        localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return uid();
    }
  }

  function getSessionId() {
    try {
      var key = 'tracker_cta_sid';
      var id = sessionStorage.getItem(key);
      if (!id) {
        id = uid();
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return uid();
    }
  }

  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {
      return null;
    }
  }

  function getUtm() {
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || null,
      utmMedium: params.get('utm_medium') || null,
      utmCampaign: params.get('utm_campaign') || null,
      utmContent: params.get('utm_content') || null,
      utmTerm: params.get('utm_term') || null,
      queryString: window.location.search ? window.location.search.slice(1) : null,
    };
  }

  function ctaLabel(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll('.arr, svg, img').forEach(function (n) { n.remove(); });
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function resolveCtaId(el, index) {
    if (el.getAttribute('data-cta-id')) return el.getAttribute('data-cta-id');
    var section = el.closest('[id]');
    if (section && section.id) return section.id + '-cta';
    return 'cta-' + (index + 1);
  }

  function pixelSend(payload) {
    var params = new URLSearchParams();
    Object.keys(payload).forEach(function (key) {
      if (payload[key] != null && payload[key] !== '') {
        params.set(key, String(payload[key]));
      }
    });
    var img = new Image();
    img.src = endpoint + '/api/track/pixel?' + params.toString();
    log('sent via pixel', payload.ctaId);
  }

  function send(payload) {
    var url = endpoint + '/api/track';
    var body = JSON.stringify(payload);

    if (typeof fetch === 'function' && location.protocol !== 'file:') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
      }).then(function (res) {
        if (res.ok) {
          log('sent via fetch', payload.ctaId);
        } else {
          warn('fetch failed', res.status, '- trying pixel');
          pixelSend(payload);
        }
      }).catch(function (err) {
        warn('fetch error', err, '- trying pixel');
        pixelSend(payload);
      });
      return;
    }

    if (navigator.sendBeacon) {
      var ok = navigator.sendBeacon(url, body);
      if (ok) {
        log('sent via beacon', payload.ctaId);
        return;
      }
    }

    pixelSend(payload);
  }

  function trackClick(el, index) {
    var utm = getUtm();
    var payload = {
      clickedAt: new Date().toISOString(),
      site: site,
      page: page,
      pageUrl: window.location.href,
      pageTitle: document.title,
      ctaId: resolveCtaId(el, index),
      ctaLabel: ctaLabel(el),
      ctaHref: el.getAttribute('href') || null,
      ctaIndex: index,
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      language: navigator.language || null,
      screenWidth: window.screen ? window.screen.width : null,
      screenHeight: window.screen ? window.screen.height : null,
      viewportWidth: window.innerWidth || null,
      viewportHeight: window.innerHeight || null,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      utmContent: utm.utmContent,
      utmTerm: utm.utmTerm,
      queryString: utm.queryString,
      timezone: getTimezone(),
    };

    send(payload);
  }

  function bind() {
    var nodes = document.querySelectorAll(selector);
    if (!nodes.length) {
      warn('no CTAs found for selector:', selector);
      return;
    }

    nodes.forEach(function (el, index) {
      if (el.dataset.trackerCtaBound === '1') return;
      el.dataset.trackerCtaBound = '1';
      el.addEventListener('click', function () {
        trackClick(el, index);
      }, { capture: true });
    });

    log('ready —', nodes.length, 'CTA(s) on', site + '/' + page, '| endpoint:', endpoint);
    if (location.protocol === 'file:') {
      warn('Opened via file:// — use http://localhost:3847/pages/' + page + ' for reliable tracking');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.TrackerCTA = { trackClick: trackClick, bind: bind };
})(window, document);
