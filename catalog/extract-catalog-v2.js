/**
 * Extract Orange TV catalog from HTML - V2
 * Simplified approach: find all card__name divs with their titles
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'OrangeCatalog.html');
const outputPath = path.join(__dirname, 'otv-catalog.json');

const html = fs.readFileSync(htmlPath, 'utf-8');

function normalizeTitle(title) {
  return title.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function extractContentId(url) {
  if (!url) return null;
  const vodMatch = url.match(/\/vod\/(BACKGROUND|TITLE_TREATMENT|VERTICAL|COVER_ART)\/(.+?)_(BACKGROUND|title_treatment|VERTICAL|COVER_ART)\./);
  if (vodMatch) return vodMatch[2];
  return null;
}

// Split by card__name to get blocks
const cardNamePattern = /class=(?:&quot;|")card__name[^>]*>\s*([^<]+)/g;
const backgroundPattern = /background-image:\s*url\((?:&quot;|")(.+?)(?:&quot;|")\)/g;

const catalog = {};
let match;

// Find all card__name entries with their titles
const titles = [];
while ((match = cardNamePattern.exec(html)) !== null) {
  const title = match[1].trim();
  if (title && title.length > 0) {
    titles.push({ title: title.replace(/\s+/g, ' '), index: match.index });
  }
}

console.log(`Found ${titles.length} card__name entries`);

// For each title, look backwards to find the nearest BACKGROUND/VERTICAL/COVER_ART image
for (const entry of titles) {
  const beforeText = html.substring(Math.max(0, entry.index - 5000), entry.index);

  // Find all background-image URLs in this section
  const urls = [];
  let urlMatch;
  const urlRegex = /background-image:\s*url\((?:&quot;|")(.+?)(?:&quot;|")\)/g;
  while ((urlMatch = urlRegex.exec(beforeText)) !== null) {
    urls.push(urlMatch[1].replace(/&amp;/g, '&'));
  }

  // Find the last (closest) VOD image URL
  for (let i = urls.length - 1; i >= 0; i--) {
    const url = urls[i];
    if (url.includes('/vod/')) {
      const contentId = extractContentId(url);
      if (contentId) {
        const key = normalizeTitle(entry.title);
        if (!catalog[key]) {
          catalog[key] = { title: entry.title, contentId };
        }
        break;
      }
    }
  }
}

// Merge: preserve existing catalog and add new entries on top
const existingPath = path.join(__dirname, 'otv-catalog.json');
let mergedCatalog = {};
if (fs.existsSync(existingPath)) {
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
  // Start with existing catalog as base (preserves all TMDB data)
  mergedCatalog = { ...existing.catalog };
  let newEntries = 0, updatedEntries = 0;
  for (const [key, entry] of Object.entries(catalog)) {
    if (mergedCatalog[key]) {
      // Update contentId if it changed, keep TMDB data
      mergedCatalog[key].contentId = entry.contentId;
      mergedCatalog[key].title = entry.title;
      updatedEntries++;
    } else {
      // Genuinely new entry
      mergedCatalog[key] = entry;
      newEntries++;
    }
  }
  console.log(`Entradas existentes preservadas: ${Object.keys(existing.catalog).length}`);
  console.log(`Entradas nuevas añadidas: ${newEntries}`);
  console.log(`Entradas actualizadas: ${updatedEntries}`);
} else {
  mergedCatalog = catalog;
}

const result = {
  generatedAt: new Date().toISOString(),
  source: "OrangeCatalog.html (merged with previous)",
  totalContents: Object.keys(mergedCatalog).length,
  urlPatterns: {
    coverArt: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160",
    vertical: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160",
    background: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160",
    titleTreatment: "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720",
  },
  catalog: mergedCatalog
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log(`\n=== Catálogo generado ===`);
console.log(`Total contenidos: ${Object.keys(mergedCatalog).length}`);
console.log(`Archivo: ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
