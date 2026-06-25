const geoip = require('geoip-lite');

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function normalizeIp(ip) {
  if (!ip) return null;
  const trimmed = String(ip).trim();
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  if (trimmed === '::1') return '127.0.0.1';
  return trimmed;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

function countryName(code) {
  if (!code) return null;
  try {
    return countryNames.of(code) || code;
  } catch {
    return code;
  }
}

function lookupGeo(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized || isPrivateIp(normalized)) {
    return {
      country: null,
      countryCode: null,
      city: null,
      region: null,
    };
  }

  const geo = geoip.lookup(normalized);
  if (!geo) {
    return {
      country: null,
      countryCode: null,
      city: null,
      region: null,
    };
  }

  const code = geo.country || null;
  return {
    country: countryName(code),
    countryCode: code,
    city: geo.city || null,
    region: geo.region || null,
  };
}

function formatLocation(row) {
  const parts = [];
  if (row.city) parts.push(row.city);
  if (row.countryCode) parts.push(row.countryCode);
  else if (row.country) parts.push(row.country);
  return parts.length ? parts.join(', ') : '—';
}

module.exports = { lookupGeo, normalizeIp, formatLocation };
