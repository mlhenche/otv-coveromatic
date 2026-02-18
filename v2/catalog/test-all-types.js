/**
 * Test all 4 image types for every catalog entry.
 * Reports entries with any broken image type.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';
const CONCURRENCY = 10;
const catPath = path.join(__dirname, 'otv-catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
const entries = Object.entries(cat.catalog);

async function testAll(contentId) {
  const types = {
    CA: `${BASE}/COVER_ART/${contentId}_COVER_ART.jpg?width=3840&height=2160`,
    VT: `${BASE}/VERTICAL/${contentId}_VERTICAL.jpg?width=3840&height=2160`,
    BG: `${BASE}/BACKGROUND/${contentId}_BACKGROUND.jpg?width=3840&height=2160`,
    TT: `${BASE}/TITLE_TREATMENT/${contentId}_title_treatment.png?width=1280&height=720`,
  };
  const results = {};
  await Promise.all(Object.entries(types).map(async ([k, url]) => {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      results[k] = r.ok ? 'OK' : r.status;
    } catch {
      results[k] = 'ERR';
    }
  }));
  return results;
}

async function main() {
  console.log(`Testeando ${entries.length} entradas (${CONCURRENCY} en paralelo)...\n`);
  const broken = [];

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async ([key, entry]) => {
      const r = await testAll(entry.contentId);
      return { key, title: entry.title, contentId: entry.contentId, r };
    }));
    for (const item of results) {
      const anyBroken = Object.values(item.r).some(v => v !== 'OK');
      if (anyBroken) broken.push(item);
    }
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, entries.length)}/${entries.length}...\r`);
  }

  console.log(`\n\nEntradas con algún tipo roto: ${broken.length}\n`);
  for (const { title, contentId, r } of broken) {
    const rStr = Object.entries(r).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`  "${title.substring(0, 45)}" (${contentId.substring(0, 25)}) — ${rStr}`);
  }
}

main();
