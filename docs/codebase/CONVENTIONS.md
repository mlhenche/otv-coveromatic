# Conventions

**Analysis Date:** 2026-03-08

## Naming

**Files:**
- React components: PascalCase `.tsx` (`CoverGrid.tsx`, `HtmlPasteTab.tsx`)
- Hooks: `use` prefix camelCase `.ts` (`useSupabaseCatalog.ts`, `useTMDB.ts`)
- Modules: PascalCase `.ts` for singleton/class-like (`LogStore.ts`)
- CLI scripts: kebab-case `.js` (`sync-to-supabase.js`, `add-content.js`)

**TypeScript:**
- Interfaces: PascalCase (`ParsedCard`, `CoverUrlData`, `PluginMessage`)
- Constants/maps: UPPER_SNAKE_CASE (`CHANNEL_TO_PROVIDER`, `CARD_PARSERS`, `CAROUSEL_ICONS`)
- React component props: `ComponentNameProps` suffix (`HtmlPasteTabProps`, `CoverCardProps`)
- React state: descriptive camelCase (`setApplying`, `selectedIdx`, `rawHtml`)

**postMessage types:** kebab-case strings matching intent (`apply-cover-url`, `apply-done`, `selection-info`, `load-api-key`, `notify-warning`)

**Figma node names:** Must match DS exactly — lowercase `cover`, lowercase `titleTreatment` variants, exact text field names (`name`, `title`, `rating`, `year`, `sinopsis`, `genre`, `agetag`)

## Code Style

**Indentation:** 4 spaces throughout (TypeScript and TSX files)

**TypeScript:** Strict mode (`strict: true` in tsconfig). `any` used sparingly in message types and legacy code.

**Section delimiters in `code.ts`:**
```typescript
// -- Section Name --
```

**Section delimiters in `HtmlPasteTab.tsx`:**
```typescript
// ── Section Name ──────────────────────────
```

**Import order:**
1. React
2. Third-party (`@tanstack/react-query`, etc.)
3. Hooks (`../hooks/...`)
4. Components (sibling)
5. Stores/utilities (`./LogStore`)

**Inline type assertion:** `(node as GeometryMixin & SceneNode).fills = ...`

## Error Handling

**UI (React / async):**
- Critical path: `try/catch` with visible error feedback (`Logger.add(... ['warning'])` or `parent.postMessage({ type: 'notify-warning' })`)
- Non-critical: silent `try/catch (_) {}` — never blocks primary operation
- React Query: errors surface via query state; components check `isLoading` / `error`

**Figma Sandbox:**
- Primary image load: caught, emits `figma.notify('⚠️ ...', { error: true })` and posts `apply-done: false`
- All secondary operations (title treatment, metadata, provider logo): wrapped in silent `try/catch`
- Failed node operations: logged with `console.warn`

**CLI scripts:**
- Fatal errors: `console.error` + `process.exit(1)`
- Recoverable per-item errors: logged and skipped, script continues

## Logging

**UI — `Logger` singleton (`v3/src/ui/components/LogStore.ts`):**
```typescript
Logger.add('Context', 'message text', ['tag1', 'tag2'])
```
- Entries accumulate in memory, displayed in `LogPanel` (Log tab)
- Tags used: `'warning'`, `'img'`, carousel type names

**Figma Sandbox — `console.*`:**
- Debug: `console.log('[context] message')` with bracketed prefix
- Warnings: `console.warn('[context] message')` for non-fatal failures

**CLI scripts:** Emoji prefixes for status (`✅`, `⚠️`, `❌`, `🔍`, `📝`)

## Communication Pattern (postMessage)

All UI ↔ Sandbox communication via `parent.postMessage` / `figma.ui.onmessage`:

**UI → Sandbox:**
```typescript
parent.postMessage({ pluginMessage: { type: 'apply-cover-url', coverUrl, imageBytes, metadata } }, '*')
```

**Sandbox → UI:**
```typescript
figma.ui.postMessage({ type: 'selection-info', componentType, coverCount })
```

**Message types (UI → Sandbox):** `get-selection`, `apply-cover`, `apply-cover-url`, `apply-multiple-covers`, `apply-multiple-covers-url`, `apply-episodes`, `save-api-key`, `load-api-key`, `cache-catalog`, `get-cached-catalog`, `notify-warning`

**Message types (Sandbox → UI):** `loaded-api-key`, `selection-info`, `selection-changed`, `apply-done`, `catalog-cache`

## Function Design

- Sandbox traversal helpers are pure functions operating on `SceneNode` arguments (e.g. `findCoverNodes`, `findMetadataScope`, `findBestVariantMatch`)
- React handlers are `async` when they `fetch` (e.g. `handleApplySingle`, `handleApplyAll`)
- Component props typed with dedicated interface above each component
- Boolean props avoided for multi-state; string union preferred (`imageFormat: 'portrait' | 'landscape'`)

---

*Conventions analysis: 2026-03-08*
