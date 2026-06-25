const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'clicks.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS clicks (
    id TEXT PRIMARY KEY,
    clicked_at TEXT NOT NULL,
    site TEXT NOT NULL,
    page TEXT NOT NULL,
    page_url TEXT,
    page_title TEXT,
    cta_id TEXT NOT NULL,
    cta_label TEXT,
    cta_href TEXT,
    cta_index INTEGER,
    session_id TEXT,
    visitor_id TEXT,
    referrer TEXT,
    user_agent TEXT,
    language TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    query_string TEXT,
    ip_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_clicks_site_page ON clicks(site, page);
  CREATE INDEX IF NOT EXISTS idx_clicks_cta_id ON clicks(cta_id);
  CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);
  CREATE INDEX IF NOT EXISTS idx_clicks_session ON clicks(session_id);
`);

const insertClick = db.prepare(`
  INSERT INTO clicks (
    id, clicked_at, site, page, page_url, page_title,
    cta_id, cta_label, cta_href, cta_index,
    session_id, visitor_id, referrer, user_agent, language,
    screen_width, screen_height, viewport_width, viewport_height,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    query_string, ip_hash
  ) VALUES (
    @id, @clickedAt, @site, @page, @pageUrl, @pageTitle,
    @ctaId, @ctaLabel, @ctaHref, @ctaIndex,
    @sessionId, @visitorId, @referrer, @userAgent, @language,
    @screenWidth, @screenHeight, @viewportWidth, @viewportHeight,
    @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm,
    @queryString, @ipHash
  )
`);

function recordClick(row) {
  insertClick.run(row);
  return row.id;
}

function listClicks({ site, page, ctaId, from, to, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = {};

  if (site) { where.push('site = @site'); params.site = site; }
  if (page) { where.push('page = @page'); params.page = page; }
  if (ctaId) { where.push('cta_id = @ctaId'); params.ctaId = ctaId; }
  if (from) { where.push('clicked_at >= @from'); params.from = from; }
  if (to) { where.push('clicked_at <= @to'); params.to = to; }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM clicks ${clause}`);
  const rowsStmt = db.prepare(`
    SELECT * FROM clicks ${clause}
    ORDER BY clicked_at DESC
    LIMIT @limit OFFSET @offset
  `);

  const total = countStmt.get(params).total;
  const rows = rowsStmt.all({ ...params, limit, offset });
  return { total, rows };
}

function summaryStats({ site, page, from, to } = {}) {
  const where = [];
  const params = {};

  if (site) { where.push('site = @site'); params.site = site; }
  if (page) { where.push('page = @page'); params.page = page; }
  if (from) { where.push('clicked_at >= @from'); params.from = from; }
  if (to) { where.push('clicked_at <= @to'); params.to = to; }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM clicks ${clause}`).get(params).n;
  const uniqueSessions = db.prepare(`SELECT COUNT(DISTINCT session_id) AS n FROM clicks ${clause}`).get(params).n;
  const uniqueVisitors = db.prepare(`SELECT COUNT(DISTINCT visitor_id) AS n FROM clicks ${clause}`).get(params).n;

  const byPage = db.prepare(`
    SELECT site, page, COUNT(*) AS clicks,
           COUNT(DISTINCT session_id) AS sessions,
           COUNT(DISTINCT visitor_id) AS visitors
    FROM clicks ${clause}
    GROUP BY site, page
    ORDER BY clicks DESC
  `).all(params);

  const byCta = db.prepare(`
    SELECT site, page, cta_id, cta_label, COUNT(*) AS clicks,
           COUNT(DISTINCT session_id) AS sessions
    FROM clicks ${clause}
    GROUP BY site, page, cta_id, cta_label
    ORDER BY clicks DESC
  `).all(params);

  const timeline = db.prepare(`
    SELECT date(clicked_at) AS day, COUNT(*) AS clicks
    FROM clicks ${clause}
    GROUP BY date(clicked_at)
    ORDER BY day DESC
    LIMIT 30
  `).all(params);

  return { total, uniqueSessions, uniqueVisitors, byPage, byCta, timeline };
}

function listSites() {
  return db.prepare(`
    SELECT site, page, COUNT(*) AS clicks, MAX(clicked_at) AS last_click
    FROM clicks
    GROUP BY site, page
    ORDER BY last_click DESC
  `).all();
}

module.exports = { db, recordClick, listClicks, summaryStats, listSites };
