#!/usr/bin/env node
/**
 * update-ui-for-supabase.js
 *
 * Actualiza ui.html para que cargue el catálogo desde Supabase
 * en lugar del JSON embebido.
 *
 * Cambios que realiza:
 * 1. Elimina OTV_CATALOG_DATA embebido (reduce ~50KB del archivo)
 * 2. Reemplaza loadOTVCatalog() con versión async que fetch de Supabase
 * 3. Añade función helper para Supabase
 * 4. Mantiene compatibilidad con código existente
 */

const fs = require('fs');
const path = require('path');

const UI_PATH = path.join(__dirname, '../plugin/ui.html');

console.log('🔧 Actualizando ui.html para Supabase...\n');

// Read file
let content = fs.readFileSync(UI_PATH, 'utf-8');

// 1. Remove embedded catalog (find and remove the massive JSON)
console.log('📝 Paso 1: Eliminando catálogo embebido...');
const catalogStart = content.indexOf('const OTV_CATALOG_DATA_LEGACY = {');
const catalogEnd = content.indexOf('function loadOTVCatalog()');

if (catalogStart === -1 || catalogEnd === -1) {
  console.error('❌ No se encontró el catálogo embebido o la función loadOTVCatalog');
  process.exit(1);
}

const beforeCatalog = content.substring(0, catalogStart);
const afterCatalog = content.substring(catalogEnd);

// Add comment explaining removal
const replacement = `// Catalog now loaded from Supabase (removed ~50KB of embedded JSON)
    // URL patterns are fetched from Supabase config table

    `;

content = beforeCatalog + replacement + afterCatalog;
console.log('   ✓ Catálogo embebido eliminado\n');

// 2. Replace loadOTVCatalog function with async version
console.log('📝 Paso 2: Reemplazando loadOTVCatalog() con versión async...');

const oldFunction = `function loadOTVCatalog() {
      otvCatalog = OTV_CATALOG_DATA;
      const entries = Object.values(otvCatalog.catalog);
      otvMovies = entries.filter(e => e.mediaType === 'movie');
      otvSeries = entries.filter(e => e.mediaType === 'tv');
      console.log(\`OTV catalog loaded: \${otvMovies.length} movies, \${otvSeries.length} series\`);
    }`;

const newFunction = `// -- Supabase helper --
    async function sbFetch(endpoint) {
      const url = \`\${SUPABASE_URL}/rest/v1/\${endpoint}\`;
      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(\`Supabase error \${response.status}: \${await response.text()}\`);
      }

      return response.json();
    }

    // -- Load OTV catalog from Supabase --
    async function loadOTVCatalog() {
      try {
        console.log('Loading OTV catalog from Supabase...');

        // Fetch contents and genres in parallel
        const [contents, genres, config] = await Promise.all([
          sbFetch('contents?active=eq.true&select=title,content_id,media_type,tmdb_id,tmdb_title,genre_ids,provider'),
          sbFetch('genres?select=id,name'),
          sbFetch('config?key=eq.url_patterns&select=value')
        ]);

        // Build genre names map
        const genreNames = {};
        genres.forEach(g => {
          genreNames[g.id] = g.name;
        });

        // Transform to match expected format (camelCase properties)
        const catalog = {};
        contents.forEach(c => {
          const key = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          catalog[key] = {
            title: c.title,
            contentId: c.content_id,
            mediaType: c.media_type,
            tmdbId: c.tmdb_id,
            tmdbTitle: c.tmdb_title,
            genreIds: c.genre_ids || []
          };
        });

        // Get URL patterns from config or use defaults
        const urlPatterns = config[0]?.value || {
          coverArt: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160',
          vertical: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160',
          background: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160',
          titleTreatment: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720'
        };

        // Build catalog object matching expected structure
        otvCatalog = {
          generatedAt: new Date().toISOString(),
          source: 'Supabase',
          totalContents: contents.length,
          urlPatterns,
          catalog,
          genreNames
        };

        // Filter into movies and series
        const entries = Object.values(catalog);
        otvMovies = entries.filter(e => e.mediaType === 'movie');
        otvSeries = entries.filter(e => e.mediaType === 'tv');

        console.log(\`OTV catalog loaded from Supabase: \${otvMovies.length} movies, \${otvSeries.length} series\`);

        // Save to cache via code.ts
        parent.postMessage({
          pluginMessage: {
            type: 'cache-catalog',
            data: otvCatalog
          }
        }, '*');

        return true;
      } catch (error) {
        console.error('Error loading catalog from Supabase:', error);

        // Try to load from cache via code.ts
        console.log('Attempting to load from cache...');
        parent.postMessage({
          pluginMessage: {
            type: 'get-cached-catalog'
          }
        }, '*');

        return false;
      }
    }`;

content = content.replace(oldFunction, newFunction);
console.log('   ✓ Función loadOTVCatalog() actualizada\n');

// 3. Update initialization code to handle async loading
console.log('📝 Paso 3: Actualizando inicialización...');

// Find where loadOTVCatalog() is called (around line 1947)
const oldInit = 'loadOTVCatalog();';
const newInit = `// Load catalog asynchronously from Supabase
      loadOTVCatalog().then(success => {
        if (!success) {
          showEmpty('⚠️', 'Error cargando catálogo.\\nComprueba tu conexión.');
        }
      });`;

if (content.includes(oldInit)) {
  content = content.replace(oldInit, newInit);
  console.log('   ✓ Inicialización actualizada para async\n');
} else {
  console.warn('   ⚠️  No se encontró la llamada a loadOTVCatalog() en init\n');
}

// Write updated file
fs.writeFileSync(UI_PATH, content, 'utf-8');

console.log('✅ Actualización completada!\n');
console.log('📊 Resumen:');
console.log('   - Catálogo embebido eliminado (~50KB menos)');
console.log('   - loadOTVCatalog() ahora carga desde Supabase');
console.log('   - Sistema de caché implementado');
console.log('   - Fallback a caché si Supabase falla');
console.log('\n⚠️  IMPORTANTE: Falta implementar el handler en code.ts para cache-catalog y get-cached-catalog');
