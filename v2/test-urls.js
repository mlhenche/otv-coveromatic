const BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';

async function test(title, id) {
  const urls = {
    COVER_ART:       `${BASE}/COVER_ART/${id}_COVER_ART.jpg?width=3840&height=2160`,
    VERTICAL:        `${BASE}/VERTICAL/${id}_VERTICAL.jpg?width=3840&height=2160`,
    BACKGROUND:      `${BASE}/BACKGROUND/${id}_BACKGROUND.jpg?width=3840&height=2160`,
    TITLE_TREATMENT: `${BASE}/TITLE_TREATMENT/${id}_title_treatment.png?width=1280&height=720`,
  };
  const results = {};
  for (const [type, url] of Object.entries(urls)) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      results[type] = r.ok ? 'OK' : r.status;
    } catch { results[type] = 'ERR'; }
  }
  console.log(`"${title}" (${id})`);
  console.log(`  CA:${results.COVER_ART} VT:${results.VERTICAL} BG:${results.BACKGROUND} TT:${results.TITLE_TREATMENT}`);
}

async function main() {
  // Test the slug-based entries specifically
  await test('Bala Perdida', 'bala-perdida');
  await test('Los juegos del hambre: Sinsajo', 'los-juegos-del-hambre-sinsajo-parte-i');
  await test('Zootrópolis 2', 'zootropolis-2');
  await test('Super Mario Bros', 'super-mario-bros-la-pelicula');
  await test('La resistencia invisible', 'la-resistencia-invisible');
  await test('Maspalomas', 'maspalomas');
}
main();
