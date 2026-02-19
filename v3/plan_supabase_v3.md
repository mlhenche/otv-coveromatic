# Plan: Migración del catálogo OTV a Supabase (v3)

## Contexto

Actualmente el catálogo OTV (321 contenidos) está **hardcodeado** como un JSON embebido en `ui.html` (~línea 1816). Cada vez que se añade, elimina o modifica un contenido hay que:
1. Editar manualmente el JSON o ejecutar scripts de enriquecimiento
2. Copiar el resultado al HTML
3. Republicar el plugin en Figma

Esto es frágil, lento y no escala. La migración a **Supabase** permitiría:
- Actualizar el catálogo sin tocar el plugin
- Que múltiples personas gestionen el catálogo desde un panel web
- Versionar y auditar cambios automáticamente
- Escalar a miles de contenidos sin impactar el tamaño del plugin

---

## Arquitectura propuesta

```
┌─────────────────────┐       ┌──────────────────────┐
│  Figma Plugin (v3)  │──────▶│  Supabase REST API   │
│  ui.html            │ fetch │                      │
│                     │◀──────│  - contents          │
│  (sin JSON embebido)│       │  - genres            │
└─────────────────────┘       │  - url_patterns      │
                              │  - config            │
┌─────────────────────┐       │                      │
│  Panel Admin (web)  │──────▶│  RLS: anon = read    │
│  (opcional, futuro) │       │  RLS: admin = write   │
└─────────────────────┘       └──────────────────────┘
                                       │
                              ┌────────▼─────────┐
                              │  Scripts enrich   │
                              │  (Node.js CLI)    │
                              │  TMDB → Supabase  │
                              └──────────────────┘
```

---

## 1. Schema de base de datos en Supabase

### Tabla `contents`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` (PK) | Auto-generado |
| `title` | `text` NOT NULL | Título en español |
| `content_id` | `text` UNIQUE NOT NULL | ID OTV (ej: `SKYS_299645665`) |
| `media_type` | `text` | `'movie'`, `'tv'`, o `null` |
| `tmdb_id` | `integer` | ID en TMDB |
| `tmdb_title` | `text` | Título según TMDB |
| `genre_ids` | `integer[]` | Array de IDs de género |
| `provider` | `text` | Extraído del prefijo (`Prime Video`, `Disney+`...) |
| `active` | `boolean` DEFAULT true | Para desactivar sin borrar |
| `created_at` | `timestamptz` | Auto |
| `updated_at` | `timestamptz` | Auto |

**Índices:**
- `idx_contents_media_type` en `media_type`
- `idx_contents_genre_ids` en `genre_ids` (GIN)
- `idx_contents_title_search` — trigram index para búsqueda fuzzy

### Tabla `genres`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `integer` (PK) | ID de TMDB (ej: 18) |
| `name` | `text` NOT NULL | Nombre en español (ej: "Drama") |

### Tabla `config`

| Columna | Tipo | Notas |
|---------|------|-------|
| `key` | `text` (PK) | Clave de configuración |
| `value` | `jsonb` | Valor |

Almacena: `url_patterns`, `provider_map`, versión del catálogo, etc.

---

## 2. Row Level Security (RLS)

```sql
-- contents: lectura pública, escritura solo admin
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON contents FOR SELECT USING (true);
CREATE POLICY "Admin write" ON contents FOR ALL USING (auth.role() = 'authenticated');

-- genres: lectura pública
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON genres FOR SELECT USING (true);

-- config: lectura pública
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON config FOR SELECT USING (true);
```

La `anon key` (pública, va en el plugin) solo permite **lectura**.

---

## 3. Cambios en el plugin (ui.html)

### 3.1 Eliminar JSON embebido

- Eliminar la constante `OTV_CATALOG_DATA` (~línea 1816, es enorme)
- El tamaño del HTML se reducirá drásticamente

### 3.2 Nuevo módulo de conexión Supabase

```javascript
// Configuración Supabase
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_KEY = 'eyJhbG...'; // anon key (pública, solo lectura)
const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function sbFetch(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}
```

### 3.3 Reemplazar `loadOTVCatalog()`

**Antes** (síncrono, JSON embebido):
```javascript
function loadOTVCatalog() {
  otvCatalog = OTV_CATALOG_DATA;
  const entries = Object.values(otvCatalog.catalog);
  otvMovies = entries.filter(e => e.mediaType === 'movie');
  otvSeries = entries.filter(e => e.mediaType === 'tv');
}
```

**Después** (async, fetch a Supabase):
```javascript
async function loadOTVCatalog() {
  const [contents, genres, config] = await Promise.all([
    sbFetch('contents?active=eq.true&select=title,content_id,media_type,tmdb_id,tmdb_title,genre_ids'),
    sbFetch('genres?select=id,name'),
    sbFetch('config?key=eq.url_patterns&select=value')
  ]);

  // Adaptar al formato actual para minimizar cambios downstream
  otvMovies = contents.filter(e => e.media_type === 'movie')
    .map(e => ({ ...e, contentId: e.content_id, mediaType: e.media_type, tmdbId: e.tmdb_id, tmdbTitle: e.tmdb_title, genreIds: e.genre_ids }));
  otvSeries = contents.filter(e => e.media_type === 'tv')
    .map(e => ({ ...e, contentId: e.content_id, mediaType: e.media_type, tmdbId: e.tmdb_id, tmdbTitle: e.tmdb_title, genreIds: e.genre_ids }));

  // Genre names map
  genreNamesMap = {};
  genres.forEach(g => genreNamesMap[g.id] = g.name);

  otvCatalog = { genreNames: genreNamesMap, urlPatterns: config[0]?.value || URL_PATTERNS_DEFAULT };
}
```

### 3.4 Caché local con TTL + fallback offline

Para minimizar llamadas a Supabase y que el plugin funcione sin conexión:

- Los datos se guardan en `clientStorage` de Figma con un **timestamp**
- Al abrir el plugin, se comprueba si el caché tiene menos de **4 horas** (TTL)
- Si el caché es válido → se usa directamente (sin fetch a Supabase)
- Si ha expirado o no existe → se hace fetch, se guarda en caché y se usa
- Si el fetch falla y hay caché (aunque expirado) → se usa como fallback

```javascript
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

async function loadOTVCatalog() {
  // 1. Comprobar caché con TTL
  const cached = await figma.clientStorage.getAsync('otv_catalog_cache');
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    applyData(cached.data);
    return;
  }

  // 2. Fetch desde Supabase
  try {
    const data = await fetchFromSupabase();
    await figma.clientStorage.setAsync('otv_catalog_cache', {
      data,
      timestamp: Date.now()
    });
    applyData(data);
  } catch (err) {
    // 3. Fallback: usar caché expirado si existe
    if (cached) {
      applyData(cached.data);
      console.warn('Using expired cache (offline mode)');
    } else {
      showEmpty('⚠️', 'No se pudo cargar el catálogo. Comprueba tu conexión.');
    }
  }
}
```

> **Nota:** `clientStorage` está en `code.ts` (sandbox), no en `ui.html`. La comunicación sería via `postMessage`.

### 3.5 Funciones que necesitan adaptación mínima

Estas funciones usan `otvMovies`, `otvSeries` y `otvCatalog.genreNames` — si el mapper del punto 3.3 mantiene la misma interfaz, **no necesitan cambios**:

| Función | Línea | Usa |
|---------|-------|-----|
| `renderCatalog()` | ~2442 | `otvMovies`, `otvSeries`, `currentQuery`, `currentGenreId` |
| `updateGenreFilter()` | ~2029 | `otvCatalog.genreNames`, `otvMovies`, `otvSeries` |
| `applyOTVContent()` | ~2748 | `entry.contentId`, URL patterns |
| `applyRelatedContent()` | ~3122 | `otvMovies`, `otvSeries`, `entry.genreIds` |
| `fetchOTVMetadata()` | ~2621 | `entry.tmdbId`, `entry.contentId` |

---

## 4. Scripts de migración y enriquecimiento

### 4.1 Script de migración inicial

Archivo: `v3/scripts/migrate-to-supabase.js`

- Lee el JSON actual de `OTV_CATALOG_DATA`
- Transforma cada entrada al schema de Supabase
- Inserta en bulk via Supabase REST API
- Rellena tabla `genres` y `config`

### 4.2 Script de enriquecimiento actualizado

Archivo: `v3/scripts/enrich-catalog.js`

- En lugar de escribir un JSON local, hace `UPSERT` directamente a Supabase
- Busca en TMDB → actualiza `tmdb_id`, `tmdb_title`, `genre_ids`
- Puede ejecutarse periódicamente (cron o manual)

### 4.3 Script para añadir contenido nuevo

Archivo: `v3/scripts/add-content.js`

```bash
node add-content.js --title "Nueva Película" --contentId "SKYS_123456"
```

- Inserta el contenido en Supabase
- Opcionalmente enriquece con TMDB automáticamente

---

## 5. Gestión del catálogo: cómo añadir y actualizar contenidos

### 5.1 Flujo para añadir contenidos nuevos

**Opción A: Script CLI (recomendado para lotes)**

```bash
# Añadir un contenido individual
node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001"

# Añadir varios desde un CSV/JSON
node add-content.js --file nuevos-contenidos.json
```

El script:
1. Recibe título y contentId (mínimo necesario)
2. Busca automáticamente en TMDB por título → obtiene `tmdb_id`, `media_type`, `genre_ids`
3. Extrae el provider del prefijo del `contentId` (SKYS → SkyShowtime)
4. Hace `INSERT` en Supabase tabla `contents`
5. Si hay géneros nuevos que no existen en tabla `genres`, los añade
6. Muestra resumen de lo insertado

**Formato del JSON de entrada para lotes:**
```json
[
  { "title": "Gladiator II", "contentId": "SKYS_0002700001" },
  { "title": "Wicked 2", "contentId": "SKYS_0002700002" },
  { "title": "Thunderbolts", "contentId": "DSN_abc123-def456" }
]
```

> Solo necesitas título y contentId — el script rellena todo lo demás vía TMDB.

**Opción B: Panel de Supabase (manual, contenidos sueltos)**

1. Ir a `app.supabase.com` → proyecto → Table Editor → `contents`
2. Click "Insert row"
3. Rellenar `title`, `content_id`, `media_type`
4. Ejecutar script de enriquecimiento para rellenar TMDB data:
   ```bash
   node enrich-catalog.js --only-missing
   ```

**Opción C: Panel Admin web (futuro)**

Una webapp sencilla con formulario para:
- Buscar contenido por título (autocompletado contra TMDB)
- Seleccionar el resultado correcto
- Introducir el `contentId` de OTV
- Guardar → inserta en Supabase ya enriquecido

### 5.2 Flujo para actualizar contenidos existentes

**Actualizar metadatos TMDB (géneros, título, etc.):**
```bash
# Re-enriquecer todo el catálogo
node enrich-catalog.js

# Re-enriquecer solo los que no tienen tmdbId
node enrich-catalog.js --only-missing

# Re-enriquecer un contenido específico
node enrich-catalog.js --contentId "SKYS_0002700001"
```

**Desactivar un contenido (sin borrar):**
```bash
node manage-content.js --disable --contentId "SKYS_0002700001"
```
Esto pone `active = false` → el plugin deja de mostrarlo pero los datos se conservan.

**Reactivar:**
```bash
node manage-content.js --enable --contentId "SKYS_0002700001"
```

### 5.3 Flujo para importar desde el HTML de OrangeTV

Actualmente el catálogo se genera parseando el HTML de la web de Orange TV. Este flujo se mantiene pero el destino cambia:

**Antes (v2):**
```
OrangeTV HTML → parse-catalog.js → catalog.json → copiar a ui.html
```

**Después (v3):**
```
OrangeTV HTML → parse-catalog.js → catalog.json → sync-to-supabase.js → Supabase
```

Archivo: `v3/scripts/sync-to-supabase.js`

```bash
node sync-to-supabase.js --file catalog.json
```

El script:
1. Lee el JSON generado por el parser existente
2. Compara con los contenidos actuales en Supabase
3. **Nuevos** → `INSERT` + enriquecimiento TMDB automático
4. **Existentes** → `UPDATE` solo si hay cambios (título, contentId)
5. **Eliminados** → `active = false` (soft delete, no borra)
6. Muestra resumen: X nuevos, Y actualizados, Z desactivados

### 5.4 Cuándo se refleja en el plugin

El plugin carga el catálogo de Supabase **cada vez que se abre**. No hay que republicar ni actualizar nada:

1. Añades contenido en Supabase (por cualquier vía)
2. El diseñador cierra y reabre el plugin (o cambia de pestaña)
3. El nuevo contenido aparece disponible

Para forzar recarga sin cerrar el plugin, se podría añadir un botón "Actualizar catálogo" que vuelva a llamar a `loadOTVCatalog()`.

---

## 6. GitHub Actions: keep-alive para Supabase free tier

Supabase pausa los proyectos del free tier tras **7 días sin actividad**. Para evitarlo, un workflow de GitHub Actions hace un query simple cada 5 días.

### Archivo: `.github/workflows/supabase-keep-alive.yml`

```yaml
name: Supabase Keep Alive

on:
  schedule:
    - cron: '0 8 */5 * *'   # Cada 5 días a las 8:00 UTC
  workflow_dispatch:          # Permite ejecución manual

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -s -o /dev/null -w "%{http_code}" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/config?select=key&limit=1"
```

### Secrets necesarios en GitHub

| Secret | Valor |
|--------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | La anon key pública del proyecto |

> El workflow solo hace una lectura (`SELECT`) — no modifica datos. Basta para mantener el proyecto activo.

---

## 7. Orden de implementación

### Fase 1: Supabase setup
1. Crear proyecto en Supabase
2. Crear tablas (`contents`, `genres`, `config`) con RLS
3. Ejecutar script de migración para poblar datos actuales

### Fase 2: Plugin v3
4. Crear carpeta `v3/` (copia de `v2/`)
5. Añadir módulo `sbFetch` en `ui.html`
6. Reemplazar `loadOTVCatalog()` por versión async con caché TTL
7. Añadir mapper camelCase para compatibilidad con código existente
8. Eliminar `OTV_CATALOG_DATA` del HTML
9. Implementar caché con TTL en `clientStorage` via `code.ts`

### Fase 3: Scripts de gestión
10. Crear `migrate-to-supabase.js` (migración inicial del JSON actual)
11. Crear `add-content.js` (alta individual o por lotes con enriquecimiento TMDB)
12. Crear `enrich-catalog.js` (re-enriquecimiento TMDB → Supabase)
13. Crear `sync-to-supabase.js` (sincronización desde HTML de OrangeTV)
14. Crear `manage-content.js` (activar/desactivar contenidos)

### Fase 4: GitHub Actions
15. Crear workflow `supabase-keep-alive.yml`
16. Configurar secrets en el repositorio de GitHub

### Fase 5: Verificación
17. Test completo del plugin con datos de Supabase
18. Verificar caché TTL (datos se reutilizan dentro de las 4h)
19. Verificar fallback offline con caché expirado
20. Verificar que el keep-alive ejecuta correctamente

---

## 8. Verificación

| Escenario | Resultado esperado |
|-----------|-------------------|
| Abrir plugin con conexión | Carga catálogo de Supabase, muestra películas/series |
| Buscar por título | Filtra correctamente |
| Filtrar por género | Muestra solo contenidos del género |
| Aplicar cover portrait/landscape/VPS | URLs generadas correctamente |
| Añadir contenido relacionado | Algoritmo por géneros funciona igual |
| Añadir capítulos de serie | Fetch a TMDB funciona (no depende del catálogo) |
| Reabrir plugin antes de 4h | Usa caché local, no hace fetch a Supabase |
| Reabrir plugin después de 4h | Hace fetch nuevo a Supabase, actualiza caché |
| Sin conexión (primera vez) | Muestra error amigable |
| Sin conexión (con caché expirado) | Usa datos cacheados, avisa al usuario |
| Añadir contenido nuevo en Supabase | Aparece en el plugin al reabrir (tras expirar caché) |
| GitHub Actions keep-alive | Ejecuta cada 5 días sin errores |

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `v3/plugin/ui.html` | Eliminar JSON, añadir sbFetch, async loadOTVCatalog |
| `v3/src/code.ts` | Añadir caché con TTL via clientStorage + postMessage |
| `v3/scripts/migrate-to-supabase.js` | Nuevo: migración inicial |
| `v3/scripts/enrich-catalog.js` | Nuevo: enriquecimiento TMDB → Supabase |
| `v3/scripts/add-content.js` | Nuevo: alta individual o por lotes |
| `v3/scripts/sync-to-supabase.js` | Nuevo: sincronización desde parser OrangeTV |
| `v3/scripts/manage-content.js` | Nuevo: activar/desactivar contenidos |
| `v3/supabase/schema.sql` | Nuevo: DDL de tablas + RLS + índices |
| `.github/workflows/supabase-keep-alive.yml` | Nuevo: cron cada 5 días para evitar pausa |
