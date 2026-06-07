# Codebase Concerns

**Analysis Date:** 2026-03-08

---

## Known Bugs (Active)

**Provider logo not updating in card_channel rows:**
- Symptoms: `providerLogoSquare` variant does not change when applying a full channel row from the HTML tab. The channel name is resolved but `setProperties` silently fails.
- Files: `src/code.ts` — `applyProviderLogo` (~L198), `isProviderLogoComponent` (~L246), `findProviderLogoAncestor` (~L271)
- Cause: The `provider` property key lookup uses `.toLowerCase()` but the Figma component may expose the key as `"Provider"` (capitalized). The three-strategy search (S1: metadata scope, S2: nearest instance ancestor, S3: `findProviderLogoAncestor`) all complete but return 0 logos in certain card structures — specifically when `providerLogoSquare` is a sibling of `wrapper` inside `epg`, not a descendant of `wrapper`.
- Current state: Diagnostic `console.log` statements are present at lines 210, 1054, 1058, 1060, 1065, 1073 (left in production build). Fix is documented in `TODO.md` but not yet applied.
- Fix: Make all three strategy functions case-insensitive on property key lookup: `key.toLowerCase() === 'provider' || key.toLowerCase().startsWith('provider#')`.

**Some cards render blank after applying channel row from HTML tab:**
- Symptoms: After "Aplicar fila completa", some card slots remain empty (no image applied).
- Files: `src/ui/components/HtmlPasteTab.tsx` — `handleApplyAll` (~L343), `src/code.ts` — `apply-multiple-covers-url` handler (~L1002)
- Cause: Cards with `backgroundUrl: null` are filtered out of `validCards` in `handleApplyAll`, so the array sent to the backend is shorter than the number of Figma cover nodes. The backend iterates `Math.min(targetCoverNodes.length, coversUrlData.length)`, leaving remaining slots untouched. Additionally, if the pre-fetch in the UI fails silently (empty `catch (_) {}`), `imageBytes` is undefined and `figma.createImageAsync` is attempted as fallback — which also fails for EPG URLs that require OTV session cookies.
- Workaround: None. Affected slots simply stay unchanged.

---

## Tech Debt

**`CHANNEL_TO_PROVIDER` hardcoded mapping table (~65 entries, incomplete):**
- Issue: `src/code.ts` L91–158 contains a manually maintained mapping of channel URL names to Figma variant names. This table requires manual updates every time Figma variants are renamed or new channels are added. ~30 channels listed in `TODO.md` have no entry and fall through to fuzzy matching, which may produce wrong matches.
- Files: `src/code.ts` (L91–158)
- Impact: New channels are silently unmatched; wrong provider logos appear without any error.
- Fix approach: Rename `providerLogoSquare` Figma variants to exactly match OTV URL channel names (e.g. `LA_SEXTA`, `ANTENA_3`). Once done, the exact-match path in `findBestVariantMatch` resolves directly and the entire table can be deleted. Tracked as a TODO in `CLAUDE.md` and `TODO.md`.

**Diagnostic `console.log` statements left in production code:**
- Issue: Multiple `console.log` calls added during debugging were not removed before the last build.
- Files: `src/code.ts` L210, L1054, L1058, L1060, L1065, L1073
- Impact: Leaks internal Figma node names and provider resolution attempts to the DevTools console. Indicates the debugging cycle is incomplete.
- Fix: Remove or gate behind a `DEBUG` constant before the next release build.

**`setTimeout` used to signal apply completion instead of `apply-done` message:**
- Issue: In `HtmlPasteTab.tsx` (`handleApplySingle` L340, `handleApplyAll` L375) and `CoverGrid.tsx` (`applyOTVContent` L165, `applyTMDBPerson` L263, `sendRandomOTVMessage` L394), `setTimeout(() => setApplying(false), 800)` is used as a fixed delay to clear the loading state. The actual apply operation is async and can take longer on slow connections.
- Files: `src/ui/components/HtmlPasteTab.tsx`, `src/ui/components/CoverGrid.tsx`
- Impact: UI may re-enable buttons before the Figma operation finishes. The sandbox already sends `apply-done` messages but `HtmlPasteTab` does not listen for them.
- Fix: Listen for the `apply-done` message from the sandbox to clear loading state instead of using a fixed timeout.

**`any` types used throughout component props:**
- Issue: `selectionInfo`, `selectedContentData`, `vpsNextEntry`, and `items` in `CoverGrid.tsx` are typed as `any`. `HtmlPasteTabProps.selectionInfo` is also `any`. Props like `onOpenSeasons` accept `any` instead of `CatalogItem`.
- Files: `src/ui/components/CoverGrid.tsx` (L43, L44, L58, L75, L169, L228), `src/ui/components/HtmlPasteTab.tsx` (L36)
- Impact: TypeScript provides no type checking for these values; shape-mismatch bugs are only caught at runtime.
- Fix: Define a `SelectionInfo` interface and use it consistently across all components.

**Catalog grid hard-limited to 50 results:**
- Issue: `CoverGrid.tsx` L475 and L491 both call `.slice(0, 50)` on `currentResults`. With 529 active catalog entries, up to 479 items are never shown unless the user filters.
- Files: `src/ui/components/CoverGrid.tsx` (L475, L491)
- Impact: Designers may not find content that exists in the catalog if it falls outside the first 50 results. No pagination or "load more" exists.
- Fix: Add a "load more" button, virtual scrolling, or raise the limit. The catalog (529 items) is small enough to render fully.

**`figma.clientStorage` catalog cache is written but never read:**
- Issue: `code.ts` handles `cache-catalog` (L819) and `get-cached-catalog` (L834) messages to persist catalog data, but `useCatalog.ts` never sends these messages. Only `@tanstack/react-query` with `staleTime: 4h` is used. Closing and reopening the plugin always triggers a full Supabase fetch.
- Files: `src/code.ts` (L819–856), `src/ui/hooks/useCatalog.ts`
- Impact: Dead code in `code.ts`; the intended offline/resilience behavior is inactive.
- Fix: Either wire up the cache in `useCatalog.ts` (check `figma.clientStorage` before fetching, populate it after) or remove the dead handlers.

**Legacy v1 and v2 plugin directories committed:**
- Issue: `v1/` and `v2/` are complete plugin versions with compiled builds committed to the repository. They are no longer active. `v2/catalog/OrangeCatalog.html` is a large HTML file committed in violation of the stated policy in `CLAUDE.md`.
- Files: `v1/`, `v2/`
- Impact: Repo noise; can mislead contributors; `v2/catalog/OrangeCatalog.html` bloats repo size.
- Fix: Archive to a separate branch or delete.

---

## Security Considerations

**TMDB API key hardcoded in `CLAUDE.md`:**
- Risk: The TMDB API key is stored in plain text in `.claude/CLAUDE.md`, which is committed to the git repository.
- Files: `.claude/CLAUDE.md`
- Current mitigation: TMDB free-tier keys have no billing impact if leaked; the key is also stored per-user in `figma.clientStorage`.
- Recommendation: Remove from `CLAUDE.md`. Reference `scripts/.env.example` or `figma.clientStorage` instead.

**Supabase service key hardcoded in `CLAUDE.md`:**
- Risk: The Supabase service role key is stored in `.claude/CLAUDE.md` committed to git. A service key bypasses all RLS policies and allows unrestricted INSERT/UPDATE/DELETE on the database.
- Files: `.claude/CLAUDE.md`
- Current mitigation: The key is only used by CLI scripts (`scripts/`); it is not compiled into the plugin.
- Recommendation: Remove from `CLAUDE.md`. Store only in a local `.env` file excluded by `.gitignore`. `scripts/.env.example` exists for this purpose.

**Figma token file in repository:**
- Risk: `gitignore/figma-token.txt` exists at the root. The filename implies it contains a Figma personal access token.
- Files: `gitignore/figma-token.txt`
- Current mitigation: The directory is named `gitignore/`, suggesting intent to exclude it — but must be verified against the actual `.gitignore` rules.
- Recommendation: Confirm the file is covered by `.gitignore`. If not, rotate the token immediately and add the path.

**Supabase anon key hardcoded in plugin source:**
- Risk: The Supabase anon key is hardcoded in `useCatalog.ts` L4 and compiled into the distributed `plugin/ui.html`.
- Files: `src/ui/hooks/useCatalog.ts` (L4), `plugin/ui.html`
- Current mitigation: Per `CLAUDE.md`, this is intentional — the anon key is public and read-only, with security enforced by Supabase RLS policies. This is an accepted design decision.
- Recommendation: Document the active RLS policies in `supabase/schema.sql` to confirm they enforce read-only access for the anon role.

---

## Performance Bottlenecks

**Unbounded parallel image fetching in `handleApplyAll`:**
- Problem: `Promise.all` fetches all images in parallel in `HtmlPasteTab.tsx` (`handleApplyAll` L351). For a full row of 20+ cards, this launches 20+ simultaneous fetch requests to `pc.orangetv.orange.es`. On slower connections or if the OTV CDN rate-limits, many requests fail silently (empty `catch (_) {}`).
- Files: `src/ui/components/HtmlPasteTab.tsx` (L351–364)
- Impact: Silent failures cause blank card slots. No retry or per-card error feedback.
- Improvement: Use a concurrency-limited fetch queue (e.g. batches of 5) and surface individual fetch failures to the user.

**Sequential `await figma.createImageAsync` in the sandbox apply loop:**
- Problem: The backend loop in `code.ts` L1018–1077 applies each cover with `await figma.createImageAsync()` one at a time. For 20 covers this is fully sequential.
- Files: `src/code.ts` (L1018–1077)
- Impact: Applying a full row of 20 covers is slow (2–5s on good connections, 10s+ on slow ones). No progress indicator is shown.

**Multiple redundant tree traversals per apply:**
- Problem: `findCoverNodes`, `findTitleTreatmentNodes`, and `findProviderLogoNodes` each call `node.findAll()` or `node.findAllWithCriteria()` independently on the same selection tree. For large nested frames, this means 3–5 full traversals per single apply operation.
- Files: `src/code.ts` (L372–397, L288–303)
- Improvement: Collect all relevant nodes in a single traversal pass and return them partitioned by type.

---

## Fragile Areas

**Cover and metadata node detection relies on exact Figma layer names:**
- Files: `src/code.ts` — `isCoverNode` (L34), `isTitleTreatmentNode` (L38), `findTextNode` (L45), `findInstanceNode` (L66), `METADATA_NODE_NAMES` (L605)
- Why fragile: All detection depends on Figma layer names matching exactly: `"cover"`, `"titleTreatment"`, `"title treatment"`, `"title_treatment"`, `"agetag"`, `"row_title"`, `"title"`, `"rating"`, `"year"`, `"duration"`, `"sinopsis"`, `"genre"`, `"name"`, `"rol"`, `"chapter"`. If a designer renames any of these layers in the Design System, the plugin silently stops applying content to that layer with no warning.
- Safe modification: Any DS component layer rename must be accompanied by a matching update to the name checks in `code.ts`.
- Test coverage: None.

**`row_card_channel` 3-card offset hardcoded:**
- Files: `src/code.ts` — `getChannelRowOffset` (L993)
- Why fragile: The offset of 3 (skip the first 3 cover nodes for channel carousels) is hardcoded. It matches the current DS component structure but will silently apply wrong content if the DS adds or removes fixed header cards in the channel row.
- Safe modification: Verify against the Figma DS component before changing the channel carousel card count.

**`HtmlPasteState` held only in React state (lost on plugin close):**
- Files: `src/ui/App.tsx` (L25–27), `src/ui/components/HtmlPasteTab.tsx`
- Why fragile: Pasted HTML and parsed carousels are held only in React component state. Closing and reopening the plugin requires the user to paste and re-parse the HTML. For large OTV pages (several MB), this is slow.
- Fix approach: Persist `htmlState.carousels` (not `rawHtml`) to `figma.clientStorage` on parse, and restore on load.

**`parseHtml` tightly coupled to Orange TV's Angular component tags and CSS classes:**
- Files: `src/ui/components/HtmlPasteTab.tsx` — `CARD_PARSERS` (L222), `parseCardChannel` (L117), `parseCardEmission` (L93), `parseCardGeneric` (L167)
- Why fragile: The parser matches Angular custom elements (`app-carousel-*`, `app-card-*`) and CSS classes (`.card__image`, `.card__channel-icon`, `.emission-info__time`, `.card__metadata`, etc.). A frontend update to `orangetv.orange.es` that renames components, restructures the DOM, or changes CSS class names will silently break parsing — cards will parse with null fields and show blank or incorrect data with no user-facing warning.
- Recommendation: Add a parse-time sanity check — if zero cards with a `backgroundUrl` are found across all carousels, warn the user that the HTML format may have changed.

**`selectionVersion` race condition window for VPS frames with remote library cards:**
- Files: `src/code.ts` — `sendSelection` (L677), stale checks at L694, L700, L705, L716
- Why fragile: The version check prevents stale async results from being sent, but if the user applies a cover immediately after selecting a VPS before `refreshCardCache` completes, `cachedAllCardIds` may be empty. This causes cover nodes inside nested card instances to be included as apply targets. The sync pre-pass (`refreshCardCacheSync`) mitigates this for locally accessible components but not for remote library components where `mainComponent` is null until resolved async.
- Safe modification: Do not assume `cachedAllCardIds` is fully populated at apply time for VPS frames with remote library cards.

---

## Missing Critical Features

**No Figma DS component for `card_emission` (live broadcast cards):**
- Problem: The HTML parser fully extracts emission cards (`backgroundUrl`, `channelIconUrl`, `schedule`, `live`, `duration`) but there is no corresponding Figma Design System component to apply them to. Parsed emission carousels appear in the UI but applying them uses whatever cover node exists, without writing schedule/live/duration metadata.
- Blocks: Full EPG and live broadcast workflow in the HTML tab.
- Files: `src/ui/components/HtmlPasteTab.tsx` — `parseCardEmission` (L93)

**No React error boundary in the plugin UI:**
- Problem: The plugin UI has no React error boundary. An unhandled exception in any component (e.g. during HTML parsing of malformed input or a Figma API call that returns an unexpected shape) crashes the entire plugin UI, showing a blank panel with no recovery path except closing and reopening the plugin.
- Files: `src/ui/App.tsx`, `src/ui/main.tsx`
- Fix: Wrap the app root in an `ErrorBoundary` component that shows a "Something went wrong — reload plugin" message.

**No input size validation for HTML paste:**
- Problem: `HtmlPasteTab.tsx` sends the raw HTML string directly to `DOMParser` with no size check. A user could accidentally paste an entire browser session source (10+ MB). The `setTimeout(..., 50)` before parsing allows a spinner to render but the parse itself still blocks the iframe's main thread.
- Files: `src/ui/components/HtmlPasteTab.tsx` — `handleParse` (L295)
- Fix: Add a maximum input size check (e.g. 5 MB) with a user-facing warning before attempting to parse.

---

## Test Coverage Gaps

**No tests exist anywhere in the codebase:**
- What's not tested: All business logic — URL building (`buildOTVUrls` in `CoverGrid.tsx`), catalog search and filtering, HTML parsing (`parseHtml`, all `parseCard*` functions in `HtmlPasteTab.tsx`), channel name extraction (`extractChannelName`), provider resolution (`findBestVariantMatch`, `normalizeChannel`, the entire `CHANNEL_TO_PROVIDER` table), metadata filling (`fillMetadata`), node detection (`isCoverNode`, `isTitleTreatmentNode`, `isCardComponentName`, `isChapterCardComponent`).
- Files: All of `src/` — zero test files exist.
- Risk: Any refactor or new DS component support can silently regress existing behavior. The `CHANNEL_TO_PROVIDER` table has no coverage — wrong mappings are only discovered when a designer notices the wrong provider logo. The HTML parser has no coverage — OTV HTML structure changes are only discovered when carousels stop appearing.
- Priority: High for `parseHtml`, `findBestVariantMatch`, `normalizeChannel`, `buildOTVUrls`, `extractChannelName`; Medium for Figma node traversal helpers (requires mocking the Figma API).

---

*Concerns audit: 2026-03-08*
