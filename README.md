# TrackerCTA

Centralized CTA click tracking for any website and page path. One Node.js backend — add the snippet to any landing page.

## Quick start

```bash
cd TrackerCTA
npm install
npm start
```

- **Dashboard:** http://localhost:3847/
- **Tracker script:** http://localhost:3847/tracker.js
- **API:** `POST http://localhost:3847/api/track`

## Add to any page

```html
<script>
  window.TrackerCTAConfig = {
    endpoint: 'http://localhost:3847',   // your TrackerCTA server URL
    site: 'verbraucherfokus-test.de',    // logical site name
    page: 'altv2opt.html',               // page path / filename
    debug: false                         // set true to log in console
  };
</script>
<script src="http://localhost:3847/tracker.js" defer></script>
```

Mark each CTA with a stable ID (recommended):

```html
<a href="https://trk.example.com/click"
   class="cta cta-primary"
   data-cta-id="winner-card-shop"
   target="_blank">Zum Shop →</a>
```

If `data-cta-id` is omitted, the tracker auto-assigns IDs from parent section `id` or `cta-1`, `cta-2`, etc.

## What gets recorded

| Field | Description |
|-------|-------------|
| `site` / `page` | Which website and path |
| `ctaId` / `ctaLabel` / `ctaHref` | Which button and where it links |
| `clickedAt` | ISO timestamp |
| `sessionId` / `visitorId` | Anonymous session & returning visitor |
| `referrer`, UTM params | Traffic source |
| `userAgent`, screen/viewport | Device context |

## API

### `POST /api/track`

```json
{
  "site": "verbraucherfokus-test.de",
  "page": "altv2opt.html",
  "ctaId": "sticky-bar",
  "ctaLabel": "Zum Angebot",
  "ctaHref": "https://trk.connectbenefit.online/click"
}
```

### `GET /api/stats/summary?site=&page=&from=&to=`

Aggregated totals, breakdown by page and CTA.

### `GET /api/clicks?site=&page=&ctaId=&limit=100`

Raw click log (newest first).

## Production

1. Deploy TrackerCTA to a server (Railway, VPS, etc.).
2. Set `endpoint` in each page's `TrackerCTAConfig` to your public URL.
3. Optionally set `IP_SALT` env var for IP hashing.

Data is stored in `data/clicks.db` (SQLite). On Render, use the persistent disk path via `DATA_DIR`.

## Deploy on Render

1. Push this repo to GitHub (see below).
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect the `TrackerCTA` GitHub repo — Render reads `render.yaml` automatically.
4. Deploy. You get a URL like `https://tracker-cta-xxxx.onrender.com`.
5. Open the dashboard: `https://your-app.onrender.com/`
6. Update landing pages — set `endpoint` in `TrackerCTAConfig`:

```html
<script>
  (function () {
    var base = 'https://your-app.onrender.com';
    window.TrackerCTAConfig = {
      endpoint: base,
      site: 'verbraucherfokus-test.de',
      page: 'altv2safe.html'
    };
    var s = document.createElement('script');
    s.src = base + '/tracker.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

**Notes:**
- `render.yaml` uses the **Starter** plan with a **1 GB persistent disk** so click data survives redeploys.
- Free tier works for testing but SQLite data is wiped on each deploy.
- Health check: `/health`
