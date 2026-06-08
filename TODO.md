# TODO — CoverOmatic

## Bugs activos

### Provider no cambia en card_channel

`providerLogoSquare` no se actualiza al aplicar fila de canal desde la pestaña HTML.

**Causa raíz probable:** checks `key === 'provider' || key.startsWith('provider#')` son case-sensitive en `isProviderLogoComponent`, `applyProviderLogo` y `findProviderLogoAncestor`. Si Figma usa `"Provider"` con mayúscula, falla silenciosamente.

Fix en `code.ts`:
- `isProviderLogoComponent` (~L246) — `k.toLowerCase() === 'provider' || k.toLowerCase().startsWith('provider#')`
- `applyProviderLogo` (~L202) — lookup case-insensitive + log diagnóstico
- `findProviderLogoAncestor` (~L270) — mismo fix

### Algunas cards sin imagen al aplicar desde pestaña HTML

Slots quedan en blanco. Posibles causas: `backgroundUrl` null (la card se filtra antes de aplicar) o `createImageAsync` falla silenciosamente para URLs EPG.

---

## Pendiente: tabla `CHANNEL_TO_PROVIDER` incompleta

Tabla en `src/lib/channels.ts`, ~65 entradas. Necesita validarse contra variantes reales del DS.

Enlace: https://www.figma.com/design/8DlABzc0EynixwUG0GEG6p/Citrus-recap?node-id=165-43521

Canales sin mapeo: `CMM`, `BBC_*`, `SQUIRREL*`, `BOM`, `SANGRE_FRIA_V2`, `HISTORIA_Y_VIDA`, `NATURE_TIME`, `LOVE_*`, `VIVIR_CON_*`, `INGLES_TOTAL`, `DISNEY_JR`, `NICK_JR`, `BABYTV_WHITE`, `TOON_GOOGLES`, `POCOYO_WHITE`, `ANIME_VISION_*`, `GOL*`, `TOP_BARCA_WHITE`, `MOTORVISION`, `BBC_TOP_GEAR_WHITE`, `TRACE_SPORT_STARS`, `UBEAT`, `GAME_TOON_White`, `MMATV_WHITE`, `FIGHT_BOX_White`, `QUELLO_CONCERTS_WHITE`, `SOL`, `FLAMENCO_AUDITORIO`, `QWEST_TV`, `eitb`, `1+1_WHITE`, `BBOriginals_*`, `NEGOCIOS_TV`, `TV5MONDE`, `FRANCE2`, `FRANCE5`, `SOMOS`

Para completar: abrir Desktop Bridge en Figma → Claude lee variantes via MCP → renombrar variantes para que el exact match resuelva directamente y la tabla pueda eliminarse.

---

## Fase 2 — Refactor de código

> Prerequisito cumplido: esbuild bundlea el backend, tests en src/lib/, tooling activo.

### 1. Trocear `code.ts` (1.231 líneas)

Extraer a módulos dentro de `src/`:
- Helpers de nodos Figma (buscar capas, aplicar fills, resize)
- Lógica de provider logo (`applyProviderLogo`, `findProviderLogoAncestor`)
- Handlers por mensaje (`apply-cover-url`, `apply-multiple-covers-url`, `apply-episode-covers`, etc.)

esbuild los bundlea igual que ahora — el split es solo para legibilidad y testabilidad.

### 2. Extraer apply-logic de `CoverGrid.tsx` (519 líneas)

`applyOTVContent`, `applyRelatedContent`, `applyRandomOTV` y `sendRandomOTVMessage` son lógica de negocio dentro de un componente React. Moverlas a un hook `useApply` o a `src/lib/apply.ts` para poder testearlas sin montar el componente.

### 3. Activar `strict: true` en UI

`src/ui/tsconfig.json` ya tiene el flag listo (solo en `false`). Encenderlo + eliminar todos los `any` explícitos. El compilador guiará el trabajo.

### 4. Tests del parser HTML

`HtmlPasteTab.tsx` parsea HTML con `DOMParser`. Extraer las funciones de parseo puras a `src/lib/html-parser.ts` y cubrirlas con Vitest + entorno jsdom.

### 5. Robustez async ✓ (parcial)

- `useTMDBMultiSearch` en `ControlsBar`: error visible en el dropdown — distingue `TmdbAuthError` de error de red.
- Descartados: AbortController (react-query ya cancela; fetches puntuales no necesitan cancelación), throttling (flujo serie, sin riesgo de rate limit), error boundaries (fallos son de fetch, no de render).

### 6. Componente `card_emission`

El DS aún no tiene componente para emisiones en directo. Ver spec en [docs/specs/card-emission.md](docs/specs/card-emission.md). Una vez exista en Figma, actualizar la detección en `code.ts` y los `switch` de URLs en `CoverGrid.tsx`.

---

## Notas

- URLs EPG usan `/epg/` en lugar de `/vod/`, mismo dominio base
- Logos de canales en `/attachments_new/{NOMBRE}_{ancho}x{alto}.png`
- Tabla completa de ~130 canales con URL names en `channels.html`
