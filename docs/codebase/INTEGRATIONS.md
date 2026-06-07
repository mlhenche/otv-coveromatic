# External Integrations

**Analysis Date:** 2026-03-08 · **Updated:** 2026-06-07 (corte de Supabase, repo aplanado)

## APIs & External Services

**Content Metadata:**
- TMDB (The Movie Database) — search for movies, TV shows, people; fetch credits, seasons, episodes
  - SDK/Client: raw `fetch()` in `src/ui/hooks/useTMDB.ts`
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
  - URL patterns hardcoded in `src/ui/hooks/useCatalog.ts`
  - Image types:
    - Portrait: `/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160`
    - Landscape: `/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160`
    - Background (VPS/Slideshow): `/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160`
    - Title Treatment: `/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720`
    - EPG: `/epg/COVER/...` (fetched in UI iframe, bytes sent to Figma sandbox)

**Catalog (GitHub raw):**
- The content catalog is a static JSON file served from GitHub raw.
  - URL: `https://raw.githubusercontent.com/mlhenche/otv-coveromatic/main/catalog/otv-catalog.json`
  - Loaded by `src/ui/hooks/useCatalog.ts`, cached 4h via React Query.
  - Generated/merged locally by `catalog/extract-catalog-v2.js`; genres added by `scripts/export-static-catalog.js`.
  - See `docs/adr/0001-catalogo-github-raw.md` and `docs/adr/0002-corte-supabase.md`.

## Data Storage

**Databases:**
- None. The catalog is a static JSON (GitHub raw). Supabase was removed — see `docs/adr/0002-corte-supabase.md`. The old DDL is kept at `supabase/schema.sql` for historical reference only.

**File Storage:**
- None — images served from OTV CDN and TMDB CDN directly; no file uploads

**Caching:**
- `figma.clientStorage` — TMDB API key persisted per user device (`load-api-key` / `save-api-key` messages in `src/code.ts`)
- `@tanstack/react-query` in-memory cache — catalog cached with `staleTime: 4h` (`src/ui/hooks/useCatalog.ts`)

## Authentication & Identity

**Auth Provider:**
- None — no user authentication in the plugin
- The plugin uses no credentials at runtime (catalog is public GitHub raw)
- TMDB API key stored per-user in `figma.clientStorage` (user enters it once via the plugin Header)

## Monitoring & Observability

**Error Tracking:** None — no external error tracking service

**Logs:**
- In-plugin log panel: `src/ui/components/LogPanel.tsx` and `src/ui/components/LogStore.ts`
- Errors surfaced via `FooterLog` (`src/ui/components/FooterLog.tsx`)
- CLI scripts log to stdout/stderr with emoji prefixes

## CI/CD & Deployment

**Hosting:**
- Figma plugin (no server hosting) — distributed as local plugin loaded from `plugin/manifest.json`
- No Figma plugin store listing detected

**CI Pipeline:** None — no CI configuration found

## Webhooks & Callbacks

- None (all communication is request/response via `fetch`)

## Network Access

**Declared in `plugin/manifest.json`:**
```json
"networkAccess": {
  "allowedDomains": [
    "https://api.themoviedb.org",
    "https://image.tmdb.org",
    "https://pc.orangetv.orange.es",
    "https://raw.githubusercontent.com"
  ]
}
```
All network calls from the UI iframe use this allowlist. The plugin sandbox (`code.js`) cannot make network calls — it receives image bytes from the UI via `postMessage`.

## Environment Configuration

**Required for CLI scripts (not needed for the plugin):**
- `TMDB_API_KEY` — for enrichment scripts (`enrich-catalog.js`, `add-content.js`). See `.env.example`.

**Plugin runtime keys:**
- TMDB API key: entered by the user in the plugin Header, stored in `figma.clientStorage`. No other credentials.

---

*Integration audit: 2026-03-08 · Updated 2026-06-07*
