# Technology Stack

**Analysis Date:** 2026-03-08

## Languages

**Primary:**
- TypeScript 5.9.x — all plugin source code in `v3/src/`
- JavaScript (CommonJS) — CLI scripts in `v3/scripts/` (Node.js, no transpilation)

**Secondary:**
- SQL (PostgreSQL dialect) — schema definition in `v3/supabase/schema.sql`
- CSS — plugin UI styles in `v3/src/ui/index.css`

## Runtime

**Environment:**
- Browser sandbox (Figma plugin iframe) — React UI runs here
- Figma plugin sandbox — `v3/plugin/code.js` runs here (no DOM, no fetch; uses Figma APIs only)
- Node.js v24.3.0 — CLI scripts only (not part of the plugin build)

**Package Manager:**
- npm
- Lockfile: present (`v3/package-lock.json`, lockfileVersion 3)

## Frameworks

**Core:**
- React 19.2.4 — plugin UI (`v3/src/ui/`)
- react-dom 19.2.4 — rendering root in `v3/src/ui/main.tsx`

**Data Fetching:**
- @tanstack/react-query 5.90.21 — all async data fetching; `QueryClient` initialized in `v3/src/ui/App.tsx`

**Build/Dev:**
- Vite 7.3.1 — bundles the UI into a single `ui.html`
- vite-plugin-singlefile 2.3.0 — inlines all assets (JS, CSS) into one HTML file for Figma plugin requirements
- @vitejs/plugin-react 5.1.4 — JSX/TSX transform

## Key Dependencies

**Critical:**
- `@figma/plugin-typings` 1.123.0 — TypeScript types for all Figma plugin APIs used in `v3/src/code.ts`
- `vite-plugin-singlefile` 2.3.0 — mandatory for Figma plugins (single-file `ui.html` requirement)

**Infrastructure:**
- No Supabase JS SDK — Supabase is accessed via raw `fetch()` calls to the REST API in `v3/src/ui/hooks/useSupabaseCatalog.ts`
- No TMDB SDK — TMDB is accessed via raw `fetch()` calls in `v3/src/ui/hooks/useTMDB.ts`

## Configuration

**Environment:**
- No `.env` file in the plugin — the anon Supabase key and TMDB API key are hardcoded in source (intentional; anon key is public/read-only)
- CLI scripts (`v3/scripts/`) require env vars at runtime: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TMDB_API_KEY`

**Build:**
- `v3/vite.config.ts` — Vite config: output to `v3/plugin/`, target `esnext`, single-file inlining, path alias `@` → `./src/ui`
- `v3/src/tsconfig.json` — TypeScript config for backend only (`code.ts`), target ES2017, compiles to `v3/plugin/code.js`
- `v3/plugin/manifest.json` — Figma plugin manifest; declares allowed network domains

**Build Commands:**
```bash
# Production build (compiles backend TS + bundles UI)
npm run build   # tsc -p src/tsconfig.json && vite build && mv plugin/index.html plugin/ui.html

# Development watch mode
npm run dev     # vite build --watch
```

## Platform Requirements

**Development:**
- Node.js (v24 confirmed)
- npm
- Figma desktop app (to load the plugin from `v3/plugin/manifest.json`)

**Production:**
- Figma plugin sandbox (code.js)
- Browser environment inside Figma's plugin iframe (ui.html)
- No server deployment — the plugin runs entirely client-side

---

*Stack analysis: 2026-03-08*
