# Codebase Structure

**Analysis Date:** 2026-03-08

## Directory Layout

```
covers/
├── v3/                        # Active plugin version
│   ├── src/
│   │   ├── code.ts            # Plugin backend — Figma sandbox entry point
│   │   └── ui/
│   │       ├── App.tsx        # React root — tab shell and global state
│   │       ├── components/    # All React UI components
│   │       └── hooks/         # Data-fetching hooks (Supabase, TMDB)
│   ├── plugin/
│   │   ├── code.js            # Compiled backend (do not edit)
│   │   ├── ui.html            # Compiled frontend single-file bundle (do not edit)
│   │   └── manifest.json      # Figma plugin manifest + allowed network domains
│   ├── catalog/
│   │   ├── OrangeCatalog.html # Temp work file (gitignored) — pasted from orangetv.orange.es
│   │   ├── otv-catalog.json   # Local merged catalog (committed)
│   │   ├── extract-catalog.js    # Parser v1 (legacy)
│   │   └── extract-catalog-v2.js # Parser v2 — active
│   ├── scripts/
│   │   ├── sync-to-supabase.js   # Syncs otv-catalog.json → Supabase
│   │   ├── enrich-catalog.js     # Enriches entries missing TMDB ID
│   │   ├── add-content.js        # Adds individual entries
│   │   └── manage-content.js     # Enable/disable entries (soft delete)
│   ├── docs/
│   │   └── v3_handoff_context.md
│   ├── index.html             # Vite build entry
│   ├── vite.config.ts
│   └── package.json
├── v1/, v2/                   # Archived versions (do not modify)
├── .claude/CLAUDE.md          # Project context and instructions for Claude
├── .planning/codebase/        # GSD codebase analysis documents
├── TODO.md
└── README.md
```

## Key File Locations

| File | Purpose |
|------|---------|
| `v3/src/code.ts` | All Figma document manipulation — edit here for new node types, handlers |
| `v3/src/ui/App.tsx` | Global state, tab routing, sandbox message handling |
| `v3/src/ui/components/CoverGrid.tsx` | Catalog apply logic — URL building, TMDB fetch, postMessage |
| `v3/src/ui/components/HtmlPasteTab.tsx` | HTML parser + apply logic for HTML paste tab |
| `v3/src/ui/hooks/useSupabaseCatalog.ts` | Supabase catalog fetch and normalization |
| `v3/src/ui/hooks/useTMDB.ts` | All TMDB API hooks |
| `v3/plugin/manifest.json` | Plugin name, allowed `networkAccess` domains |
| `v3/vite.config.ts` | Build config, `@` alias → `v3/src/ui/` |

## Component Map (`v3/src/ui/components/`)

| Component | Role |
|-----------|------|
| `CoverGrid.tsx` | Catalog grid + apply logic for Cine/Series/Personas tabs |
| `HtmlPasteTab.tsx` | HTML paste parser + card grid + apply logic |
| `CoverCard.tsx` | Single catalog item card |
| `ControlsBar.tsx` | Search input, genre filter, person search mode |
| `Header.tsx` | Plugin header + API key management |
| `Tabs.tsx` | Tab bar (Cine, Series, Personas, HTML, Log) |
| `SeasonPicker.tsx` | Modal: season/episode picker for TV series |
| `Overlays.tsx` | Loading spinner + component type picker dialog |
| `FooterLog.tsx` | Bottom bar: selection count + reload |
| `LogPanel.tsx` | Log tab content |
| `LogStore.ts` | Singleton log accumulator (no React state) |
| `VPSNextDialog.tsx` | Prompt to apply related content after VPS apply |

## Naming Conventions

**Files:**
- React components: PascalCase `.tsx` (`CoverGrid.tsx`, `HtmlPasteTab.tsx`)
- Hooks: camelCase with `use` prefix `.ts` (`useSupabaseCatalog.ts`)
- Modules: PascalCase `.ts` for class-like (`LogStore.ts`)
- CLI scripts: kebab-case `.js` (`sync-to-supabase.js`)

**Figma node names (must match exactly — DS convention):**
- `cover` — image fill layer inside a card
- `titleTreatment` / `title treatment` / `title_treatment` — title treatment layer
- `name`, `title`, `rating`, `year`, `duration`, `sinopsis`, `genre`, `genre2`, `genre3` — metadata text nodes
- `agetag` — age rating component instance
- `providerLogoSquare`, `providerLogoRectangle` — provider logo instances
- `row_title` — carousel title text node in row components

## Where to Add New Code

| Task | Location |
|------|---------|
| New Figma card type | `typeFromName()` in `v3/src/code.ts` + `buildOTVUrls()` in `CoverGrid.tsx` |
| New HTML carousel type | Add parser fn + register in `parseHtml()` in `HtmlPasteTab.tsx` |
| New metadata field | `MovieTvMetadata` interface + `fillMetadata()` in `code.ts` |
| New external API | New hook in `v3/src/ui/hooks/` + add domain to `manifest.json` |
| New channel mapping | `CHANNEL_TO_PROVIDER` in `v3/src/code.ts` |
| New CLI catalog script | `v3/scripts/` following pattern of `add-content.js` |

---

*Structure analysis: 2026-03-08*
