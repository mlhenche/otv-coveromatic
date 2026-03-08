# Testing

**Analysis Date:** 2026-03-08

## Status

**No automated tests exist.**

The `package.json` test script is a stub:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

No test runner (Jest, Vitest, etc.) is configured. No test files exist in `v3/src/`.

## Manual Testing Approach

**Plugin UI + sandbox:**
1. `npm run build` (or `npm run dev` with watch mode) in `v3/`
2. Load `v3/plugin/manifest.json` in Figma Desktop via Plugins > Development > Import plugin from manifest
3. Test manually in Figma with real DS components
4. Close and reopen the plugin to reload after each build

**CLI scripts:**
- Run against the live Supabase instance with real credentials (no staging environment)
- Verified by checking Supabase table state before/after

**HTML paste:**
- Paste real HTML from `orangetv.orange.es` into the plugin's HTML tab
- Verify carousels and cards parse correctly via the Log panel

## What to Add if Tests Are Introduced

**Recommended framework:** Vitest (already using Vite; zero-config setup)

**Most valuable test targets:**
- `extractBgUrl()` in `HtmlPasteTab.tsx` — regex edge cases (empty urls, parentheses in filenames, `&amp;` entities)
- `extractChannelName()` — both URL patterns (`/attachments_new/` and `/attachments/`)
- `findBestVariantMatch()` in `code.ts` — fuzzy matching edge cases
- `parseCardChannel()` / `parseCardGeneric()` — HTML structure variations
- `normalizeChannel()` — normalization transformations

**Harder to test (Figma API dependency):**
- All sandbox functions that call Figma API (`figma.createImageAsync`, node traversal) require mocking the full Figma plugin environment — not practical without a dedicated testing harness

**Setup if adding tests:**
```bash
cd v3
npm install -D vitest
# Add to package.json: "test": "vitest"
# Create v3/src/__tests__/ for unit tests
```

---

*Testing analysis: 2026-03-08*
