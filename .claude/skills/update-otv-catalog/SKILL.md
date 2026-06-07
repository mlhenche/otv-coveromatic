---
name: update-otv-catalog
description: Actualiza el catálogo de contenidos de Orange TV desde el HTML pegado en OrangeCatalog.html. Ejecuta el parser, añade géneros y publica en GitHub. Usar cuando el usuario pegue un nuevo HTML de orangetv.orange.es o diga "actualizar catálogo", "subir nuevos contenidos" o "sync catálogo OTV".
---

# Actualizar catálogo OTV

> El catálogo es un JSON estático servido desde GitHub raw. No hay Supabase.
> La única credencial es `TMDB_API_KEY` (opcional, solo para enriquecer entradas nuevas).

## Prerequisito

El usuario debe haber pegado el HTML de `orangetv.orange.es` en:
`catalog/OrangeCatalog.html`

---

## Paso 1 — Extraer y mergear

```bash
cd catalog
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
- **404** → contentId corrupto, eliminar con `node ../scripts/manage-content.js --remove --contentId "el-id-malo"`

## Paso 3 — Enriquecer con TMDB (opcional, para entradas nuevas)

Desde la raíz del proyecto, con la API key de TMDB en el entorno (ver `.env.example`):

```bash
TMDB_API_KEY="<tu-tmdb-key>" node scripts/enrich-catalog.js --only-missing
```

## Paso 4 — Añadir géneros y preparar para GitHub

Desde la raíz del proyecto (sin credenciales: los géneros van embebidos en el script):

```bash
node scripts/export-static-catalog.js
```

## Paso 5 — Commit y push

```bash
git add catalog/otv-catalog.json
git commit -m "chore(catalog): actualizar catálogo OTV — X nuevos, Y actualizados (Z total)"
git push
```

El plugin cargará el nuevo JSON en la próxima apertura (caché de 4h).
