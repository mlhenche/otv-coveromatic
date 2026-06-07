#!/usr/bin/env node
/**
 * add-content.js
 *
 * Añade contenidos nuevos al catálogo local (catalog/otv-catalog.json).
 * Busca automáticamente en TMDB para enriquecer los datos (si hay TMDB_API_KEY).
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
 * Requiere (opcional pero recomendado):
 *   TMDB_API_KEY - API key de TMDB para enriquecimiento
 */

const fs = require('fs');
const { readCatalog, writeCatalog, searchTMDB, normalizeTitle, TMDB_API_KEY } = require('./lib/catalog-utils');

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

async function addOne(catalog, title, contentId, mediaTypeHint = null) {
    console.log(`\n📝 ${title} (${contentId})`);
    const key = normalizeTitle(title);

    const entry = { title, contentId };
    if (mediaTypeHint) entry.mediaType = mediaTypeHint;

    if (TMDB_API_KEY) {
        console.log('   🔍 Buscando en TMDB...');
        const tmdb = await searchTMDB(title, mediaTypeHint);
        if (tmdb) {
            entry.mediaType = tmdb.mediaType;
            entry.tmdbId = tmdb.tmdbId;
            entry.tmdbTitle = tmdb.tmdbTitle;
            entry.genreIds = tmdb.genreIds;
            console.log(`   ✓ ${tmdb.tmdbTitle} (${tmdb.mediaType}) · TMDB ${tmdb.tmdbId}`);
        } else {
            console.log('   ⚠️  No se encontró en TMDB');
        }
    }

    const existed = !!catalog.catalog[key];
    catalog.catalog[key] = { ...catalog.catalog[key], ...entry };
    console.log(existed ? '   ↻ Actualizada (clave ya existía)' : '   ✅ Añadida');
    return existed ? 'updated' : 'added';
}

async function main() {
    console.log('🚀 Añadiendo contenido(s) al catálogo local...');
    const catalog = readCatalog();

    let contents;
    if (file) {
        console.log(`\n📖 Leyendo ${file}...`);
        const fileData = JSON.parse(fs.readFileSync(file, 'utf-8'));
        contents = Array.isArray(fileData) ? fileData : [fileData];
        console.log(`   ✓ ${contents.length} contenido(s) a añadir`);
    } else {
        contents = [{ title, contentId, mediaType }];
    }

    let added = 0, updated = 0, failed = 0;
    for (const c of contents) {
        try {
            const r = await addOne(catalog, c.title, c.contentId, c.mediaType);
            if (r === 'added') added++; else updated++;
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            failed++;
        }
    }

    catalog.totalContents = Object.keys(catalog.catalog).length;
    writeCatalog(catalog);

    console.log(`\n📊 Resumen:  ✅ Añadidos: ${added}  ↻ Actualizados: ${updated}${failed ? `  ❌ Fallidos: ${failed}` : ''}`);
    console.log('✓ catalog/otv-catalog.json actualizado.');
}

main().catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
