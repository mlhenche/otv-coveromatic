/**
 * Extract Orange TV catalog from HTML
 * Output: { normalizedTitle -> { title, contentId } }
 *
 * HTML structure: image URL appears BEFORE card__name in the same card block.
 * So we accumulate pending IDs and assign them when we find the next card__name.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'OrangeCatalog.html');
const outputPath = path.join(__dirname, 'otv-catalog.json');

const html = fs.readFileSync(htmlPath, 'utf-8');
const lines = html.split('\n');

function normalizeTitle(title) {
  return title.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function extractContentId(url) {
  if (!url) return null;
  // VOD pattern: /vod/{TYPE}/{contentId}_{SUFFIX}.{ext}
  const vodMatch = url.match(/\/vod\/(?:BACKGROUND|TITLE_TREATMENT|VERTICAL|COVER_ART)\/(.+?)_(?:BACKGROUND|title_treatment|VERTICAL|COVER_ART)\./);
  if (vodMatch) return vodMatch[1];
  return null;
}

const catalog = {};
let pendingId = null; // ID found from image URL, waiting for next card__name

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Extract contentId from VOD image URL
  const bgMatch = line.match(/background-image:\s*url\(&quot;(.+?)&quot;\)/);
  if (bgMatch) {
    const url = bgMatch[1].replace(/&amp;/g, '&');
    if (url.includes('/images/vod/')) {
      const id = extractContentId(url);
      if (id) {
        pendingId = id; // Store, will be assigned to the next card__name
      }
    }
  }

  // Extract title from card__name
  const nameMatch = line.match(/class="card__name[^"]*"[^>]*>\s*(.+?)\s*<\/div>/);
  if (nameMatch && pendingId) {
    const title = nameMatch[1].trim();
    const key = normalizeTitle(title);
    if (!catalog[key]) {
      catalog[key] = { title: title, contentId: pendingId };
    }
    pendingId = null; // Consumed
  }
}

// Output
const result = {
  generatedAt: new Date().toISOString(),
  source: "OrangeCatalog.html",
  totalContents: Object.keys(catalog).length,
  urlPatterns: {
    coverArt: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160",
    vertical: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160",
    background: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160",
    titleTreatment: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720",
  },
  catalog: catalog
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

const entries = Object.values(catalog);
console.log(`=== Catálogo generado ===`);
console.log(`Total contenidos con ID: ${entries.length}`);
console.log(`Archivo: ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
console.log();

// Verify: spot check some known entries
const checks = ['bala perdida', 'ella mccay', 'creed ii la leyenda de rocky', 'zootropolis 2'];
console.log("Verificación:");
checks.forEach(key => {
  const e = catalog[key];
  if (e) console.log(`  OK: "${e.title}" -> ${e.contentId}`);
  else console.log(`  MISSING: ${key}`);
});
