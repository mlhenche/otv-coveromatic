const cat = require("./otv-catalog.json");
const entries = Object.entries(cat.catalog);

// Show entries with null contentId and their coverArtUrl to see what pattern they use
console.log("=== Entries SIN contentId pero CON coverArtUrl ===");
const nullId = entries.filter(([k, e]) => !e.contentId && e.coverArtUrl);
nullId.slice(0, 15).forEach(([key, e]) => {
  console.log(`  "${e.title}"`);
  console.log(`    URL: ${e.coverArtUrl}`);
  console.log();
});

console.log("Total sin contentId:", nullId.length);
console.log();

// Extract ALL unique URL patterns
console.log("=== Todos los patrones de URL de imagen ===");
const patterns = {};
entries.forEach(([k, e]) => {
  const urls = [e.backgroundUrl, e.titleTreatmentUrl, e.coverArtUrl].filter(Boolean);
  urls.forEach(url => {
    // Extract pattern: /images/{type}/{pattern}
    const match = url.match(/\/images\/(.+?)(?:\?|$)/);
    if (match) {
      const path = match[1];
      // Generalize the path
      const generalized = path
        .replace(/[A-Z]{2,}_[0-9a-f-]+/g, '{ID}')
        .replace(/[a-z]+-[a-z]+-[a-z]+/g, '{SLUG}')
        .replace(/\d{5,}/g, '{NUM}');
      patterns[generalized] = (patterns[generalized] || 0) + 1;
    }
  });
});
Object.entries(patterns).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
  console.log(`  [${c}x] ${p}`);
});
