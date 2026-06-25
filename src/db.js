const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'trackercta';
const COLLECTION = 'clicks';

let client;
let collection;

function mapRowToDoc(row) {
  return {
    id: row.id,
    clicked_at: row.clickedAt,
    site: row.site,
    page: row.page,
    page_url: row.pageUrl ?? null,
    page_title: row.pageTitle ?? null,
    cta_id: row.ctaId,
    cta_label: row.ctaLabel ?? null,
    cta_href: row.ctaHref ?? null,
    cta_index: row.ctaIndex ?? null,
    session_id: row.sessionId ?? null,
    visitor_id: row.visitorId ?? null,
    referrer: row.referrer ?? null,
    user_agent: row.userAgent ?? null,
    language: row.language ?? null,
    screen_width: row.screenWidth ?? null,
    screen_height: row.screenHeight ?? null,
    viewport_width: row.viewportWidth ?? null,
    viewport_height: row.viewportHeight ?? null,
    utm_source: row.utmSource ?? null,
    utm_medium: row.utmMedium ?? null,
    utm_campaign: row.utmCampaign ?? null,
    utm_content: row.utmContent ?? null,
    utm_term: row.utmTerm ?? null,
    query_string: row.queryString ?? null,
    ip_hash: row.ipHash ?? null,
    country: row.country ?? null,
    country_code: row.countryCode ?? null,
    city: row.city ?? null,
    region: row.region ?? null,
    timezone: row.timezone ?? null,
    created_at: new Date(),
  };
}

function buildMatch({ site, page, ctaId, country, from, to } = {}) {
  const match = {};
  if (site) match.site = site;
  if (page) match.page = page;
  if (ctaId) match.cta_id = ctaId;
  if (country) match.country_code = country.toUpperCase();
  if (from || to) {
    match.clicked_at = {};
    if (from) match.clicked_at.$gte = from;
    if (to) match.clicked_at.$lte = to;
  }
  return match;
}

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  client = new MongoClient(uri);
  await client.connect();
  collection = client.db(DB_NAME).collection(COLLECTION);

  await collection.createIndex({ site: 1, page: 1 });
  await collection.createIndex({ cta_id: 1 });
  await collection.createIndex({ clicked_at: -1 });
  await collection.createIndex({ session_id: 1 });
  await collection.createIndex({ country_code: 1 });
  await collection.createIndex({ city: 1 });
  await collection.createIndex({ id: 1 }, { unique: true });

  console.log(`MongoDB connected: ${DB_NAME}.${COLLECTION}`);
}

async function getDbStatus() {
  if (!collection) {
    return { connected: false, error: 'not connected' };
  }
  try {
    await client.db(DB_NAME).command({ ping: 1 });
    const total = await collection.countDocuments();
    return { connected: true, database: DB_NAME, collection: COLLECTION, totalClicks: total };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function recordClick(row) {
  await collection.insertOne(mapRowToDoc(row));
  return row.id;
}

async function listClicks({ site, page, ctaId, country, from, to, limit = 100, offset = 0 } = {}) {
  const filter = buildMatch({ site, page, ctaId, country, from, to });
  const [total, rows] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter, { projection: { _id: 0 } })
      .sort({ clicked_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
  ]);
  return { total, rows };
}

async function summaryStats({ site, page, country, from, to } = {}) {
  const match = buildMatch({ site, page, country, from, to });

  const [totals, byPage, byCta, byCountry, byCity, timeline] = await Promise.all([
    collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sessions: { $addToSet: '$session_id' },
          visitors: { $addToSet: '$visitor_id' },
        },
      },
      {
        $project: {
          total: 1,
          uniqueSessions: {
            $size: {
              $filter: { input: '$sessions', as: 's', cond: { $and: [{ $ne: ['$$s', null] }, { $ne: ['$$s', ''] }] } },
            },
          },
          uniqueVisitors: {
            $size: {
              $filter: { input: '$visitors', as: 'v', cond: { $and: [{ $ne: ['$$v', null] }, { $ne: ['$$v', ''] }] } },
            },
          },
        },
      },
    ]).toArray(),

    collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: { site: '$site', page: '$page' },
          clicks: { $sum: 1 },
          sessions: { $addToSet: '$session_id' },
          visitors: { $addToSet: '$visitor_id' },
        },
      },
      {
        $project: {
          site: '$_id.site',
          page: '$_id.page',
          clicks: 1,
          sessions: {
            $size: {
              $filter: { input: '$sessions', as: 's', cond: { $and: [{ $ne: ['$$s', null] }, { $ne: ['$$s', ''] }] } },
            },
          },
          visitors: {
            $size: {
              $filter: { input: '$visitors', as: 'v', cond: { $and: [{ $ne: ['$$v', null] }, { $ne: ['$$v', ''] }] } },
            },
          },
        },
      },
      { $sort: { clicks: -1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: { site: '$site', page: '$page', cta_id: '$cta_id', cta_label: '$cta_label' },
          clicks: { $sum: 1 },
          sessions: { $addToSet: '$session_id' },
        },
      },
      {
        $project: {
          site: '$_id.site',
          page: '$_id.page',
          cta_id: '$_id.cta_id',
          cta_label: '$_id.cta_label',
          clicks: 1,
          sessions: {
            $size: {
              $filter: { input: '$sessions', as: 's', cond: { $and: [{ $ne: ['$$s', null] }, { $ne: ['$$s', ''] }] } },
            },
          },
        },
      },
      { $sort: { clicks: -1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: { ...match, country_code: { $ne: null } } },
      {
        $group: {
          _id: { country_code: '$country_code', country: '$country' },
          clicks: { $sum: 1 },
          sessions: { $addToSet: '$session_id' },
        },
      },
      {
        $project: {
          country_code: '$_id.country_code',
          country: '$_id.country',
          clicks: 1,
          sessions: {
            $size: {
              $filter: { input: '$sessions', as: 's', cond: { $and: [{ $ne: ['$$s', null] }, { $ne: ['$$s', ''] }] } },
            },
          },
        },
      },
      { $sort: { clicks: -1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: { ...match, city: { $ne: null } } },
      {
        $group: {
          _id: { city: '$city', country_code: '$country_code', country: '$country' },
          clicks: { $sum: 1 },
        },
      },
      {
        $project: {
          city: '$_id.city',
          country_code: '$_id.country_code',
          country: '$_id.country',
          clicks: 1,
          _id: 0,
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]).toArray(),

    collection.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $substr: ['$clicked_at', 0, 10] },
          clicks: { $sum: 1 },
        },
      },
      { $project: { day: '$_id', clicks: 1, _id: 0 } },
      { $sort: { day: -1 } },
      { $limit: 30 },
    ]).toArray(),
  ]);

  const t = totals[0] || { total: 0, uniqueSessions: 0, uniqueVisitors: 0 };
  return {
    total: t.total,
    uniqueSessions: t.uniqueSessions,
    uniqueVisitors: t.uniqueVisitors,
    byPage,
    byCta,
    byCountry,
    byCity,
    timeline,
  };
}

async function listSites() {
  return collection.aggregate([
    {
      $group: {
        _id: { site: '$site', page: '$page' },
        clicks: { $sum: 1 },
        last_click: { $max: '$clicked_at' },
      },
    },
    {
      $project: {
        site: '$_id.site',
        page: '$_id.page',
        clicks: 1,
        last_click: 1,
        _id: 0,
      },
    },
    { $sort: { last_click: -1 } },
  ]).toArray();
}

module.exports = { connectDb, getDbStatus, recordClick, listClicks, summaryStats, listSites };
