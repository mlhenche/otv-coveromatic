# CoverOmatic v3 — Plugin de Figma

Plugin de Figma para el equipo de diseño de **Orange TV / CitrusDLS**.
Aplica carátulas, metadatos y personas a componentes del Design System directamente desde Figma.

---

## Qué hace

- **Cine y Series** — busca y aplica imágenes (portrait, landscape, background + title treatment) y metadatos (título, año, rating, duración, clasificación, sinopsis, géneros) desde el catálogo de Orange TV
- **Personas** — busca actores y directores por nombre o por reparto de una película/serie vía TMDB, y aplica su foto a componentes de personaje
- **HTML Paste** — pega el HTML de orangetv.orange.es y aplica directamente cualquier carrusel (EPG, emisiones, canales, VOD) a los componentes seleccionados. Sin necesidad de que el contenido esté en el catálogo
- **Aplicar Aleatorio** — rellena múltiples componentes seleccionados en un clic
- **Capítulos** — selecciona temporada/episodio y aplica imágenes de capítulo
- **VPS / Slideshow** — aplica background + title treatment a envolventes
- **Log** — registro de todas las acciones del plugin para depuración

---

## Estructura del proyecto

```
covers/
├── .claude/
│   └── CLAUDE.md          ← contexto completo para Claude (credenciales, proceso, arquitectura)
├── README.md
├── TODO.md                ← tareas pendientes y próximos pasos
├── v3/                    ← versión activa ✅
│   ├── plugin/            ← distribución (no editar directamente)
│   │   ├── manifest.json
│   │   ├── code.js        ← build del backend
│   │   └── ui.html        ← build del frontend (React compilado)
│   ├── src/               ← código fuente
│   │   ├── code.ts        ← backend del plugin (Figma sandbox)
│   │   └── ui/            ← interfaz React + TypeScript
│   │       ├── App.tsx
│   │       ├── components/
│   │       └── hooks/
│   ├── catalog/           ← herramientas de catálogo
│   │   ├── extract-catalog-v2.js  ← parsea OrangeCatalog.html → otv-catalog.json
│   │   └── otv-catalog.json       ← catálogo local (merge point)
│   ├── scripts/           ← CLI de gestión del catálogo en Supabase
│   │   ├── sync-to-supabase.js   ← sincroniza catálogo local → Supabase
│   │   ├── enrich-catalog.js     ← enriquece entradas sin TMDB ID
│   │   ├── add-content.js        ← añade contenido individual
│   │   ├── manage-content.js     ← activa/desactiva entradas
│   │   └── .env.example
│   ├── docs/
│   │   ├── v3_handoff_context.md ← contexto técnico y decisiones arquitectónicas
│   │   └── how-to-use-CoverOMatic.md
│   └── supabase/
│       └── schema.sql     ← esquema de la base de datos
├── v1/                    ← versión 1 (archivo)
└── v2/                    ← versión 2 (archivo)
```

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Plugin Figma | TypeScript → compilado con Vite (`vite-plugin-singlefile`) |
| UI | React 18 + TypeScript + `@tanstack/react-query` |
| Base de datos | Supabase (PostgreSQL) |
| Metadatos | TMDB API |
| Caché | `figma.clientStorage` (TTL 4h) |

---

## Cargar el plugin en Figma

1. Abre Figma Desktop
2. `Plugins` → `Development` → `Import plugin from manifest`
3. Selecciona `v3/plugin/manifest.json`

---

## Desarrollo

```bash
cd v3
npm install
npm run dev      # inicia Vite en modo watch
npm run build    # compila a v3/plugin/ui.html + code.js
```

El backend (`code.ts`) se compila por separado:
```bash
cd v3/src
npx tsc
```

---

## Gestión del catálogo

El catálogo VOD vive en **Supabase** y se actualiza con los scripts de `v3/scripts/`.
El proceso completo (obtener HTML de OrangeTV → parsear → sincronizar → enriquecer) está documentado en `.claude/CLAUDE.md`.

```bash
# Añadir un contenido individual
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... TMDB_API_KEY=... \
  node v3/scripts/add-content.js --title "Título" --contentId "SKYS_0001234"

# Sincronizar catálogo completo desde otv-catalog.json
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... TMDB_API_KEY=... \
  node v3/scripts/sync-to-supabase.js --file v3/catalog/otv-catalog.json
```

---

**Desarrollado para**: OrangeTV | CitrusDLS
**Versión activa**: v3.2 (provider logos en carruseles de canal, marzo 2026)
