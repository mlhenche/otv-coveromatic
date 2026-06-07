#!/usr/bin/env node
/**
 * enrich-catalog.js
 *
 * Enriquece las entradas del catálogo local (catalog/otv-catalog.json) con
 * datos de TMDB (tmdbId, tmdbTitle, genreIds, mediaType).
 *
 * Uso:
 *   node enrich-catalog.js                               # Todo el catálogo
 *   node enrich-catalog.js --only-missing                # Solo sin tmdbId
 *   node enrich-catalog.js --contentId "SKYS_0002700001" # Uno específico
 *
 * Requiere:
 *   TMDB_API_KEY - API key de TMDB
 */

const { readCatalog, writeCatalog, searchTMDB, delay, TMDB_API_KEY } = require('./lib/catalog-utils');

if (!TMDB_API_KEY) {
    console.error('❌ Falta la variable de entorno TMDB_API_KEY');
    process.exit(1);
}

const args = process.argv.slice(2);
const onlyMissing = args.includes('--only-missing');
const contentIdIndex = args.indexOf('--contentId');
const contentId = contentIdIndex >= 0 ? args[contentIdIndex + 1] : null;

async function main() {
    console.log('🚀 Enriqueciendo catálogo local con datos de TMDB...\n');

    const catalog = readCatalog();
    const keys = Object.keys(catalog.catalog);

    // Seleccionar entradas a enriquecer
    let targets = keys.map(key => ({ key, entry: catalog.catalog[key] }));
    if (contentId) {
        targets = targets.filter(t => t.entry.contentId === contentId);
    } else if (onlyMissing) {
        targets = targets.filter(t => !t.entry.tmdbId);
    }

    console.log(`📖 ${targets.length} entrada(s) a enriquecer\n`);
    if (targets.length === 0) {
        console.log('✅ No hay entradas para enriquecer');
        return;
    }

    let enriched = 0, notFound = 0, errors = 0;

    for (let i = 0; i < targets.length; i++) {
        const { entry } = targets[i];
        console.log(`\n📝 ${entry.title} (${entry.contentId})`);
        try {
            const tmdb = await searchTMDB(entry.title, entry.mediaType);
            if (!tmdb) {
                console.log('   ⚠️  No se encontró en TMDB');
                notFound++;
            } else {
                entry.tmdbId = tmdb.tmdbId;
                entry.tmdbTitle = tmdb.tmdbTitle;
                entry.mediaType = tmdb.mediaType;
                entry.genreIds = tmdb.genreIds;
                console.log(`   ✓ ${tmdb.tmdbTitle} (${tmdb.mediaType}) · TMDB ${tmdb.tmdbId} · géneros [${tmdb.genreIds.join(', ')}]`);
                enriched++;
            }
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            errors++;
        }
        if (i < targets.length - 1) await delay(250); // rate limit ~4 req/s
    }

    writeCatalog(catalog);

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Enriquecidos: ${enriched}`);
    if (notFound > 0) console.log(`   ⚠️  No encontrados en TMDB: ${notFound}`);
    if (errors > 0) console.log(`   ❌ Errores: ${errors}`);
    console.log(`\n✓ catalog/otv-catalog.json actualizado.`);
}

main().catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
