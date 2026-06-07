#!/usr/bin/env node
/**
 * export-static-catalog.js
 *
 * Asegura que otv-catalog.json tiene el mapa de géneros y está listo para
 * servir desde GitHub raw. Tras el corte de Supabase, los géneros de TMDB
 * (lista estable y cerrada) viven embebidos aquí — ya no se consultan a
 * ningún servicio externo.
 *
 * Uso:
 *   node export-static-catalog.js
 *
 * Idempotente: si el JSON ya tiene genres, los preserva/actualiza.
 */

const { readCatalog, writeCatalog, CATALOG_PATH } = require('./lib/catalog-utils');
const fs = require('fs');

// Mapa de géneros TMDB (id → nombre). Fuente de verdad tras el corte de
// Supabase. Si TMDB añadiera un género nuevo (muy raro), añadirlo aquí.
const GENRES = {
    12: 'Aventura',
    14: 'Fantasía',
    16: 'Animación',
    18: 'Drama',
    27: 'Terror',
    28: 'Acción',
    35: 'Comedia',
    36: 'Historia',
    37: 'Western',
    53: 'Suspense',
    80: 'Crimen',
    99: 'Documental',
    878: 'Ciencia ficción',
    9648: 'Misterio',
    10402: 'Música',
    10749: 'Romance',
    10751: 'Familia',
    10752: 'Bélica',
    10759: 'Action & Adventure',
    10762: 'Kids',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics',
    10770: 'Película de TV',
};

function main() {
    console.log('Leyendo catálogo local...');
    const catalog = readCatalog();

    // El mapa embebido es la fuente de verdad; preserva cualquier override ya presente.
    catalog.genres = { ...GENRES, ...(catalog.genres || {}) };

    writeCatalog(catalog);

    const count = Object.keys(catalog.genres).length;
    console.log(`✓ otv-catalog.json listo con ${count} géneros (sin Supabase).`);
    console.log(`  Archivo: ${CATALOG_PATH} (${(fs.statSync(CATALOG_PATH).size / 1024).toFixed(1)} KB)`);
    console.log('\nAhora puedes hacer git add + git push y el plugin usará el nuevo JSON.');
}

main();
