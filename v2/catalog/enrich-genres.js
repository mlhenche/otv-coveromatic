/**
 * Enrich OTV catalog with genre IDs from TMDB
 * Adds genreIds array to each entry
 */
const fs = require('fs');
const path = require('path');

const API_KEY = '505c512e8ca4921b7296e4a2ca254fd7';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const catPath = path.join(__dirname, 'otv-catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
const entries = Object.entries(cat.catalog);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let enriched = 0, skipped = 0;
  const allGenreIds = new Set();

  for (let i = 0; i < entries.length; i++) {
    const [key, entry] = entries[i];

    if (!entry.tmdbId || !entry.mediaType) {
      skipped++;
      entry.genreIds = [];
      continue;
    }

    if (entry.genreIds && entry.genreIds.length > 0) {
      enriched++;
      entry.genreIds.forEach(id => allGenreIds.add(id));
      continue;
    }

    const type = entry.mediaType; // "movie" or "tv"
    const url = `${TMDB_BASE}/${type}/${entry.tmdbId}?api_key=${API_KEY}&language=es-ES`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        entry.genreIds = (data.genres || []).map(g => g.id);
        entry.genreIds.forEach(id => allGenreIds.add(id));
        enriched++;
      } else {
        console.log(`  HTTP ${res.status}: "${entry.title}"`);
        entry.genreIds = [];
        skipped++;
      }
    } catch (err) {
      console.log(`  ERR: "${entry.title}" - ${err.message}`);
      entry.genreIds = [];
      skipped++;
    }

    if (i % 10 === 0) process.stdout.write(`  ${i}/${entries.length}...\r`);
    await delay(250);
  }

  // Also fetch genre name maps for reference
  const movieGenres = await fetch(`${TMDB_BASE}/genre/movie/list?api_key=${API_KEY}&language=es-ES`).then(r => r.json());
  const tvGenres = await fetch(`${TMDB_BASE}/genre/tv/list?api_key=${API_KEY}&language=es-ES`).then(r => r.json());

  const genreNames = {};
  [...(movieGenres.genres || []), ...(tvGenres.genres || [])].forEach(g => {
    genreNames[g.id] = g.name;
  });

  cat.genreNames = genreNames;
  cat.genreEnrichedAt = new Date().toISOString();

  fs.writeFileSync(catPath, JSON.stringify(cat, null, 2));

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Enriquecidos: ${enriched}`);
  console.log(`  Saltados: ${skipped}`);
  console.log(`  Géneros únicos: ${allGenreIds.size}`);
  console.log(`  Mapa de géneros guardado (${Object.keys(genreNames).length} nombres)`);
  console.log(`\nCatálogo actualizado en ${catPath}`);
}

main();
