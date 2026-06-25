# TrackerCTA

Centralized CTA click tracking for any website and page path. One Node.js backend — add the snippet to any landing page.

**Storage:** MongoDB (clicks survive redeploys on Render).

## Quick start

### 1. MongoDB Atlas (free)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → create free cluster
2. **Database Access** → add user + password
3. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) for Render
4. **Connect** → **Drivers** → copy connection string:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 2. Run locally

```bash
cd TrackerCTA
cp .env.example .env
# Edit .env — paste your MONGODB_URI
npm install
npm start
```

- **Dashboard:** http://localhost:3847/
- **Tracker script:** http://localhost:3847/tracker.js
- **Status:** http://localhost:3847/api/status

## Add to any page

```html
<script>
  (function () {
    var base = 'https://trackercta.onrender.com';
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

<a href="..." class="cta cta-primary" data-cta-id="winner-card-shop">Zum Shop →</a>
```

## Deploy on Render

1. Push repo to GitHub: `ragOP/TrackerCTA`
2. Render → your **tracker-cta** service → **Environment**
3. Add env var:
   - `MONGODB_URI` = your Atlas connection string
   - `MONGODB_DB` = `trackercta` (optional)
4. Redeploy

Clicks are stored in MongoDB Atlas — **not lost on redeploy**.

**Health:** `/health` · **DB status:** `/api/status`

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/track` | Record a CTA click |
| `GET /api/track/pixel?...` | Pixel fallback |
| `GET /api/stats/summary` | Totals + breakdown by page/CTA |
| `GET /api/clicks` | Raw click log |
