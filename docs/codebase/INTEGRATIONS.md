# External Integrations

**Analysis Date:** 2026-03-08

## APIs & External Services

**Content Metadata:**
- TMDB (The Movie Database) — search for movies, TV shows, people; fetch credits, seasons, episodes
  - SDK/Client: raw `fetch()` in `v3/src/ui/hooks/useTMDB.ts`
  - Auth: API key passed as query param `?api_key={key}` (no Bearer token)
  - Base URL: `https://api.themoviedb.org/3`
  - Language: `es-ES` on all requests
  - Endpoints used:
    - `GET /search/person` — person search by name
    - `GET /trending/person/week` — default people list
    - `GET /search/multi` — multi-search (movies + TV)
    - `GET /{movie|tv}/{id}/credits` — cast and crew
    - `GET /tv/{id}` — TV show details (seasons list)
    - `GET /tv/{id}/season/{n}` — season details (episodes)
  - Images: `https://image.tmdb.org` (poster/profile paths from API responses)

**OTV Image CDN:**
- Orange TV image server — cover art, vertical posters, backgrounds, title treatments
  - No auth required — public URLs
  - Base URL: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod`
  - URL patterns stored in Supabase `config` table (key: `url_patterns`), with hardcoded fallbacks in `v3/src/ui/hooks/useSupabaseCatalog.ts`
  - Image types:
    - Portrait: `/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160`
    - Landscape: `/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160`
    - Background (VPS/Slideshow): `/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160`
    - Title Treatment: `/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720`
    - EPG: `/epg/COVER/...` (fetched in UI iframe, bytes sent to Figma sandbox)

## Data Storage

**Databases:**
- Supabase (PostgreSQL) — content catalog, genre names, URL config
  - Connection: URL hardcoded in `v3/src/ui/hooks/useSupabaseCatalog.ts` (`https://zmzehngquxtqirpjxyhn.supabase.co`)
  - Client: raw `fetch()` against Supabase REST API (no `@supabase/supabase-js` SDK)
  - Auth in plugin: anon key hardcoded in `useSupabaseCatalog.ts` (read-only; secured by RLS policies)
  - Auth in CLI scripts: service role key via `SUPABASE_SERVICE_KEY` env var
  - Tables:
    - `contents` — OTV content catalog (529 active entries as of 2026-02-23)
    - `genres` — TMDB genre ID → Spanish name mapping
    - `config` — JSON config (url_patterns, provider_map)
  - Schema: `v3/supabase/schema.sql`
  - RLS: public SELECT on all tables; INSERT/UPDATE/DELETE requires authenticated role

**File Storage:**
- None — images served from OTV CDN and TMDB CDN directly; no file uploads

**Caching:**
- `figma.clientStorage` — TMDB API key persisted per user device (read/write via `load-api-key` / `save-api-key` plugin messages in `v3/src/code.ts`)
- `@tanstack/react-query` in-memory cache — Supabase catalog cached with `staleTime: 4h` (`v3/src/ui/hooks/useSupabaseCatalog.ts`)

## Authentication & Identity

**Auth Provider:**
- None — no user authentication in the plugin
- Supabase anon key is the only credential in the plugin (public/read-only by design)
- TMDB API key stored per-user in `figma.clientStorage` (user must enter it once via the plugin Header)

## Monitoring & Observability

**Error Tracking:**
- None — no external error tracking service

**Logs:**
- In-plugin log panel: `v3/src/ui/components/LogPanel.tsx` and `v3/src/ui/components/LogStore.ts`
- Errors surfaced in plugin UI via `FooterLog` component (`v3/src/ui/components/FooterLog.tsx`)
- CLI scripts log to stdout/stderr with emoji prefixes

## CI/CD & Deployment

**Hosting:**
- Figma plugin (no server hosting) — distributed as local plugin loaded from `v3/plugin/manifest.json`
- No Figma plugin store listing detected

**CI Pipeline:**
- None — no CI configuration found

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None — all communication is request/response (fetch)

## Network Access

**Declared in `v3/plugin/manifest.json`:**
```json
"networkAccess": {
  "allowedDomains": [
    "https://api.themoviedb.org",
    "https://image.tmdb.org",
    "https://pc.orangetv.orange.es",
    "https://zmzehngquxtqirpjxyhn.supabase.co"
  ]
}
```
All network calls from the UI iframe use this allowlist. The plugin sandbox (`code.js`) cannot make network calls — it receives image bytes from the UI via `postMessage`.

## Environment Configuration

**Required for CLI scripts (not needed for plugin itself):**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — service role key (INSERT/UPDATE/DELETE)
- `TMDB_API_KEY` — for enrichment scripts (`enrich-catalog.js`, `sync-to-supabase.js`)

**Plugin runtime keys:**
- TMDB API key: entered by user in plugin Header, stored in `figma.clientStorage`
- Supabase anon key: hardcoded in `v3/src/ui/hooks/useSupabaseCatalog.ts`

---

*Integration audit: 2026-03-08*
