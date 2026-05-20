# CoverOmatic — Contexto para Claude

> Plugin de Figma para el equipo de diseño de Orange TV (FrogTV).
> Aplica carátulas, metadatos y personas a componentes del Design System en Figma.
> Última actualización de este documento: 2026-05-20

---

## Estructura del repositorio

```
covers/
├── .claude/
│   └── CLAUDE.md          ← este archivo
├── TODO.md                ← tareas pendientes y próximos pasos
├── v3/                    ← versión activa del plugin
│   ├── src/
│   │   ├── code.ts        ← backend del plugin (corre en Figma sandbox)
│   │   └── ui/
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── CoverGrid.tsx      ← lógica principal de aplicación
│   │       │   ├── CoverCard.tsx
│   │       │   ├── ControlsBar.tsx
│   │       │   ├── Tabs.tsx
│   │       │   ├── Header.tsx
│   │       │   ├── SeasonPicker.tsx
│   │       │   ├── VPSNextDialog.tsx
│   │       │   ├── Overlays.tsx
│   │       │   ├── FooterLog.tsx
│   │       │   ├── LogPanel.tsx
│   │       │   └── LogStore.ts
│   │       └── hooks/
│   │           ├── useSupabaseCatalog.ts
│   │           └── useTMDB.ts
│   ├── plugin/
│   │   ├── code.js        ← build del backend (no editar directamente)
│   │   ├── ui.html        ← build del frontend (no editar directamente)
│   │   └── manifest.json
│   ├── catalog/
│   │   ├── OrangeCatalog.html      ← HTML pegado de orangetv.orange.es
│   │   ├── otv-catalog.json        ← catálogo local generado/mergeado
│   │   ├── extract-catalog.js      ← parser v1
│   │   └── extract-catalog-v2.js  ← parser v2 (el que se usa, hace merge)
│   ├── scripts/
│   │   ├── export-static-catalog.js ← añade géneros al JSON para GitHub (USAR ANTES DE GIT PUSH)
│   │   ├── sync-to-supabase.js    ← [OBSOLETO] sincronizaba otv-catalog.json → Supabase
│   │   ├── enrich-catalog.js      ← enriquece entradas sin TMDB ID (aún útil localmente)
│   │   ├── add-content.js         ← añade una entrada individual
│   │   └── manage-content.js      ← activa/desactiva entradas (soft delete)
│   └── docs/
│       └── v3_handoff_context.md  ← contexto técnico detallado
```

---

## Stack técnico

- **Plugin Figma**: TypeScript compilado por Vite (`vite-plugin-singlefile` → todo en un único `ui.html`)
- **UI**: React + TypeScript + `@tanstack/react-query`
- **Base de datos**: Supabase (PostgreSQL)
- **Metadatos de contenido**: TMDB API
- **Caché local**: `figma.clientStorage` (TTL 4h)

---

## Credenciales

### Supabase
```
URL:       https://zmzehngquxtqirpjxyhn.supabase.co
ANON KEY:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU3ODksImV4cCI6MjA4NzEwMTc4OX0.aE19KXi3m0WjmZpxRyLNyETDVI5sAyg0JfLNOe_c4Aw
```
- La anon key está hardcodeada en `useSupabaseCatalog.ts`. Es pública y de solo lectura. Correcto por diseño: la seguridad la dan las RLS policies en Supabase.

```
SERVICE KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUyNTc4OSwiZXhwIjoyMDg3MTAxNzg5fQ.HFG2tgpLOwG4mLY79ND64MNvswFvFZTqSRcI56YtQIA
```
- Solo se usa en los scripts CLI (nunca en el plugin). Necesaria para INSERT/UPDATE/DELETE.

### TMDB
```
API KEY: 505c512e8ca4921b7296e4a2ca254fd7
```

---

## Tablas en Supabase

### `contents`
| columna | tipo | descripción |
|---------|------|-------------|
| id | uuid | PK auto |
| title | text | Título en Orange TV |
| content_id | text | ID único de Orange TV (ej: `MFO_299853221AMCN`) |
| media_type | text | `movie` o `tv` |
| tmdb_id | int | ID en TMDB (null si no encontrado) |
| tmdb_title | text | Título en TMDB |
| genre_ids | int[] | IDs de géneros TMDB |
| provider | text | Proveedor (Prime Video, Disney+, etc.) |
| active | bool | false = soft delete, no aparece en el plugin |

### `genres`
Tabla de referencia: `id` (int TMDB) → `name` (text en español).

### `config`
Clave `url_patterns`: JSON con las URLs base de imágenes de Orange TV.

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

La detección del tipo ocurre en `code.ts` inspeccionando las propiedades del componente seleccionado en Figma.

### Comportamientos especiales

**`row_card_channel`** — Si el nombre del componente seleccionado incluye "row" y "channel", se saltan los primeros **3** cover nodes antes de empezar a aplicar contenido. Esto preserva las cards fijas de cabecera del carrusel de canales.

**`Row_title`** — Al aplicar una fila completa desde la pestaña HTML, el título del carrusel se escribe en la propiedad de texto del componente cuyo nombre base contenga "row" (ej. "título de la row"). Si no existe esa propiedad, busca un nodo de texto llamado `row_title`.

---

## Pestaña HTML — Pegar HTML de Orange TV

Nueva pestaña que permite aplicar contenido directamente desde el HTML de `orangetv.orange.es`, sin necesidad de que los contenidos estén en el catálogo de Supabase. Útil para EPG, emisiones en directo y contenido puntual.

### Flujo

1. El diseñador abre `orangetv.orange.es` en Chrome, inspecciona `<app-root>` → Edit as HTML, copia todo y pega en la pestaña HTML del plugin
2. El plugin parsea el HTML con `DOMParser` en el frontend (`HtmlPasteTab.tsx`) y extrae los carruseles
3. El diseñador elige un carrusel y puede aplicar cards individuales o la fila completa

### Tipos de carrusel soportados

| Tag Angular | Tipo | Cards parseadas |
|-------------|------|-----------------|
| `app-carousel-slideshow` | Slideshows | `app-card-slideshow` |
| `app-carousel-emission` | Emisiones/directo | `app-card-emission` |
| `app-carousel-channel` | Canales/programación | `app-card-channel` |
| `app-carousel-corner` | Corners | `app-card-corner` |
| `app-carousel-generic` | Genérico (EPG, VOD) | `app-card-generic` |

### Datos que extrae por card

- `backgroundUrl` — imagen principal (extrae de `background-image: url(...)` en el CSS inline). El regex soporta nombres de fichero con paréntesis ej. `COVER_ART(1).jpg`. Cards sin imagen (url vacía o ausente) quedan ocultas en el grid.
- `titleTreatmentUrl` — title treatment (solo slideshow y corner)
- `channelIconUrl` / `channelName` — icono del canal y nombre inferido de la URL
- `schedule`, `live`, `duration` — horario, indicador en directo, duración (emisiones)
- `title`, `year`, `ageRating` — datos de la card (genérico)

### Carga de imágenes EPG

Las imágenes EPG de OTV (`/epg/COVER/...`) no pueden cargarse con `figma.createImageAsync()` desde el sandbox de Figma. El plugin las descarga primero en la UI (iframe del navegador, con acceso permitido por `networkAccess.allowedDomains` en el manifest) y envía los bytes al backend con `figma.createImage(bytes)`. Si el fetch en la UI falla, cae al fallback de `createImageAsync`.

### Provider logo en cards de canal

- `extractChannelName()` extrae el nombre del canal desde la URL del icono (dos patrones: `/attachments_new/{NAME}_{NNNxNNN}.ext` y `/attachments/{name}.ext`)
- `CHANNEL_TO_PROVIDER` en `code.ts` mapea nombres de URL a variantes del componente `providerLogoSquare` en Figma
- `findBestVariantMatch()` intenta en orden: **exact match** (si las variantes en Figma se renombran para coincidir con los nombres de URL, esto resuelve directamente — TODO: eliminar la tabla cuando se complete el renombrado), tabla explícita, case-insensitive, fuzzy normalizado

### Archivos clave

- `v3/src/ui/components/HtmlPasteTab.tsx` — parser + componente React de la pestaña
- `v3/src/code.ts` — handlers `apply-cover-url` y `apply-multiple-covers-url`, `CHANNEL_TO_PROVIDER`, `findBestVariantMatch`, `applyProviderLogo`

---

## Proceso para añadir más contenidos al catálogo

> El plugin ya NO usa Supabase. El catálogo se sirve como JSON estático desde GitHub raw.
> Flujo: editar JSON local → git push → el plugin carga el nuevo JSON en la próxima apertura (cache 4h).

### Paso 1 — Obtener el HTML de Orange TV
1. Ir a `orangetv.orange.es` en el navegador
2. Inspeccionar elemento → copiar el HTML de la página completa (o de la sección deseada)
3. Pegar en `v3/catalog/OrangeCatalog.html` (reemplazar el contenido anterior)

### Paso 2 — Extraer y mergear el catálogo local
```bash
cd "v3/catalog"
node extract-catalog-v2.js
```
- Lee `OrangeCatalog.html`
- Extrae pares `{ title, contentId }` de los `card__name` + URLs de imagen
- Mergea con `otv-catalog.json` existente (preserva datos TMDB de entradas previas)
- Informa: nuevas entradas, actualizadas, total

### Paso 3 — Enriquecer con TMDB (opcional, para entradas nuevas sin metadata)
```bash
SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co" \
SUPABASE_SERVICE_KEY="<service key arriba>" \
TMDB_API_KEY="505c512e8ca4921b7296e4a2ca254fd7" \
node "v3/scripts/enrich-catalog.js" --only-missing
```

### Paso 4 — Añadir géneros al JSON y publicar
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 \
SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co" \
SUPABASE_ANON_KEY="<anon key arriba>" \
node "v3/scripts/export-static-catalog.js"
```
- Añade el objeto `genres` (mapa id→nombre) al JSON
- A continuación, hacer commit y push:
```bash
git add v3/catalog/otv-catalog.json
git commit -m "chore(catalog): actualizar catálogo"
git push
```
El plugin cargará el JSON actualizado en la próxima apertura (o al cabo de 4h de cache).

### Paso 5 — Revisar entradas con contentId sospechoso
El parser a veces captura slugs de URL en lugar de IDs reales (ej: `anaconda-2025` en vez de `SKYS_...`). Señales de alerta: contentId sin prefijo de proveedor en mayúsculas, o contentId que parece un slug. Editarlos directamente en `otv-catalog.json` o desactivarlos con:
```bash
SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co" \
SUPABASE_SERVICE_KEY="<service key arriba>" \
node "v3/scripts/manage-content.js" --disable --contentId "el-id-malo"
```

---

## Comandos útiles de gestión

```bash
# Activar un contenido desactivado
node "v3/scripts/manage-content.js" --enable --contentId "MFO_123456"

# Añadir un contenido individual sin HTML
node "v3/scripts/add-content.js" --title "Título" --contentId "SKYS_0001234567"

# Añadir varios desde un JSON: [{ "title": "...", "contentId": "..." }]
node "v3/scripts/add-content.js" --file nuevos.json

# Re-enriquecer un contenido específico
node "v3/scripts/enrich-catalog.js" --contentId "MFO_123456"
```
Los scripts de enrichment (`enrich-catalog.js`, `manage-content.js`, `add-content.js`) requieren `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` si se usan para escribir en Supabase. Para el flujo normal (solo actualizar el JSON para GitHub), solo se necesita `SUPABASE_ANON_KEY` en `export-static-catalog.js` (lectura de géneros).

---

## Supabase — Estado (OBSOLETO para el plugin)

> El plugin ya no usa Supabase. Los scripts CLI (`enrich-catalog.js`, `manage-content.js`, etc.) todavía pueden usarlo para enrichment local, pero el plugin carga el catálogo desde GitHub raw.
> El LaunchAgent de keep-alive (`com.frogtv.supabase-keepalive`) puede desactivarse si ya no se necesita Supabase para los scripts.

```bash
# Desactivar el keep-alive si ya no se necesita Supabase
launchctl unload ~/Library/LaunchAgents/com.frogtv.supabase-keepalive.plist
```

---

## Estado del catálogo (2026-05-20)

- **699 contenidos** en `otv-catalog.json` (GitHub raw)
- 27 géneros incluidos en el JSON
- El plugin carga desde `https://raw.githubusercontent.com/mlhenche/otv-coveromatic/main/v3/catalog/otv-catalog.json`

---

## Próximas tareas (ver TODO.md para detalle)

1. **Completar tabla `CHANNEL_TO_PROVIDER`** — renombrar las variantes del componente `providerLogoSquare` en Figma para que coincidan exactamente con los nombres de canal extraídos de las URLs de OTV (ej. `LA_SEXTA`, `ANTENA3`). Cuando se haga, el exact match en `findBestVariantMatch` resolverá directamente y la tabla podrá eliminarse.

2. **Componente `card_emission` en Figma** — el DS aún no tiene un componente específico para emisiones en directo. La pestaña HTML ya parsea las emissions cards (`backgroundUrl`, `channelIconUrl`, `schedule`, `live`, `duration`), pero necesita un componente Figma con esas capas para aplicar los datos completos.

3. **Nuevos componentes del DS 2026** — si el Design System evoluciona y aparecen nuevos tipos de card, hay que actualizar la detección en `code.ts` y los `switch` de URLs en `CoverGrid.tsx`

---

## Cosas que NO hacer

- No editar `v3/plugin/code.js` ni `v3/plugin/ui.html` directamente — son builds. Editar las fuentes en `v3/src/` y compilar.
- No usar la service key en el código del plugin — solo en scripts CLI.
- No hacer hard delete en Supabase — siempre soft delete con `active: false`.
- No commitear `OrangeCatalog.html` — es un archivo de trabajo temporal grande.
