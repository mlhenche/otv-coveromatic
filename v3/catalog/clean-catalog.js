/**
 * Test all catalog entries and remove those with broken images.
 * Tests COVER_ART URL with HEAD request. Removes entry if image fails.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';
const CONCURRENCY = 10;
const catPath = path.join(__dirname, 'otv-catalog.json');

const cat = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
const entries = Object.entries(cat.catalog);

async function testEntry(contentId) {
  const url = `${BASE}/COVER_ART/${contentId}_COVER_ART.jpg?width=3840&height=2160`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

async function runBatch(batch) {
  return Promise.all(batch.map(async ([key, entry]) => {
    const ok = await testEntry(entry.contentId);
    return { key, entry, ok };
  }));
}

async function main() {
  console.log(`Testeando ${entries.length} entradas (${CONCURRENCY} en paralelo)...\n`);

  const broken = [];
  const working = [];

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await runBatch(batch);
    for (const { key, entry, ok } of results) {
      if (ok) {
        working.push(key);
      } else {
        broken.push({ key, title: entry.title, contentId: entry.contentId });
        console.log(`  ✗ "${entry.title}" (${entry.contentId})`);
      }
    }
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, entries.length)}/${entries.length}...\r`);
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Funcionan: ${working.length}`);
  console.log(`  Rotos:     ${broken.length}`);

  if (broken.length === 0) {
    console.log('\nTodo el catálogo funciona correctamente.');
    return;
  }

  // Remove broken entries
  for (const { key } of broken) {
    delete cat.catalog[key];
  }
  cat.totalContents = Object.keys(cat.catalog).length;
  cat.cleanedAt = new Date().toISOString();

  fs.writeFileSync(catPath, JSON.stringify(cat, null, 2));
  console.log(`\nCatálogo limpio guardado: ${cat.totalContents} entradas`);
  console.log(`Archivo: ${catPath}`);
}

main();
