/**
 * catalog-utils.js
 *
 * Utilidades compartidas por los scripts CLI que operan sobre el catálogo
 * local JSON (catalog/otv-catalog.json). Tras el corte de Supabase, el JSON
 * local es la única fuente de verdad del catálogo.
 */

const fs = require('fs');
const path = require('path');

// Carga el .env de la raíz del proyecto (si existe) antes de leer las vars.
// Las variables ya presentes en el entorno tienen prioridad (loadEnvFile no
// sobrescribe las existentes), así que el modo inline `TMDB_API_KEY=… node …`
// sigue funcionando.
const ENV_PATH = path.join(__dirname, '../../.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(ENV_PATH)) {
    process.loadEnvFile(ENV_PATH);
}

const CATALOG_PATH = path.join(__dirname, '../../catalog/otv-catalog.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY;

/** Normaliza un título a la clave usada en catalog.catalog (igual que extract-catalog-v2.js). */
function normalizeTitle(title) {
    return title.toLowerCase().trim()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

/** Extrae el proveedor a partir del prefijo del contentId. */
function extractProvider(contentId) {
    const prefix = contentId.split('_')[0];
    const providerMap = {
        PRIME: 'Prime Video',
        SKYS: 'SkyShowtime',
        DSN: 'Disney+',
        MAX: 'Max',
        RTVE: 'RTVE Play',
        FLMN: 'Filmin',
        APREM: 'A3 Premium',
        MFO: 'Orange TV',
        FLX: 'Orange TV',
    };
    return providerMap[prefix] || null;
}

/** Lee y parsea el catálogo local. */
function readCatalog() {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
}

/** Escribe el catálogo local (con generatedAt actualizado). */
function writeCatalog(catalog) {
    catalog.generatedAt = new Date().toISOString();
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

/** Busca un título en TMDB. Devuelve {tmdbId, tmdbTitle, mediaType, genreIds} o null. */
async function searchTMDB(title, mediaTypeHint = null) {
    if (!TMDB_API_KEY) return null;
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=es-ES`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        if (!searchData.results || searchData.results.length === 0) return null;

        let results = searchData.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
        if (mediaTypeHint) {
            const filtered = results.filter(r => r.media_type === mediaTypeHint);
            if (filtered.length > 0) results = filtered;
        }
        if (results.length === 0) return null;

        const result = results[0];
        return {
            tmdbId: result.id,
            tmdbTitle: result.title || result.name,
            mediaType: result.media_type,
            genreIds: result.genre_ids || [],
        };
    } catch (error) {
        console.warn(`   ⚠️  Error buscando en TMDB: ${error.message}`);
        return null;
    }
}

/** Pausa para respetar el rate limit de TMDB. */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    CATALOG_PATH,
    TMDB_API_KEY,
    normalizeTitle,
    extractProvider,
    readCatalog,
    writeCatalog,
    searchTMDB,
    delay,
};
