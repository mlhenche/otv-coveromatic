/**
 * export-static-catalog.js
 *
 * Enriquece otv-catalog.json con el mapa de géneros de Supabase
 * y lo deja listo para servir desde GitHub raw.
 *
 * Uso:
 *   SUPABASE_URL="..." SUPABASE_SERVICE_KEY="..." node v3/scripts/export-static-catalog.js
 *
 * El script es idempotente: si genres ya están en el JSON, los actualiza.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno: SUPABASE_URL y SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY)');
  process.exit(1);
}

const catalogPath = path.join(__dirname, '../catalog/otv-catalog.json');

async function fetchGenres() {
  const url = `${SUPABASE_URL}/rest/v1/genres?select=id,name`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Leyendo catálogo local...');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

  console.log('Obteniendo géneros de Supabase...');
  const genres = await fetchGenres();

  const genreMap = {};
  genres.forEach(g => { genreMap[g.id] = g.name; });
  console.log(`${genres.length} géneros obtenidos.`);

  catalog.genres = genreMap;
  catalog.generatedAt = new Date().toISOString();

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`\n✓ otv-catalog.json actualizado con géneros (${genres.length}).`);
  console.log(`  Archivo: ${catalogPath} (${(fs.statSync(catalogPath).size / 1024).toFixed(1)} KB)`);
  console.log('\nAhora puedes hacer git add + git push y el plugin usará el nuevo JSON.');
}

main().catch(err => { console.error(err); process.exit(1); });
