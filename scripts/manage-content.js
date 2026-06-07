#!/usr/bin/env node
/**
 * manage-content.js
 *
 * Elimina contenidos del catálogo local (catalog/otv-catalog.json).
 *
 * NOTA — cambio de modelo tras el corte de Supabase:
 *   El catálogo local es un JSON plano sin campo `active`, y el plugin muestra
 *   TODAS las entradas presentes. No existe el "soft delete" (active:false) que
 *   tenía Supabase, porque el plugin no filtra por ese campo. Por tanto, quitar
 *   un contenido del plugin = eliminar su entrada del JSON.
 *
 * Uso:
 *   node manage-content.js --remove --contentId "SKYS_0002700001"
 *   node manage-content.js --disable --contentId "SKYS_0002700001"   (alias de --remove)
 *
 * Si quieres recuperar un contenido eliminado, vuelve a añadirlo con add-content.js
 * o regenéralo desde el HTML con extract-catalog-v2.js.
 *
 * Requiere: (ninguna variable de entorno)
 */

const { readCatalog, writeCatalog } = require('./lib/catalog-utils');

const args = process.argv.slice(2);
const remove = args.includes('--remove') || args.includes('--disable');
const enable = args.includes('--enable');
const contentIdIndex = args.indexOf('--contentId');
const contentId = contentIdIndex >= 0 ? args[contentIdIndex + 1] : null;

if (enable) {
    console.error('❌ --enable ya no aplica: el catálogo local no tiene soft delete.');
    console.error('   Para recuperar un contenido, añádelo con add-content.js o regenéralo desde el HTML.');
    process.exit(1);
}

if (!remove) {
    console.error('❌ Debe especificar --remove (o el alias --disable)');
    process.exit(1);
}

if (!contentId) {
    console.error('❌ Debe especificar --contentId <id>');
    process.exit(1);
}

function main() {
    const catalog = readCatalog();

    const matches = Object.entries(catalog.catalog).filter(([, e]) => e.contentId === contentId);
    if (matches.length === 0) {
        console.log(`⚠️  No se encontró ninguna entrada con contentId "${contentId}"`);
        return;
    }

    matches.forEach(([key, e]) => {
        delete catalog.catalog[key];
        console.log(`🗑️  Eliminada: ${e.title} (${e.contentId})`);
    });

    catalog.totalContents = Object.keys(catalog.catalog).length;
    writeCatalog(catalog);
    console.log(`\n✓ ${matches.length} entrada(s) eliminada(s). catalog/otv-catalog.json actualizado.`);
}

main();
