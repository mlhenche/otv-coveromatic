# Onboarding — CoverOmatic

Punto de entrada único para empezar a trabajar en el plugin. Si solo lees un
documento, que sea este.

## Qué es

Plugin de Figma para el equipo de diseño de Orange TV. Aplica carátulas,
metadatos y personas (desde TMDB y el catálogo de OTV) a los componentes del
Design System en Figma.

## Arquitectura en 30 segundos

- **Dos capas**: el *backend* (`src/code.ts`) corre en el sandbox de Figma (sin
  DOM, sin red); el *frontend* (`src/ui/`, React) corre en un iframe y sí tiene
  red. Se comunican por `postMessage`.
- **Catálogo**: JSON estático servido desde GitHub raw (sin backend propio, sin
  base de datos). Lo carga `src/ui/hooks/useCatalog.ts`.
- **Metadatos**: TMDB API (`src/ui/hooks/useTMDB.ts`).
- **Imágenes**: CDN público de OTV.

Más detalle en `docs/codebase/ARCHITECTURE.md`.

## Setup

```bash
npm install
cp .env.example .env   # rellena TMDB_API_KEY (solo para scripts CLI)
npm run build          # genera plugin/code.js y plugin/ui.html
```

Cargar en Figma: *Plugins → Development → Import plugin from manifest* →
`plugin/manifest.json`. Tras cada `npm run build`, recargar el plugin en Figma.

Desarrollo con rebuild automático: `npm run dev`.

## Calidad

```bash
npm test               # Vitest — funciones puras en src/lib/
npm run lint           # ESLint
npm run format         # Prettier
```

## Flujo: actualizar el catálogo

Usa el skill `update-otv-catalog`, o manualmente:

1. Pega el HTML de `orangetv.orange.es` en `catalog/OrangeCatalog.html`.
2. `cd catalog && node extract-catalog-v2.js` (parsea y mergea).
3. (Opcional) `TMDB_API_KEY=… node scripts/enrich-catalog.js --only-missing`.
4. `node scripts/export-static-catalog.js` (asegura los géneros).
5. `git add catalog/otv-catalog.json && git commit && git push`.

⚠️ El plugin lee el catálogo desde `main` por GitHub raw. **El nuevo JSON no
estará disponible hasta que el push llegue a `main`** (más la caché de 4h).

## Mapa de documentación

| Necesitas… | Lee |
|------------|-----|
| Decisiones y su porqué | `docs/adr/` |
| Especificar una feature nueva | `docs/specs/` (usa `template.md`) |
| Arquitectura / stack / estructura | `docs/codebase/` |
| Convenciones de código | `docs/codebase/CONVENTIONS.md` |
| Deuda técnica conocida | `docs/codebase/CONCERNS.md` |
| Contexto histórico del rediseño v3 | `docs/v3_handoff_context.md` |
| Reglas para asistentes (Claude) | `.claude/CLAUDE.md` |

## Reglas de oro

- No editar `plugin/code.js` ni `plugin/ui.html` — son builds. Editar `src/` y compilar.
- No commitear secretos. Las credenciales van en `.env` (gitignored).
- No commitear `catalog/OrangeCatalog.html` (gitignored).
