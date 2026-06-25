const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDb, getDbStatus, recordClick, listClicks, summaryStats, listSites } = require('./db');

const PORT = process.env.PORT || 3847;
const app = express();

app.use(cors({ origin: true, credentials: false }));
app.options('/api/track', cors({ origin: true }));
app.use(express.json({ limit: '32kb' }));
app.use(express.text({ type: ['text/plain', 'application/json'], limit: '32kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const pagesDir = path.join(__dirname, '..', '..', 'eid');
if (fs.existsSync(pagesDir)) {
  app.use('/pages', express.static(pagesDir));
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'tracker-cta')).digest('hex').slice(0, 16);
}

function parseFilters(query) {
  return {
    site: query.site || undefined,
    page: query.page || undefined,
    ctaId: query.ctaId || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
    limit: Math.min(parseInt(query.limit, 10) || 100, 500),
    offset: parseInt(query.offset, 10) || 0,
  };
}

function buildClickRow(body, req) {
  const site = String(body.site || '').trim();
  const page = String(body.page || '').trim();
  const ctaId = String(body.ctaId || '').trim();

  if (!site || !page || !ctaId) {
    return { error: 'site, page, and ctaId are required' };
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  return {
    id: randomUUID(),
    clickedAt: body.clickedAt || new Date().toISOString(),
    site,
    page,
    pageUrl: body.pageUrl || null,
    pageTitle: body.pageTitle || null,
    ctaId,
    ctaLabel: body.ctaLabel || null,
    ctaHref: body.ctaHref || null,
    ctaIndex: body.ctaIndex != null ? Number(body.ctaIndex) : null,
    sessionId: body.sessionId || null,
    visitorId: body.visitorId || null,
    referrer: body.referrer || null,
    userAgent: body.userAgent || req.headers['user-agent'] || null,
    language: body.language || null,
    screenWidth: body.screenWidth != null ? Number(body.screenWidth) : null,
    screenHeight: body.screenHeight != null ? Number(body.screenHeight) : null,
    viewportWidth: body.viewportWidth != null ? Number(body.viewportWidth) : null,
    viewportHeight: body.viewportHeight != null ? Number(body.viewportHeight) : null,
    utmSource: body.utmSource || null,
    utmMedium: body.utmMedium || null,
    utmCampaign: body.utmCampaign || null,
    utmContent: body.utmContent || null,
    utmTerm: body.utmTerm || null,
    queryString: body.queryString || null,
    ipHash: hashIp(ip),
  };
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'TrackerCTA' });
});

app.get('/api/status', async (_req, res) => {
  const db = await getDbStatus();
  res.json({
    ok: db.connected,
    storage: 'mongodb',
    mongodb: db,
    nodeEnv: process.env.NODE_ENV || 'development',
    uptimeSec: Math.floor(process.uptime()),
  });
});

app.post('/api/track', async (req, res) => {
  const body = parseBody(req);
  const row = buildClickRow(body, req);

  if (row.error) {
    return res.status(400).json({ error: row.error });
  }

  try {
    await recordClick(row);
    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    console.error('track error', err);
    res.status(500).json({ error: 'failed to record click' });
  }
});

app.get('/api/track/pixel', async (req, res) => {
  const row = buildClickRow(req.query, req);

  if (!row.error) {
    try {
      await recordClick(row);
    } catch (err) {
      console.error('pixel track error', err);
    }
  }

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.type('image/gif').send(PIXEL_GIF);
});

app.get('/api/clicks', async (req, res) => {
  try {
    const result = await listClicks(parseFilters(req.query));
    res.json(result);
  } catch (err) {
    console.error('list clicks error', err);
    res.status(500).json({ error: 'failed to load clicks' });
  }
});

app.get('/api/stats/summary', async (req, res) => {
  try {
    const { site, page, from, to } = parseFilters(req.query);
    res.json(await summaryStats({ site, page, from, to }));
  } catch (err) {
    console.error('summary error', err);
    res.status(500).json({ error: 'failed to load stats' });
  }
});

app.get('/api/sites', async (_req, res) => {
  try {
    res.json(await listSites());
  } catch (err) {
    console.error('sites error', err);
    res.status(500).json({ error: 'failed to load sites' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

async function start() {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`TrackerCTA running at http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/`);
    if (fs.existsSync(pagesDir)) {
      console.log(`Test pages: http://localhost:${PORT}/pages/altv2safe.html`);
    }
    console.log(`Tracker script: http://localhost:${PORT}/tracker.js`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
