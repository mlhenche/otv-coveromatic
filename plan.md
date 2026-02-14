# TMDB Covers — Figma Plugin

Plugin de Figma que permite buscar imágenes de películas, series o personas en **TheMovieDB (TMDB)** y aplicarlas como fondo a frames llamados `cover` dentro de los componentes seleccionados.

## Funcionalidad

1. **Selección de categoría**: Cine / Series / Personas (tabs)
2. **Contenido trending**: Al abrir muestra trending de la categoría seleccionada
3. **Búsqueda**: Campo de texto para buscar contenido específico
4. **Grid de resultados**: Muestra posters/fotos en grid clickable
5. **Recargar**: Botón para cargar nuevas imágenes (siguiente página de resultados)
6. **Aplicar a múltiples**: Si se seleccionan N componentes, la imagen se aplica al frame `cover` de cada uno

## Arquitectura

```
plugin/covers/
├── manifest.json       ← Config del plugin Figma
├── package.json        ← Dependencias (TypeScript)
├── tsconfig.json       ← Config TypeScript
├── code.ts             ← Sandbox de Figma (acceso a nodos)
└── ui.html             ← UI del plugin (iframe: HTML + CSS + JS inline)
```

> [!IMPORTANT]
> Se necesita una **API Key de TMDB** (gratuita). El usuario deberá registrarse en [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) para obtenerla.

## Proposed Changes

### Plugin Manifest

#### [NEW] manifest.json

Configuración del plugin con permisos de red para TMDB:
- `networkAccess.allowedDomains`: `api.themoviedb.org`, `image.tmdb.org`
- `editorType`: `figma`
- `main`: `code.js`
- `ui`: `ui.html`

---

### TypeScript Config

#### [NEW] tsconfig.json

Config para compilar `code.ts` → `code.js` con los tipos de la API de Figma.

#### [NEW] package.json

Dependencias dev: `typescript`, `@figma/plugin-typings`.

---

### Sandbox — `code.ts`

#### [NEW] code.ts

Lógica principal del plugin (se ejecuta en el sandbox de Figma):

- `figma.showUI(...)` — Abre la UI con tamaño adecuado
- **`get-selection`**: Informar a la UI cuántos componentes están seleccionados
- **`apply-cover`**: Recibe los bytes de imagen y:
  1. Itera sobre `figma.currentPage.selection`
  2. Para cada nodo, busca recursivamente un hijo con `name === "cover"`
  3. Usa `figma.createImage(bytes)` para crear la imagen
  4. Asigna `fills = [{ type: 'IMAGE', imageHash, scaleMode: 'FILL' }]`
- **`selection-changed`**: Escucha cambios de selección con `figma.on('selectionchange', ...)`

---

### UI — `ui.html`

#### [NEW] ui.html

HTML + CSS + JS todo inline (requerido por Figma plugins). Secciones:

**Layout**:
- Header con campo API Key (almacenada en `localStorage`)
- Tabs: 🎬 Cine | 📺 Series | 👤 Personas
- Barra de búsqueda
- Grid de imágenes (posters/fotos)
- Footer: botón "Recargar" + info de selección

**JS — Integración TMDB**:
- Endpoints usados:
  - `GET /3/trending/{movie|tv|person}/week` — Trending
  - `GET /3/search/{movie|tv|person}?query=...` — Búsqueda
- Construcción de URLs de imagen: `https://image.tmdb.org/t/p/w500/{poster_path}`
- Para personas: usa `profile_path` en vez de `poster_path`

**JS — Interacción con Figma**:
- Click en imagen → `fetch` de la imagen → convertir a `Uint8Array` → `parent.postMessage({ type: 'apply-cover', imageBytes })`
- Botón recargar → incrementa página → nueva petición a la API
- Recibe mensajes del sandbox sobre la selección actual

**Estilo**:
- Dark theme (coherente con Figma)
- Grid responsive de 3 columnas
- Hover effects en las imágenes
- Animación de loading

## Verification Plan

### Manual Verification

> [!NOTE]
> Este plugin requiere verificación manual en Figma.

1. **Compilar el plugin**:
   ```bash
   cd "plugin/covers"
   npm install
   npx tsc
   ```

2. **Cargar en Figma**:
   - Figma → Plugins → Development → Import plugin from manifest
   - Seleccionar `manifest.json`

3. **Test funcional**:
   - Crear un Frame con un hijo Frame llamado `cover`
   - Seleccionar el frame padre
   - Ejecutar el plugin
   - Introducir API key de TMDB
   - Verificar que aparecen imágenes trending de películas
   - Cambiar a tab Series → verificar que carga series
   - Cambiar a tab Personas → verificar que carga fotos
   - Buscar "Matrix" → verificar resultados
   - Click en una imagen → verificar que se aplica al frame `cover`
   - Click en "Recargar" → verificar que muestra nuevas imágenes
   - Seleccionar múltiples frames → verificar que se aplica a todos
