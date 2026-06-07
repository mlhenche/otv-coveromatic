# Architecture

**Analysis Date:** 2026-03-08

## Pattern Overview

**Overall:** Figma Plugin dual-process architecture (Sandbox + UI iframe)

**Key Characteristics:**
- Two fully isolated execution contexts communicate exclusively via `postMessage`
- The Figma sandbox (`code.ts`) has no DOM, no fetch, no React — only the Figma API
- The UI iframe has no direct Figma API access — it is a standard browser environment running React
- All external HTTP calls (Supabase, TMDB, OTV CDN) happen in the UI layer
- Images that cannot be fetched from the Figma sandbox (EPG/OTV CDN URLs) are downloaded in the UI and sent as raw bytes to the sandbox

## Layers

**Figma Sandbox (Backend):**
- Location: `src/code.ts` → compiled to `plugin/code.js` (do not edit directly)
- Contains: Selection analysis, node traversal, image application, metadata filling, provider logo resolution, `figma.clientStorage` cache
- Depends on: Figma Plugin API (`@figma/plugin-typings`)

**React UI (Frontend):**
- Location: `src/ui/` → compiled to `plugin/ui.html` (single-file bundle, do not edit directly)
- Contains: React components, custom hooks, all external API calls
- Depends on: React 19, `@tanstack/react-query`, Supabase REST API, TMDB API

**Data Hooks:**
- `src/ui/hooks/useCatalog.ts` — React Query wrapper for Supabase (4h stale time)
- `src/ui/hooks/useTMDB.ts` — React Query wrappers for TMDB API

**CLI Scripts:**
- `scripts/` — Node.js catalog management; require env vars; never called from within the plugin

## Data Flow

**Catalog Tab (Movies / Series):**
1. `useCatalog` fetches `contents`, `genres`, `config` from Supabase (4h cache)
2. `CoverGrid` filters by tab, search term, genre
3. Designer clicks item → `handleApply` determines `componentType` from `selectionInfo`
4. If `componentType` is `unknown`, `Overlays` shows type picker dialog
5. Builds OTV CDN URLs from `contentId` + `componentType`, fetches TMDB metadata, posts `apply-cover-url` to sandbox
6. Sandbox finds `cover` nodes, applies image fills, fills metadata text nodes / variant properties

**HTML Paste Tab:**
1. Designer pastes raw HTML from `orangetv.orange.es`
2. `parseHtml` (browser DOMParser) extracts `ParsedCarousel[]` with `ParsedCard[]`
3. Cards with no `backgroundUrl` are hidden from the grid
4. On apply, browser `fetch` retrieves image bytes (EPG images require browser context; `figma.createImageAsync` is blocked by the server for cross-origin sandbox requests)
5. Posts `apply-cover-url` (single) or `apply-multiple-covers-url` (row) with `imageBytes`, metadata, `carouselTitle`
6. Sandbox applies images, fills metadata, sets provider logo variant, writes carousel title

**Selection Analysis:**
1. `figma.on('selectionchange')` → debounced 120ms → `sendSelection()`
2. Sync pass: `detectTypeSync` walks node names and `mainComponent.name`
3. Async pass (if type `unknown`): `getMainComponentAsync` on instances
4. Posts `selection-info` to UI: `componentType`, `coverCount`, `titleTreatmentCount`, `chapterCardCount`

## Key Abstractions

**`cover` node** — the fill-target layer inside each Figma card; detected by `node.name.trim().toLowerCase() === 'cover'`

**`componentType`** — `card-portrait` | `card-landscape` | `vps` | `slideshow` | `card-chapters` | `unknown`; drives URL building and apply logic

**`ParsedCard` / `ParsedCarousel`** — typed representation of OTV HTML paste content; defined in `src/ui/components/HtmlPasteTab.tsx`

**`CHANNEL_TO_PROVIDER` map** — translates OTV icon URL channel names to Figma `providerLogoSquare` variant names; `src/code.ts` lines ~91–158; used by `findBestVariantMatch()` (exact → table → case-insensitive → fuzzy → substring)

**`Metadata` union** — data passed from UI to sandbox for text nodes and variant properties; `MovieTvMetadata` | `PersonMetadata`; defined in `src/code.ts`

## Entry Points

- **Backend:** `src/code.ts` — opens UI, registers `selectionchange`, handles all `figma.ui.onmessage` events
- **UI:** `src/ui/App.tsx` — renders tab shell, global state, routes `pluginMessage` events
- **Build:** `npm run build` in `` — `tsc` for sandbox, `vite build` for React UI

## Error Handling

Primary image load is the only critical failure — surfaces `figma.notify` error. All secondary operations (title treatment, metadata, provider logo, carousel title) are wrapped in silent `try/catch` and never block the primary apply.

---

*Architecture analysis: 2026-03-08*
