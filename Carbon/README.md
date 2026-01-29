# Carbon — Vercel-ready (Jan 2026 deps) + optional Postgres API

## 1) Install & run
```bash
npm install
npm run dev
```

## 2) Environment variables
### Gemini (client-side, Vite)
Set in Vercel Project → Settings → Environment Variables:
- VITE_GEMINI_API_KEY=...

### Database (server-side only)
Set in Vercel:
- DATABASE_URL=postgres://...
- (optional) PGSSLMODE=disable  # only if your DB does NOT require SSL

> Do NOT prefix DATABASE_URL with VITE_. Keep it server-only.

## 3) Create the table
Run this once in your Postgres DB:

```sql
create table if not exists carbon_entries (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  feeling text not null,
  intensity text not null,
  medium text not null,
  pressure_style text not null,
  prompt text not null,
  draft text not null
);
```

## 4) API endpoints
- GET  /api/health
- GET  /api/entries
- POST /api/entries   (JSON body: feeling, intensity, medium, pressureStyle, prompt, draft)

## 5) Deploy
Push to GitHub → Import on Vercel → add env vars → Deploy.


## Cloud storage wired in UI
The app now supports **Local** (default) and **Cloud** storage.

- Local: uses browser localStorage.
- Cloud: uses Vercel Functions:
  - GET /api/entries
  - POST /api/entries

If Cloud is selected but the API/DB isn't configured, the app will automatically fall back to Local and show a status message in the header.
