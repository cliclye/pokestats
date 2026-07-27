# PokeStats

Live **stock map** across major US Pokémon TCG retailers (plus vending pins) and a **TCG price browser** powered by the free [Pokémon TCG API](https://docs.pokemontcg.io/).

Runs at **$0** on free tiers: local JSON store by default, optional free Supabase, Vercel Hobby, GitHub Actions cron.

## Features

1. **Stock map** (`/map`)
   - Nationwide pins for Target, Walmart, Best Buy, GameStop, Pokémon Center, and Pokémon vending machines (thousands of locations)
   - Clustered MapLibre map for performance at scale
   - Data from OpenStreetMap + AllThePlaces + open vending GeoJSON (`npm run import:locations` / `npm run import:locations:osm`)
   - Online availability pollers (public product/fulfillment endpoints + HTML signals)
   - **Web scrapes** of NowInStock Pokémon pages + public restock post archives
   - Community “I was here” check-ins with confidence that decays over ~6 hours
   - Every pin shows **source + freshness** (Online / Web scrape / Community / Location only)

2. **Prices** (`/prices`)
   - Search bar for card lookup
   - Browse by set/pack
   - Market / low / mid / high from TCGPlayer via pokemontcg.io
   - Sync job refreshes catalog every few hours

## Quick start (free)

```bash
npm install
npm run seed
npm run import:locations      # Target (AllThePlaces) + Pokémon vending (~thousands)
npm run import:locations:osm  # Walmart / Best Buy / GameStop via OpenStreetMap (slow, resumable)
npm run sync:prices   # optional free key improves rate limits
npm run sync:stock    # polite retailer polls (~minutes)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional free API keys

Copy `.env.example` → `.env.local`:

| Variable | Where | Cost |
|----------|--------|------|
| `POKEMONTCG_API_KEY` | [dev.pokemontcg.io](https://dev.pokemontcg.io/) | Free |
| `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase free project | Free |
| `JOBS_SECRET` | Any random string for `/api/jobs/run` | — |

Without Supabase, all data lives in `data/store.json`.

### Manual job trigger (local / Vercel)

```bash
curl -X POST http://localhost:3000/api/jobs/run \
  -H "Content-Type: application/json" \
  -H "x-jobs-secret: dev-local-secret" \
  -d '{"job":"stock"}'
```

```bash
curl -X POST http://localhost:3000/api/jobs/run \
  -H "Content-Type: application/json" \
  -H "x-jobs-secret: dev-local-secret" \
  -d '{"job":"prices","setLimit":4}'
```

### GitHub Actions

Workflows in `.github/workflows/` poll stock ~every 10 minutes and sync prices every 4 hours. Add repo secret `POKEMONTCG_API_KEY` (optional but recommended). Artifacts upload `data/store.json` — for production, point jobs at Supabase or a durable store.

## Deploy (public)

1. Create a free Supabase project and apply `supabase/migrations/20260727000000_init.sql`
2. Copy project URL, anon key, and **service role** key into `.env.local`
3. Seed: `npm run push:supabase` (uploads local `data/store.json`)
4. Deploy to Vercel with the same env vars + a strong `JOBS_SECRET`
5. Set GitHub Actions secrets: `APP_URL`, `JOBS_SECRET`, optional `POKEMONTCG_API_KEY`

Without Supabase, all data lives in `data/store.json` (local only — not durable on Vercel).

### Supabase

Schema includes retailers, locations, products, stock snapshots/reports, web signals, card sets/cards, and app meta. Public read via RLS; community reports can insert; server jobs write with the service role key.

## Accuracy (read this)

| Source | Meaning |
|--------|---------|
| Online poll | Buy-button / fulfillment status on the retailer’s site |
| Store API | Store-level availability when the retailer exposes it |
| Community | User shelf/vending report (decays with age) |
| Location only | Pin known; stock unknown |

**There is no public API for true every-minute shelf or vending inventory.** Pollers never invent “in stock” when a retailer blocks the request — status becomes `unknown`. No CAPTCHA bypass or login scraping.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run seed` | Reset/merge location + product seed data (preserves imports) |
| `npm run import:locations` | Import Target (AllThePlaces) + Pokémon vending GeoJSON |
| `npm run import:locations:osm` | Expand Walmart / Best Buy / GameStop via OpenStreetMap |
| `npm run sync:stock` | Poll retailers + scrape public stock/restock pages |
| `npm run sync:signals` | Web-signal scrape only (NowInStock / Reddit archive) |
| `npm run sync:prices` | Pull recent sets/cards + prices |
| `npm run dev` | Next.js dev server |

## Stack

Next.js App Router · TypeScript · Tailwind · MapLibre + OSM · pokemontcg.io · optional Supabase · GitHub Actions
