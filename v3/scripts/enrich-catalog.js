#!/usr/bin/env node
/**
 * enrich-catalog.js
 *
 * Re-enriquece contenidos en Supabase con datos de TMDB
 * (tmdb_id, tmdb_title, genre_ids, media_type).
 *
 * Uso:
 *   node enrich-catalog.js                              # Todo el catálogo
 *   node enrich-catalog.js --only-missing               # Solo sin tmdbId
 *   node enrich-catalog.js --contentId "SKYS_0002700001" # Uno específico
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL        - URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY - Service role key
 *   TMDB_API_KEY        - API key de TMDB
 */

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TMDB_API_KEY) {
  console.error('❌ Faltan variables de entorno:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_KEY');
  console.error('   TMDB_API_KEY');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const onlyMissing = args.includes('--only-missing');
const contentIdIndex = args.indexOf('--contentId');
const contentId = contentIdIndex >= 0 ? args[contentIdIndex + 1] : null;

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

  // For DELETE and PATCH, might return empty
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

// Helper: search TMDB
async function searchTMDB(title, mediaTypeHint = null) {
  try {
    // Try multi search first
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=es-ES`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return null;
    }

    // Filter by media type
    let results = searchData.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    if (mediaTypeHint) {
      const filtered = results.filter(r => r.media_type === mediaTypeHint);
      if (filtered.length > 0) results = filtered;
    }

    if (results.length === 0) {
      return null;
    }

    // Take the first result
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

// Helper: delay to respect TMDB rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichContent(content) {
  console.log(`\n📝 ${content.title}`);
  console.log(`   ContentId: ${content.content_id}`);

  if (content.tmdb_id) {
    console.log(`   ℹ️  Ya tiene TMDB ID: ${content.tmdb_id}`);
  }

  // Buscar en TMDB
  console.log(`   🔍 Buscando en TMDB...`);
  const tmdbData = await searchTMDB(content.title, content.media_type);

  if (!tmdbData) {
    console.log(`   ⚠️  No se encontró en TMDB`);
    return { success: false, reason: 'not_found' };
  }

  console.log(`   ✓ Encontrado: ${tmdbData.tmdb_title} (${tmdbData.media_type})`);
  console.log(`   ✓ TMDB ID: ${tmdbData.tmdb_id}`);
  console.log(`   ✓ Géneros: ${tmdbData.genre_ids.join(', ')}`);

  // Actualizar en Supabase
  await sbFetch(`contents?id=eq.${content.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      tmdb_id: tmdbData.tmdb_id,
      tmdb_title: tmdbData.tmdb_title,
      media_type: tmdbData.media_type,
      genre_ids: tmdbData.genre_ids,
    }),
  });

  console.log(`   ✅ Actualizado correctamente`);
  return { success: true };
}

async function main() {
  console.log('🚀 Enriqueciendo catálogo con datos de TMDB...\n');

  // Obtener contenidos a enriquecer
  let endpoint = 'contents?select=*';
  if (contentId) {
    endpoint = `contents?content_id=eq.${contentId}&select=*`;
  } else if (onlyMissing) {
    endpoint = 'contents?tmdb_id=is.null&select=*';
  }

  console.log('📖 Obteniendo contenidos...');
  const contents = await sbFetch(endpoint);
  console.log(`   ✓ ${contents.length} contenido(s) a enriquecer\n`);

  if (contents.length === 0) {
    console.log('✅ No hay contenidos para enriquecer');
    return;
  }

  let enriched = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    try {
      const result = await enrichContent(content);
      if (result.success) {
        enriched++;
      } else if (result.reason === 'not_found') {
        notFound++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errors++;
    }

    // Rate limiting: wait 250ms between requests (4 req/sec)
    if (i < contents.length - 1) {
      await delay(250);
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Enriquecidos: ${enriched}`);
  if (notFound > 0) {
    console.log(`   ⚠️  No encontrados en TMDB: ${notFound}`);
  }
  if (errors > 0) {
    console.log(`   ❌ Errores: ${errors}`);
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
