#!/usr/bin/env node
/**
 * sync-to-supabase.js
 *
 * Sincroniza un catalog.json (generado por el parser de OrangeTV)
 * con la base de datos de Supabase.
 * - Nuevos → INSERT + enriquecimiento TMDB
 * - Existentes → UPDATE si hay cambios
 * - Eliminados → soft delete (active = false)
 *
 * Uso:
 *   node sync-to-supabase.js --file catalog.json
 *   node sync-to-supabase.js --file catalog.json --skip-enrichment
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL        - URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY - Service role key
 *   TMDB_API_KEY        - API key de TMDB (opcional si --skip-enrichment)
 */

const fs = require('fs');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const file = fileIndex >= 0 ? args[fileIndex + 1] : null;
const skipEnrichment = args.includes('--skip-enrichment');

if (!file) {
  console.error('❌ Debe especificar --file catalog.json');
  process.exit(1);
}

if (!TMDB_API_KEY && !skipEnrichment) {
  console.warn('⚠️  TMDB_API_KEY no configurada, los nuevos contenidos no serán enriquecidos');
  console.warn('   Use --skip-enrichment para omitir esta advertencia\n');
}

// Helper: fetch a Supabase REST API
async function sbFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

// Helper: search TMDB
async function searchTMDB(title, mediaTypeHint = null) {
  if (!TMDB_API_KEY) return null;

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=es-ES`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return null;
    }

    let results = searchData.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    if (mediaTypeHint) {
      const filtered = results.filter(r => r.media_type === mediaTypeHint);
      if (filtered.length > 0) results = filtered;
    }

    if (results.length === 0) return null;

    const result = results[0];
    return {
      tmdb_id: result.id,
      tmdb_title: result.title || result.name,
      media_type: result.media_type,
      genre_ids: result.genre_ids || [],
    };
  } catch (error) {
    console.warn(`   ⚠️  Error buscando en TMDB: ${error.message}`);
    return null;
  }
}

// Extraer provider del contentId
function extractProvider(contentId) {
  const prefix = contentId.split('_')[0];
  const providerMap = {
    'PRIME': 'Prime Video',
    'SKYS': 'SkyShowtime',
    'DSN': 'Disney+',
    'MAX': 'Max',
    'RTVE': 'RTVE Play',
    'FLMN': 'Filmin',
    'APREM': 'A3 Premium',
    'MFO': 'Orange TV',
    'FLX': 'Orange TV',
  };
  return providerMap[prefix] || null;
}

// Helper: delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Sincronizando catálogo con Supabase...\n');

  // 1. Leer catálogo local
  console.log(`📖 Leyendo ${file}...`);
  const catalogData = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { catalog } = catalogData;
  let entries = Object.values(catalog);

  // Deduplicar por contentId
  const uniqueMap = new Map();
  entries.forEach(entry => uniqueMap.set(entry.contentId, entry));
  entries = Array.from(uniqueMap.values());

  console.log(`   ✓ ${entries.length} contenidos únicos en el archivo\n`);

  // 2. Obtener contenidos actuales de Supabase
  console.log('📖 Obteniendo contenidos actuales de Supabase...');
  const existingContents = await sbFetch('contents?select=*');
  const existingMap = new Map(existingContents.map(c => [c.content_id, c]));
  console.log(`   ✓ ${existingContents.length} contenidos en Supabase\n`);

  // 3. Clasificar contenidos
  const toInsert = [];
  const toUpdate = [];
  const toKeep = new Set();

  for (const entry of entries) {
    const existing = existingMap.get(entry.contentId);
    toKeep.add(entry.contentId);

    if (!existing) {
      // Nuevo contenido
      toInsert.push(entry);
    } else if (existing.title !== entry.title) {
      // Contenido actualizado (título cambió)
      toUpdate.push({ existing, entry });
    }
  }

  // Contenidos a desactivar (estaban en Supabase pero ya no en el catálogo)
  const toDeactivate = existingContents.filter(c => !toKeep.has(c.content_id) && c.active);

  console.log('📊 Resumen de cambios:');
  console.log(`   📥 A insertar: ${toInsert.length}`);
  console.log(`   🔄 A actualizar: ${toUpdate.length}`);
  console.log(`   ⏸️  A desactivar: ${toDeactivate.length}\n`);

  let stats = { inserted: 0, updated: 0, deactivated: 0, errors: 0 };

  // 4. Insertar nuevos contenidos
  if (toInsert.length > 0) {
    console.log('📥 Insertando nuevos contenidos...\n');
    for (const entry of toInsert) {
      try {
        console.log(`   + ${entry.title}`);

        // Enriquecer con TMDB si es posible
        let tmdbData = null;
        if (!skipEnrichment && TMDB_API_KEY) {
          tmdbData = await searchTMDB(entry.title, entry.mediaType);
          if (tmdbData) {
            console.log(`     ✓ TMDB: ${tmdbData.tmdb_title} (${tmdbData.media_type})`);
          }
          await delay(250); // Rate limiting
        }

        const newContent = {
          title: entry.title,
          content_id: entry.contentId,
          media_type: tmdbData?.media_type || entry.mediaType || null,
          tmdb_id: tmdbData?.tmdb_id || entry.tmdbId || null,
          tmdb_title: tmdbData?.tmdb_title || entry.tmdbTitle || null,
          genre_ids: tmdbData?.genre_ids || entry.genreIds || [],
          provider: extractProvider(entry.contentId),
          active: true,
        };

        await sbFetch('contents', {
          method: 'POST',
          body: JSON.stringify([newContent]),
        });

        stats.inserted++;
      } catch (error) {
        console.error(`     ❌ Error: ${error.message}`);
        stats.errors++;
      }
    }
    console.log();
  }

  // 5. Actualizar contenidos existentes
  if (toUpdate.length > 0) {
    console.log('🔄 Actualizando contenidos...\n');
    for (const { existing, entry } of toUpdate) {
      try {
        console.log(`   ⟳ ${existing.title} → ${entry.title}`);

        await sbFetch(`contents?id=eq.${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: entry.title }),
        });

        stats.updated++;
      } catch (error) {
        console.error(`     ❌ Error: ${error.message}`);
        stats.errors++;
      }
    }
    console.log();
  }

  // 6. Desactivar contenidos eliminados
  if (toDeactivate.length > 0) {
    console.log('⏸️  Desactivando contenidos eliminados...\n');
    for (const content of toDeactivate) {
      try {
        console.log(`   - ${content.title}`);

        await sbFetch(`contents?id=eq.${content.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active: false }),
        });

        stats.deactivated++;
      } catch (error) {
        console.error(`     ❌ Error: ${error.message}`);
        stats.errors++;
      }
    }
    console.log();
  }

  console.log('✅ Sincronización completada!');
  console.log(`\n📊 Estadísticas finales:`);
  console.log(`   📥 Insertados: ${stats.inserted}`);
  console.log(`   🔄 Actualizados: ${stats.updated}`);
  console.log(`   ⏸️  Desactivados: ${stats.deactivated}`);
  if (stats.errors > 0) {
    console.log(`   ❌ Errores: ${stats.errors}`);
  }
}

main().catch((err) => {
  console.error('\n❌ Error en la sincronización:', err.message);
  process.exit(1);
});
