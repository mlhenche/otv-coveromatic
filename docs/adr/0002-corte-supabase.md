# ADR-0002 — Corte total de Supabase y modelo de credenciales

- **Estado**: Aceptado
- **Fecha**: 2026-06-07

## Contexto

Tras [ADR-0001](0001-catalogo-github-raw.md), el **plugin** ya no usaba Supabase
(lee el catálogo de GitHub raw). Pero Supabase seguía presente en tres sitios:

1. Los scripts CLI de enriquecimiento (`enrich-catalog.js`, `add-content.js`,
   `manage-content.js`) escribían en las tablas de Supabase.
2. `export-static-catalog.js` leía la tabla `genres` de Supabase para inyectar
   el mapa de géneros en el JSON antes de publicar.
3. Las credenciales (URL, anon key y **service_role key**) estaban hardcodeadas
   en `.claude/CLAUDE.md`, el skill de catálogo y `.env.example` — todo ello en
   un **repositorio público** (`github.com/mlhenche/otv-coveromatic`).

Esto implicaba: (a) mantener un servicio externo vivo solo para los scripts;
(b) gestionar una service_role key de escritura total; y (c) un **incidente de
seguridad**: la service_role key estuvo en la historia pública de git desde el
commit `73b3a1c`, por lo que debe considerarse comprometida.

Observación clave: el mapa de géneros de TMDB es una **lista estable y cerrada**
(27 entradas) que ya estaba embebida en el propio JSON del catálogo. Los scripts
de enriquecimiento usan TMDB como *fuente* de datos; Supabase era solo el
*destino* de escritura, sustituible por el JSON local.

## Decisión

Eliminar Supabase por completo del proyecto:

- Los scripts CLI operan sobre `catalog/otv-catalog.json` (vía
  `scripts/lib/catalog-utils.js`), no sobre Supabase.
- `export-static-catalog.js` usa un mapa de géneros embebido (constante), sin
  consultar ningún servicio.
- `manage-content.js` cambia de "soft delete" (`active:false`) a **eliminar la
  entrada** del JSON — el plugin no filtra por `active`, así que quitar del
  plugin = quitar del JSON.
- Se elimina `sync-to-supabase.js`.
- La única credencial restante es `TMDB_API_KEY`, en `.env` (gitignored), con
  plantilla en `.env.example`.
- El LaunchAgent `com.frogtv.supabase-keepalive` se desactiva (ya no hace falta).

**Seguridad**: rotar/revocar las claves de Supabase y la TMDB key expuestas. La
historia de git aún las contiene; el borrado del archivo NO las protege — la
mitigación real es la rotación. Limpiar la historia (BFG/git-filter-repo) queda
como opción disruptiva y opcional.

## Consecuencias

- **Positivas**:
  - Cero servicios externos: el proyecto es 100% GitHub raw + JSON + TMDB.
  - Una sola credencial (TMDB), fuera del repo.
  - Sin keep-alive ni gestión de service keys.
- **Negativas / coste**:
  - Se pierde el "soft delete" reversible; recuperar un contenido eliminado
    implica volver a añadirlo (`add-content.js`) o regenerarlo desde el HTML.
  - Las claves expuestas requieren acción manual de rotación fuera del repo.
- **Neutras**:
  - El DDL antiguo se conserva en `supabase/schema.sql` solo como referencia
    histórica; no lo usa nada.

## Alternativas consideradas

- **Corte parcial** (mantener Supabase solo para enriquecimiento ocasional) —
  descartado: deja una dependencia y unas credenciales vivas para un beneficio
  marginal frente a operar sobre el JSON local.
- **Mantener Supabase y solo sacar las claves a `.env`** — descartado: no
  elimina el coste operativo ni el keep-alive, y el dato no justifica una DB.
- **Migrar a otra DB gestionada** — descartado por la misma razón que ADR-0001:
  el catálogo es de solo lectura y de baja frecuencia de cambio.
