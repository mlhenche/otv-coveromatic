# CoverOmatic — Contexto para Claude

> Plugin de Figma para el equipo de diseño de Orange TV (FrogTV).
> Aplica carátulas, metadatos y personas a componentes del Design System en Figma.
> Última actualización: 2026-06-07

---

## Documentación del proyecto

Este archivo es un índice ligero. La documentación detallada vive en `docs/`:

- **`docs/ONBOARDING.md`** — punto de entrada para empezar a trabajar en el repo.
- **`docs/adr/`** — Architecture Decision Records (decisiones y su porqué).
- **`docs/specs/`** — especificaciones de funcionalidades.
- **`docs/codebase/`** — arquitectura, stack, estructura, integraciones, convenciones, concerns.
- **`docs/v3_handoff_context.md`** — contexto histórico del rediseño v3.

---

## Estructura del repositorio

```
covers/
├── .claude/CLAUDE.md       ← este archivo (índice)
├── .env.example            ← variables de entorno (solo TMDB_API_KEY)
├── README.md · TODO.md
├── docs/                   ← documentación (adr, specs, codebase, onboarding)
├── src/
│   ├── code.ts             ← backend del plugin (corre en Figma sandbox)
│   ├── lib/                ← funciones puras testeables (channels, urls, shuffle)
│   └── ui/
│       ├── App.tsx
│       ├── components/     ← CoverGrid (lógica principal), HtmlPasteTab, etc.
│       └── hooks/
│           ├── useCatalog.ts   ← carga el catálogo desde GitHub raw
│           └── useTMDB.ts
├── plugin/                 ← build (code.js, ui.html, manifest.json) — NO editar a mano
├── catalog/
│   ├── otv-catalog.json    ← catálogo (fuente de verdad, servido por GitHub raw)
│   └── extract-catalog-v2.js  ← parser que mergea desde OrangeCatalog.html
└── scripts/
    ├── lib/catalog-utils.js   ← utilidades compartidas (TMDB, normalize, IO)
    ├── export-static-catalog.js ← asegura géneros en el JSON (USAR ANTES DE PUSH)
    ├── enrich-catalog.js      ← enriquece entradas con TMDB
    ├── add-content.js         ← añade entrada(s)
    └── manage-content.js      ← elimina una entrada
```

> Las versiones antiguas v1/ y v2/ se archivaron en la rama `archive/v1-v2`.

---

## Stack técnico

- **Plugin Figma**: TypeScript compilado por Vite (`vite-plugin-singlefile` → un único `ui.html`)
- **UI**: React + TypeScript + `@tanstack/react-query`
- **Catálogo**: JSON estático servido desde GitHub raw (sin backend, sin Supabase)
- **Metadatos de contenido**: TMDB API
- **Caché local**: `figma.clientStorage` (TTL 4h)

---

## Credenciales

- **Plugin**: no usa ninguna credencial. Carga el catálogo desde GitHub raw.
- **Scripts CLI**: solo `TMDB_API_KEY` (ver `.env.example`). Copiar a `.env` y rellenar.

> El proyecto ya **no usa Supabase**. Ver `docs/adr/0002-corte-supabase.md`.
> Las claves de Supabase y la TMDB key anteriores estuvieron en el repo público
> y **deben considerarse comprometidas** — rotar/revocar (ver el ADR-0002).

---

## Catálogo

- Servido desde `https://raw.githubusercontent.com/mlhenche/otv-coveromatic/main/catalog/otv-catalog.json`
- ~783 contenidos, 27 géneros embebidos.
- Estructura de entrada: `{ title, contentId, mediaType?, tmdbId?, tmdbTitle?, genreIds? }`, keyed por título normalizado.
- Flujo de actualización: ver el skill `update-otv-catalog` o `docs/ONBOARDING.md`.

---

## Mapa de proveedores (extractProvider)

| Prefijo del contentId | Proveedor |
|----------------------|-----------|
| PRIME | Prime Video |
| SKYS | SkyShowtime |
| DSN | Disney+ |
| MAX | Max |
| RTVE | RTVE Play |
| FLMN | Filmin |
| APREM | A3 Premium |
| MFO / FLX | Orange TV |

> IMPORTANTE: Filmin no lleva guión bajo (`FLMN10000050694`). La detección usa `.startsWith()`, no split por `_`.

> IMPORTANTE: Algunos contenidos de OTV usan slugs como contentId (ej. `hoppers`, `scream-7`, `perfect-days`). **Son IDs válidos** — OTV los usa directamente en las URLs de imagen. La validación de prefijos los marca como "sospechosos" pero las imágenes responden HTTP 200. No eliminarlos automáticamente.

---

## URLs de imágenes de Orange TV

```
Base VOD: https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod

Portrait:         /VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160
Landscape:        /COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160
Background (VPS): /BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160
Title Treatment:  /TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720
```

---

## Tipos de componentes Figma que reconoce el plugin

| componentType | Imagen aplicada | Title Treatment |
|--------------|-----------------|-----------------|
| `card-portrait` | VERTICAL | no |
| `card-landscape` | COVER_ART | no |
| `vps` | BACKGROUND | sí |
| `slideshow` | BACKGROUND | sí |

La detección del tipo ocurre en `code.ts` inspeccionando las propiedades del componente seleccionado.

### Comportamientos especiales

**`row_card_channel`** — Si el nombre del componente incluye "row" y "channel", se saltan los primeros **3** cover nodes antes de aplicar contenido. Preserva las cards fijas de cabecera del carrusel de canales.

**`Row_title`** — Al aplicar una fila completa desde la pestaña HTML, el título del carrusel se escribe en la propiedad de texto del componente cuyo nombre base contenga "row". Si no existe, busca un nodo de texto `row_title`.

---

## Pestaña HTML — Pegar HTML de Orange TV

Permite aplicar contenido directamente desde el HTML de `orangetv.orange.es`, sin que los contenidos estén en el catálogo. Útil para EPG, directo y contenido puntual.

1. El diseñador copia el HTML de `<app-root>` desde Chrome y lo pega en la pestaña HTML del plugin.
2. El plugin parsea con `DOMParser` (`HtmlPasteTab.tsx`) y extrae carruseles.
3. Aplica cards individuales o la fila completa.

### Tipos de carrusel soportados

| Tag Angular | Tipo | Cards |
|-------------|------|-------|
| `app-carousel-slideshow` | Slideshows | `app-card-slideshow` |
| `app-carousel-emission` | Emisiones/directo | `app-card-emission` |
| `app-carousel-channel` | Canales/programación | `app-card-channel` |
| `app-carousel-corner` | Corners | `app-card-corner` |
| `app-carousel-generic` | Genérico (EPG, VOD) | `app-card-generic` |

### Datos que extrae por card

`backgroundUrl`, `titleTreatmentUrl` (slideshow/corner), `channelIconUrl`/`channelName`, `schedule`/`live`/`duration` (emisiones), `title`/`year`/`ageRating` (genérico). Cards sin imagen quedan ocultas en el grid.

### Carga de imágenes EPG

Las imágenes EPG (`/epg/COVER/...`) no cargan con `figma.createImageAsync()` desde el sandbox. El plugin las descarga en la UI (iframe, dominio permitido en el manifest) y envía los bytes al backend con `figma.createImage(bytes)`. Fallback a `createImageAsync`.

### Provider logo en cards de canal

- `extractChannelName()` extrae el nombre del canal de la URL del icono (`/attachments_new/{NAME}_{NNNxNNN}.ext` y `/attachments/{name}.ext`).
- `CHANNEL_TO_PROVIDER` en `code.ts` mapea nombres de URL a variantes de `providerLogoSquare`.
- `findBestVariantMatch()` intenta: exact match → tabla explícita → case-insensitive → fuzzy normalizado.

### Archivos clave

- `src/ui/components/HtmlPasteTab.tsx` — parser + componente de la pestaña.
- `src/code.ts` — handlers `apply-cover-url` / `apply-multiple-covers-url`, `CHANNEL_TO_PROVIDER`, `findBestVariantMatch`, `applyProviderLogo`.

---

## Próximas tareas (ver TODO.md y docs/specs/)

1. **Completar `CHANNEL_TO_PROVIDER`** — renombrar variantes de `providerLogoSquare` en Figma para que el exact match resuelva directamente y la tabla pueda eliminarse.
2. **Componente `card_emission`** — el DS aún no tiene componente para emisiones en directo (ver `docs/specs/card-emission.md`).
3. **Nuevos componentes del DS 2026** — actualizar la detección en `code.ts` y los `switch` de URLs en `CoverGrid.tsx`.

---

## Cosas que NO hacer

- No editar `plugin/code.js` ni `plugin/ui.html` directamente — son builds. Editar `src/` y compilar (`npm run build`).
- No commitear secretos. Las credenciales van en `.env` (gitignored).
- No commitear `catalog/OrangeCatalog.html` — archivo de trabajo temporal grande (gitignored).
