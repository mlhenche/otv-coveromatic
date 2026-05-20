---
name: update-otv-catalog
description: Actualiza el catálogo de contenidos de Orange TV desde el HTML pegado en OrangeCatalog.html. Ejecuta el parser, añade géneros desde Supabase, y publica en GitHub. Usar cuando el usuario pegue un nuevo HTML de orangetv.orange.es o diga "actualizar catálogo", "subir nuevos contenidos" o "sync catálogo OTV".
---

# Actualizar catálogo OTV

## Prerequisito

El usuario debe haber pegado el HTML de `orangetv.orange.es` en:
`v3/catalog/OrangeCatalog.html`

---

## Paso 1 — Extraer y mergear

```bash
cd "v3/catalog"
node extract-catalog-v2.js
```

El script reporta: entradas nuevas, actualizadas y total. Preserva datos TMDB de entradas previas.

## Paso 2 — Revisar slugs sin prefijo de proveedor

Tras el merge, identificar contentIds que no empiecen por `PRIME|SKYS|DSN|MAX|RTVE|FLMN|APREM|MFO|FLX`:

```bash
node -e "
const data = JSON.parse(require('fs').readFileSync('otv-catalog.json','utf8'));
const valid = /^(PRIME|SKYS|DSN|MAX|RTVE|FLMN|APREM|MFO|FLX)/;
Object.entries(data.catalog)
  .filter(([k,v]) => !valid.test(v.contentId))
  .forEach(([k,v]) => console.log(v.title, '|', v.contentId));
"
```

**Importante:** estos slugs (ej. `hoppers`, `scream-7`) suelen ser IDs válidos de OTV — OTV los usa directamente en sus URLs. Verificar con curl antes de descartar:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{slug}_VERTICAL.jpg?width=360&height=480"
```

- **200** → ID válido, mantener en el catálogo
- **404** → contentId corrupto, eliminar o desactivar manualmente en `otv-catalog.json`

## Paso 3 — Añadir géneros y preparar para GitHub

Ejecutar desde la raíz del proyecto:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 \
SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co" \
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU3ODksImV4cCI6MjA4NzEwMTc4OX0.aE19KXi3m0WjmZpxRyLNyETDVI5sAyg0JfLNOe_c4Aw" \
node "v3/scripts/export-static-catalog.js"
```

## Paso 4 — Commit y push

```bash
git add v3/catalog/otv-catalog.json
git commit -m "chore(catalog): actualizar catálogo OTV — X nuevos, Y actualizados (Z total)"
git push
```

El plugin cargará el nuevo JSON en la próxima apertura (caché de 4h).
