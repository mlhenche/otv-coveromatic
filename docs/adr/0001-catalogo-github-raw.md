# ADR-0001 — Catálogo servido como JSON estático desde GitHub raw

- **Estado**: Aceptado
- **Fecha**: 2026-05-20 (documentado retrospectivamente el 2026-06-07)

## Contexto

El catálogo de contenidos de Orange TV (título → contentId + metadatos TMDB)
debe estar disponible para el plugin de Figma en tiempo de ejecución. Histórico:

1. **v1/v2**: el catálogo era un JSON hardcodeado en el bundle del plugin. Cada
   actualización requería recompilar y redistribuir el plugin.
2. **v3 inicial**: se migró a Supabase (PostgreSQL) para poder actualizar el
   catálogo sin tocar el plugin. El plugin leía vía REST con la anon key.

Supabase resolvía la actualización dinámica, pero añadía coste operativo: un
servicio externo que mantener vivo (el plan gratuito pausa proyectos inactivos,
lo que obligó a un LaunchAgent de keep-alive), credenciales que gestionar, y
una dependencia de red con su propia disponibilidad.

El catálogo, sin embargo, es **de solo lectura para el plugin** y cambia con
poca frecuencia (cuando el equipo añade contenidos). No necesita una base de
datos relacional ni queries dinámicas.

## Decisión

Servir el catálogo como un único archivo JSON estático (`catalog/otv-catalog.json`)
desde **GitHub raw**:
`https://raw.githubusercontent.com/mlhenche/otv-coveromatic/main/catalog/otv-catalog.json`.

El plugin lo carga con `fetch` y lo cachea 4h con React Query
(`src/ui/hooks/useCatalog.ts`). La actualización del catálogo es un commit + push.

## Consecuencias

- **Positivas**:
  - Cero infraestructura que mantener: GitHub raw es gratis y siempre disponible.
  - El historial del catálogo queda versionado en git.
  - El flujo de actualización es el mismo `git push` que el resto del proyecto.
  - Se elimina la dependencia de red de Supabase y su keep-alive.
- **Negativas / coste**:
  - El catálogo nuevo no está disponible hasta que el push llega a `main`
    (más la caché de 4h del plugin). No hay actualización "instantánea".
  - GitHub raw cachea agresivamente; cambios pueden tardar minutos en propagarse.
  - No hay queries del lado servidor: el plugin descarga el JSON completo (~136 KB).
- **Neutras**:
  - La URL incluye la ruta del repo, así que mover el archivo (p. ej. aplanar
    `v3/` a la raíz) obliga a actualizar la URL en `useCatalog.ts`.

## Alternativas consideradas

- **Mantener Supabase** — descartado por el coste operativo (keep-alive,
  credenciales, servicio externo) frente a un dato que es de solo lectura y
  cambia poco. Ver [ADR-0002](0002-corte-supabase.md).
- **GitHub Pages / CDN dedicado** — innecesario: GitHub raw ya sirve el archivo
  con disponibilidad suficiente para un plugin interno.
- **Re-empaquetar el JSON en el plugin (como v1/v2)** — descartado: obliga a
  recompilar y redistribuir el plugin en cada actualización del catálogo.
