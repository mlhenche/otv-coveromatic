#!/usr/bin/env node
/**
 * add-content.js
 *
 * Añade contenidos nuevos al catálogo en Supabase.
 * Busca automáticamente en TMDB para enriquecer los datos.
 *
 * Uso:
 *   node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001"
 *   node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001" --mediaType movie
 *   node add-content.js --file nuevos-contenidos.json
 *
 * Formato del archivo JSON:
 *   [
 *     { "title": "Gladiator II", "contentId": "SKYS_0002700001" },
 *     { "title": "Wicked 2", "contentId": "SKYS_0002700002", "mediaType": "movie" }
 *   ]
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL        - URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY - Service role key
 *   TMDB_API_KEY        - API key de TMDB
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
  if (!TMDB_API_KEY) {
    console.error('   TMDB_API_KEY (opcional, pero recomendado para enriquecimiento)');
  }
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const titleIndex = args.indexOf('--title');
const contentIdIndex = args.indexOf('--contentId');
const mediaTypeIndex = args.indexOf('--mediaType');
const fileIndex = args.indexOf('--file');

const title = titleIndex >= 0 ? args[titleIndex + 1] : null;
const contentId = contentIdIndex >= 0 ? args[contentIdIndex + 1] : null;
const mediaType = mediaTypeIndex >= 0 ? args[mediaTypeIndex + 1] : null;
const file = fileIndex >= 0 ? args[fileIndex + 1] : null;

if (!file && (!title || !contentId)) {
  console.error('❌ Debe especificar --title y --contentId, o --file');
  console.error('\nEjemplos:');
  console.error('  node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001"');
  console.error('  node add-content.js --file nuevos-contenidos.json');
  process.exit(1);
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

  return response.json();
}

// Helper: search TMDB
async function searchTMDB(title, mediaTypeHint = null) {
  if (!TMDB_API_KEY) {
    return null;
  }

  try {
    // Try multi search first
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=es-ES`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return null;
    }

    // Filter by media type if hint provided
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

async function addContent(title, contentId, mediaTypeHint = null) {
  console.log(`\n📝 Añadiendo: ${title}`);
  console.log(`   ContentId: ${contentId}`);

  // Buscar en TMDB
  let tmdbData = null;
  if (TMDB_API_KEY) {
    console.log(`   🔍 Buscando en TMDB...`);
    tmdbData = await searchTMDB(title, mediaTypeHint);
    if (tmdbData) {
      console.log(`   ✓ Encontrado: ${tmdbData.tmdb_title} (${tmdbData.media_type})`);
      console.log(`   ✓ TMDB ID: ${tmdbData.tmdb_id}`);
      console.log(`   ✓ Géneros: ${tmdbData.genre_ids.join(', ')}`);
    } else {
      console.log(`   ⚠️  No se encontró en TMDB`);
    }
  }

  // Preparar datos para insertar
  const provider = extractProvider(contentId);
  const newContent = {
    title,
    content_id: contentId,
    media_type: tmdbData?.media_type || mediaTypeHint || null,
    tmdb_id: tmdbData?.tmdb_id || null,
    tmdb_title: tmdbData?.tmdb_title || null,
    genre_ids: tmdbData?.genre_ids || [],
    provider,
    active: true,
  };

  // Insertar en Supabase
  const result = await sbFetch('contents', {
    method: 'POST',
    body: JSON.stringify([newContent]),
  });

  console.log(`   ✅ Insertado correctamente`);
  return result[0];
}

async function main() {
  console.log('🚀 Añadiendo contenido(s) a Supabase...');

  let contents = [];
  if (file) {
    // Leer archivo JSON
    console.log(`\n📖 Leyendo ${file}...`);
    const fileData = JSON.parse(fs.readFileSync(file, 'utf-8'));
    contents = Array.isArray(fileData) ? fileData : [fileData];
    console.log(`   ✓ ${contents.length} contenido(s) a añadir`);
  } else {
    // Single content from args
    contents = [{ title, contentId, mediaType }];
  }

  let added = 0;
  let failed = 0;

  for (const content of contents) {
    try {
      await addContent(content.title, content.contentId, content.mediaType);
      added++;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Añadidos: ${added}`);
  if (failed > 0) {
    console.log(`   ❌ Fallidos: ${failed}`);
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
