#!/usr/bin/env node
/**
 * migrate-to-supabase.js
 *
 * Migración inicial: lee el catálogo JSON actual (otv-catalog.json)
 * y lo inserta en las tablas de Supabase (contents, genres).
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node migrate-to-supabase.js
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL       - URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY - Service role key (con permisos de escritura)
 */

const fs = require('fs');
const path = require('path');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CATALOG_PATH = path.join(__dirname, '../catalog/otv-catalog.json');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Helper: fetch a Supabase REST API
async function sbFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;

  console.log(`   → Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal', // No devolver datos en respuesta (más rápido)
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }

    return response;
  } catch (error) {
    console.error(`   ✗ Fetch error: ${error.message}`);
    console.error(`   ✗ URL: ${url}`);
    throw error;
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

async function main() {
  console.log('🚀 Iniciando migración a Supabase...\n');

  // 1. Limpiar tablas existentes
  console.log('🧹 Limpiando tablas existentes...');
  try {
    await sbFetch('contents?id=not.is.null', { method: 'DELETE' });
    await sbFetch('genres?id=not.is.null', { method: 'DELETE' });
    console.log('   ✓ Tablas limpiadas\n');
  } catch (err) {
    console.log('   ⚠️  Error limpiando (puede ser que estén vacías):', err.message, '\n');
  }

  // 2. Leer JSON local
  console.log(`📖 Leyendo ${CATALOG_PATH}...`);
  const catalogData = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  const { catalog, genreNames } = catalogData;
  let entries = Object.values(catalog);

  // Deduplicar por contentId (quedarnos con el último)
  const uniqueMap = new Map();
  entries.forEach(entry => {
    uniqueMap.set(entry.contentId, entry);
  });
  entries = Array.from(uniqueMap.values());

  console.log(`   ✓ ${entries.length} contenidos únicos\n`);

  // 3. Insertar genres
  console.log('📝 Insertando géneros...');
  const genresArray = Object.entries(genreNames).map(([id, name]) => ({
    id: parseInt(id),
    name,
  }));

  await sbFetch('genres', {
    method: 'POST',
    body: JSON.stringify(genresArray),
  });
  console.log(`   ✓ ${genresArray.length} géneros insertados\n`);

  // 4. Insertar contents (en lotes de 500)
  console.log('📝 Insertando contenidos...');
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const contentsArray = batch.map((entry) => ({
      title: entry.title,
      content_id: entry.contentId,
      media_type: entry.mediaType || null,
      tmdb_id: entry.tmdbId || null,
      tmdb_title: entry.tmdbTitle || null,
      genre_ids: entry.genreIds || [],
      provider: extractProvider(entry.contentId),
      active: true,
    }));

    await sbFetch('contents', {
      method: 'POST',
      body: JSON.stringify(contentsArray),
    });

    inserted += contentsArray.length;
    console.log(`   ✓ ${inserted}/${entries.length} contenidos insertados`);
  }

  console.log('\n✅ Migración completada!');
  console.log(`\n📊 Resumen:`);
  console.log(`   - Géneros: ${genresArray.length}`);
  console.log(`   - Contenidos: ${inserted}`);
  console.log(`   - Config: ya creado en schema.sql`);
}

main().catch((err) => {
  console.error('\n❌ Error en la migración:', err.message);
  process.exit(1);
});
