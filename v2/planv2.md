# Plan de Implementación: CoverOmatic v2.0 — Solo catálogo Orange TV

## Concepto

CoverOmatic v2.0 cambia radicalmente respecto a v1: **ya no se navega todo TMDB**. El plugin muestra **únicamente contenidos del catálogo Orange TV** (extraídos de `otv-catalog.json`). Las imágenes se descargan de los CDN de Orange TV. Los metadatos (título, rating, año, duración, sinopsis, ageTag) se obtienen de TMDB usando el `tmdbId` que ya tenemos en el catálogo.

## Lógica de imágenes según componente

El tipo de imagen que se aplica depende del **nombre del componente Figma** seleccionado:

| Nombre contiene | Frame `cover` | Frame `titleTreatment` |
|---|---|---|
| `card` + `portrait` | **VERTICAL** | — |
| `card` + `landscape` | **COVER_ART** | — |
| `slideshow` o `vps` | **BACKGROUND** | **TITLE_TREATMENT** |

URLs de Orange TV (todas verificadas funcionando):
- VERTICAL: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160`
- COVER_ART: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160`
- BACKGROUND: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160`
- TITLE_TREATMENT: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720`

## Flujo VPS → Personas

Cuando se aplica una imagen a un componente tipo `slideshow`/`vps`:
1. Se aplica BACKGROUND al frame `cover`
2. Se aplica TITLE_TREATMENT al frame `titleTreatment`
3. Se rellenan metadatos (título, rating, año, duración, sinopsis, ageTag)
4. Se rellenan hasta 3 géneros en los frames `genre`, `genre2`, `genre3` (con texto, no IDs)
   - Si hay menos de 3 géneros: ocultar los frames `genre` y `separator` sobrantes
5. El plugin cambia automáticamente al tab **Personas**, mostrando el cast/crew del contenido seleccionado (usando `tmdbId` → TMDB `/credits`)

## Tabs y navegación

- **Cine**: Grid con películas del catálogo OTV (`mediaType === 'movie'`)
- **Series**: Grid con series del catálogo OTV (`mediaType === 'tv'`)
- **Personas**: Funciona como v1 (búsqueda por nombre o por contenido), PERO con el flujo VPS auto-switch
- **Log**: Se mantiene igual que v1

### Filtros
- **Género**: Filtro dentro de Cine y Series (requiere enriquecer catálogo con `genre_ids` de TMDB)
- **Búsqueda por texto**: Filtro local sobre los títulos del catálogo
- **Eliminar**: Toggle portrait/landscape (ya no es necesario, el componente dicta el tipo)

## Botón aleatorio
Se mantiene: aplica contenidos aleatorios del catálogo OTV a los covers seleccionados.

---

## Datos del catálogo (`otv-catalog.json`)

Estructura actual (70 entries, YA ENRIQUECIDO con géneros):
```json
{
  "catalog": {
    "creed ii la leyenda de rocky": {
      "title": "Creed II: La leyenda de Rocky",
      "contentId": "MFO_0002696470",
      "mediaType": "movie",
      "tmdbId": 480530,
      "tmdbTitle": "Creed II: La leyenda de Rocky",
      "genreIds": [18, 28]
    }
  },
  "genreNames": {
    "12": "Aventura",
    "18": "Drama",
    "28": "Acción",
    ...
  },
  "genreEnrichedAt": "2026-02-17T11:58:46.745Z"
}
```

**Estado**: ✅ Catálogo enriquecido con 68/70 entries con géneros, 19 géneros únicos, mapa de 27 nombres.

---

## Archivos a modificar

### 1. `manifest.json` — Añadir dominio OTV

```json
"allowedDomains": [
  "https://api.themoviedb.org",
  "https://image.tmdb.org",
  "https://pc.orangetv.orange.es"
]
```

### 2. `code.ts` — Sandbox de Figma

#### 2.1 Añadir soporte para `titleTreatment`

Nueva función `isTitleTreatmentNode()` y `findTitleTreatmentNodes()` (mismo patrón que `isCoverNode`/`findCoverNodes`).

#### 2.2 Extender `sendSelection()` para enviar tipo de componente

```typescript
function sendSelection() {
    const selection = figma.currentPage.selection;
    const coverCount = findCoverNodes(selection).length;
    const titleTreatmentCount = findTitleTreatmentNodes(selection).length;

    // Detect component type from names
    const names = selection.map(n => n.name.toLowerCase());
    let componentType = 'unknown';
    for (const name of names) {
        if (name.includes('card') && name.includes('portrait')) { componentType = 'card-portrait'; break; }
        if (name.includes('card') && name.includes('landscape')) { componentType = 'card-landscape'; break; }
        if (name.includes('slideshow') || name.includes('vps')) { componentType = 'vps'; break; }
    }

    figma.ui.postMessage({
        type: 'selection-info',
        count: selection.length,
        coverCount,
        titleTreatmentCount,
        componentType
    });
}
```

#### 2.3 Extender interfaces de metadata

Añadir campo `genres` a `MovieTvMetadata`:
```typescript
interface MovieTvMetadata {
    title: string;
    rating: string;
    year: string;
    duration: string;
    ageRating: string;
    sinopsis: string;
    genres?: string[];  // NUEVO: array de nombres de género (max 3)
}
```

#### 2.4 Extender `fillMetadata()` para géneros en VPS

Después de rellenar los campos básicos (title, rating, year, duration, sinopsis) en el bloque Movie/TV (línea 95-107), añadir:

```typescript
// Fill genres (VPS only: genre, genre2, genre3)
if (metadata.genres && metadata.genres.length > 0) {
    const genreNames = ['genre', 'genre2', 'genre3'];
    const separatorNames = ['separator', 'separator2', 'separator3'];

    for (let i = 0; i < 3; i++) {
        const genreNode = findTextNode(node, genreNames[i]);
        const sepNode = findTextNode(node, separatorNames[i]);

        if (i < metadata.genres.length) {
            // Fill genre text
            if (genreNode) await setTextContent(node, genreNames[i], metadata.genres[i]);
            // Keep separator visible (it should be visible by default)
        } else {
            // Hide unused genre and its separator
            if (genreNode) genreNode.visible = false;
            if (sepNode) sepNode.visible = false;
        }
    }
}
```

#### 2.5 Extender interfaces y handlers de mensajes

- `CoverData` y `PluginMessage`: añadir campo `titleTreatmentBytes?: number[]`
- Handler `apply-cover`: después de aplicar cover, si hay `titleTreatmentBytes`, aplicar a nodos `titleTreatment` con `scaleMode: 'FIT'`
- Handler `apply-multiple-covers`: ídem, por cada coverData

### 3. `ui.html` — Interfaz completa

#### 3.1 Estado: reemplazar variables TMDB por OTV

```javascript
// ELIMINAR: currentOrientation, totalPages, currentPage
// AÑADIR:
let otvCatalog = {};        // El catálogo completo (se carga en init)
let otvMovies = [];          // Entradas filtradas: películas
let otvSeries = [];          // Entradas filtradas: series
let componentType = 'unknown'; // card-portrait | card-landscape | vps | unknown
let filteredResults = [];    // Resultados actuales después de filtros

const OTV_BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';
```

#### 3.2 Cargar catálogo: embebido en el plugin

El catálogo OTV se embebe directamente en `ui.html` como variable JS (o se carga desde `otv-catalog.json` vía script tag). Al abrir el plugin:
1. Parsear el catálogo
2. Separar en `otvMovies` y `otvSeries` según `mediaType`
3. Extraer géneros únicos para los filtros

#### 3.3 Grid: mostrar catálogo OTV

Reemplazar `loadContent()` → `renderCatalog()`:
- En tabs Cine/Series: mostrar thumbnail del catálogo OTV
- Thumbnail URL: usar VERTICAL (portrait) como imagen de preview en el grid (siempre portrait en el grid)
- Filtrado local: por texto (búsqueda sobre título) y por género
- Sin paginación: el catálogo es pequeño (<500 entries), todo se muestra

#### 3.4 `renderGrid()`: adaptar

- Grid items muestran imagen VERTICAL del contenido OTV como thumbnail
- Click → `applyOTVContent(entry)` en vez de `applyImage(url, item)`

#### 3.5 Nueva función `applyOTVContent(entry)`

```javascript
async function applyOTVContent(entry) {
    // 1. Determinar URLs según componentType
    let coverUrl, titleTreatmentUrl;
    switch (componentType) {
        case 'card-portrait':
            coverUrl = `${OTV_BASE}/VERTICAL/${entry.contentId}_VERTICAL.jpg?width=3840&height=2160`;
            break;
        case 'card-landscape':
            coverUrl = `${OTV_BASE}/COVER_ART/${entry.contentId}_COVER_ART.jpg?width=3840&height=2160`;
            break;
        case 'vps':
            coverUrl = `${OTV_BASE}/BACKGROUND/${entry.contentId}_BACKGROUND.jpg?width=3840&height=2160`;
            titleTreatmentUrl = `${OTV_BASE}/TITLE_TREATMENT/${entry.contentId}_title_treatment.png?width=1280&height=720`;
            break;
        default:
            coverUrl = `${OTV_BASE}/VERTICAL/${entry.contentId}_VERTICAL.jpg?width=3840&height=2160`;
    }

    // 2. Fetch metadata de TMDB (usando tmdbId)
    const metadata = await fetchOTVMetadata(entry);

    // 3. Fetch cover image bytes
    const coverBytes = await fetchImageBytes(coverUrl);

    // 4. Fetch title treatment bytes (si aplica)
    let ttBytes = null;
    if (titleTreatmentUrl) {
        try { ttBytes = await fetchImageBytes(titleTreatmentUrl); } catch(_) {}
    }

    // 5. Enviar a sandbox
    parent.postMessage({ pluginMessage: {
        type: 'apply-cover',
        imageBytes: coverBytes,
        titleTreatmentBytes: ttBytes,
        metadata
    }}, '*');

    // 6. Si es VPS → auto-switch a Personas con el cast
    if (componentType === 'vps' && entry.tmdbId) {
        switchToPersonasForContent(entry);
    }
}
```

#### 3.6 Nueva función `fetchOTVMetadata(entry)`

Usa `tmdbId` para fetch de metadatos de TMDB + convierte genreIds a nombres:
```javascript
async function fetchOTVMetadata(entry) {
    if (!entry.tmdbId) {
        return {
            title: entry.title,
            rating: '',
            year: '',
            duration: '',
            ageRating: '',
            sinopsis: '',
            genres: []
        };
    }

    const type = entry.mediaType || 'movie';
    const append = type === 'movie' ? 'release_dates' : 'content_ratings';
    const detail = await tmdbFetch(`${API_BASE}/${type}/${entry.tmdbId}?api_key=${apiKey}&language=es-ES&append_to_response=${append}`);

    // Extract metadata (same as v1)
    const title = detail.title || detail.name || entry.title;
    const rating = detail.vote_average ? detail.vote_average.toFixed(1) : '';
    const year = detail.release_date || detail.first_air_date ?
                 (detail.release_date || detail.first_air_date).substring(0, 4) : '';
    const duration = type === 'movie' ? formatDuration(detail.runtime) :
                     `${detail.number_of_seasons} temporada${detail.number_of_seasons === 1 ? '' : 's'}`;
    const ageRating = extractAgeRating(detail);
    const sinopsis = detail.overview || '';

    // Convert genreIds to genre names (max 3)
    const genres = (entry.genreIds || [])
        .slice(0, 3)
        .map(id => otvCatalog.genreNames[id])
        .filter(Boolean);

    return { title, rating, year, duration, ageRating, sinopsis, genres };
}
```

#### 3.7 Eliminar orientation toggle

- Eliminar HTML del toggle portrait/landscape (líneas 1099-1112)
- Eliminar `setOrientation()`, `currentOrientation`
- Eliminar lógica de filtrado por `backdrop_path` / `poster_path`

#### 3.8 Búsqueda local

Reemplazar la búsqueda TMDB por filtrado local:
```javascript
function filterCatalog(query, genreId) {
    const source = currentCategory === 'movie' ? otvMovies : otvSeries;
    let results = source;
    if (query) {
        const q = normalizeTitle(query);
        results = results.filter(e => normalizeTitle(e.title).includes(q));
    }
    if (genreId) {
        results = results.filter(e => e.genreIds && e.genreIds.includes(genreId));
    }
    return results;
}
```

#### 3.9 Géneros: extraer del catálogo

En vez de fetch a TMDB `/genre/movie/list`, extraer géneros únicos del catálogo:
```javascript
function loadGenresFromCatalog(category) {
    const source = category === 'movie' ? otvMovies : otvSeries;
    const genreMap = {};
    source.forEach(e => {
        (e.genreIds || []).forEach(id => {
            if (!genreMap[id]) genreMap[id] = GENRE_NAMES[id]; // mapa estático de id→nombre
        });
    });
    renderGenreBar(genreMap);
}
```

#### 3.10 Flujo VPS → Personas

```javascript
function switchToPersonasForContent(entry) {
    // Switch to personas tab
    switchTab('person');
    // Set "by content" mode
    setPersonSearchMode('by-content');
    // Auto-select this content
    selectedContent = {
        id: entry.tmdbId,
        title: entry.title,
        media_type: entry.mediaType
    };
    // Load credits
    loadCreditsForContent(entry.tmdbId, entry.mediaType);
}
```

#### 3.11 Handler `selection-info` actualizado

```javascript
if (msg.type === 'selection-info') {
    selectionCount = msg.count;
    coverCount = msg.coverCount;
    componentType = msg.componentType || 'unknown';
    updateSelectionInfo();
}
```

---

## Secuencia de implementación

### Fase 0: Preparación de datos ✅ COMPLETADA
1. ✅ Crear `enrich-genres.js` → añadir `genreIds` a cada entrada del catálogo
2. ✅ Ejecutar para actualizar `otv-catalog.json` (68/70 entries con géneros, mapa `genreNames` añadido)

### Fase 1: manifest.json
3. Añadir `https://pc.orangetv.orange.es` a `allowedDomains`

### Fase 2: code.ts (Sandbox)
4. Añadir `isTitleTreatmentNode()` + `findTitleTreatmentNodes()`
5. Extender `sendSelection()` con detección de `componentType`
6. Extender interfaces `CoverData` y `PluginMessage` con `titleTreatmentBytes`
7. Extender handler `apply-cover` para aplicar title treatment
8. Extender handler `apply-multiple-covers` para title treatment
9. Compilar: `npx tsc`

### Fase 3: ui.html (UI)
10. Embeber catálogo OTV como variable JS
11. Reemplazar `loadContent()` por `renderCatalog()` (datos locales OTV)
12. Reemplazar `renderGrid()` para usar thumbnails OTV (VERTICAL como preview)
13. Nueva función `applyOTVContent(entry)` con lógica por componentType
14. Nueva función `fetchOTVMetadata(entry)` para metadatos TMDB
15. Eliminar orientation toggle
16. Búsqueda local sobre títulos del catálogo
17. Géneros del catálogo (con mapa estático GENRE_NAMES)
18. Flujo VPS → auto-switch a Personas
19. Adaptar `applyRandomContent()` para catálogo OTV (incluir genres en metadata como en `applyOTVContent`)
20. Actualizar handler `selection-info` con `componentType`

### Fase 4: Testing
21. Compilar y verificar sin errores
22. Test en Figma con los 3 tipos de componente

---

## Funciones v1 que se mantienen (con modificaciones menores)

- `walkTree()` (code.ts:18-25) — sin cambios
- `isCoverNode()` (code.ts:28-30) — sin cambios
- `findCoverNodes()` (code.ts:191-201) — sin cambios
- `findTextNode()`, `findInstanceNode()`, `setTextContent()` (code.ts:33-63) — sin cambios
- **`fillMetadata()`** (code.ts:71-171) — **se extiende** con lógica de `genres` para VPS (genre, genre2, genre3 + separators)
- `findMetadataScope()` (code.ts:176-188) — sin cambios
- Tab Personas (ui.html) — se mantiene funcionalidad v1 + auto-switch desde VPS
- Tab Log (ui.html) — sin cambios
- `tmdbFetch()` (ui.html) — se sigue usando para metadatos y créditos
- `fetchDetail()`, `extractAgeRating()`, `formatDuration()` — se reutilizan en `fetchOTVMetadata()`

## Funciones v1 que se eliminan/reemplazan

- `loadContent()` → `renderCatalog()` (datos locales en vez de TMDB trending/search)
- `setOrientation()` + orientation toggle HTML/CSS
- `currentOrientation` state variable
- Grid rendering con `poster_path`/`backdrop_path` → ahora usa URLs OTV
- `applyImage()` → `applyOTVContent()` (nueva lógica por componentType)
- Paginación (`currentPage`, `totalPages`, botón "Más") → no necesaria con catálogo local

## Archivos finales modificados

1. **`manifest.json`** — Añadir dominio OTV
2. **`code.ts`** — TitleTreatment support + componentType detection
3. **`code.js`** — Recompilar
4. **`ui.html`** — Catálogo OTV embebido, nueva lógica de grid, applyOTVContent, VPS→Personas
5. **`otv-catalog.json`** — Enriquecido con genreIds
