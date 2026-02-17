/**
 * Enrich OTV catalog with TMDB data (media_type, tmdb_id)
 */
const fs = require('fs');
const path = require('path');

const API_KEY = '505c512e8ca4921b7296e4a2ca254fd7';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const catPath = path.join(__dirname, 'otv-catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
const entries = Object.entries(cat.catalog);

async function searchTMDB(title) {
  const url = `${TMDB_BASE}/search/multi?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(title)}&page=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;

  // Find best match: prefer exact-ish title match
  const normalTitle = title.toLowerCase().trim();
  for (const r of data.results) {
    if (r.media_type === 'person') continue;
    const rTitle = (r.title || r.name || '').toLowerCase().trim();
    if (rTitle === normalTitle) return r;
  }
  // Fallback: first non-person result
  return data.results.find(r => r.media_type !== 'person') || null;
}

// Rate limit: 40 req/s max for TMDB, we'll do 4/s to be safe
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let movies = 0, tv = 0, notFound = 0;

  for (let i = 0; i < entries.length; i++) {
    const [key, entry] = entries[i];
    const result = await searchTMDB(entry.title);

    if (result) {
      entry.mediaType = result.media_type; // "movie" or "tv"
      entry.tmdbId = result.id;
      entry.tmdbTitle = result.title || result.name;
      if (result.media_type === 'movie') movies++;
      else if (result.media_type === 'tv') tv++;
    } else {
      entry.mediaType = null;
      entry.tmdbId = null;
      entry.tmdbTitle = null;
      notFound++;
      console.log(`  NOT FOUND: "${entry.title}"`);
    }

    if (i % 10 === 0) process.stdout.write(`  ${i}/${entries.length}...\r`);
    await delay(250);
  }

  // Save enriched catalog
  cat.enrichedAt = new Date().toISOString();
  fs.writeFileSync(catPath, JSON.stringify(cat, null, 2));

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Películas: ${movies}`);
  console.log(`  Series:    ${tv}`);
  console.log(`  No encontrado: ${notFound}`);
  console.log(`  Total: ${entries.length}`);
  console.log(`\nCatálogo actualizado en ${catPath}`);
}

main();
