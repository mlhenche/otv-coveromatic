# Contexto y Estado de CoverOmatic (v3)

Este documento sirve como punto de entrada y "handoff" para futuros desarrollos o IAs que trabajen en este proyecto. Agrupa las decisiones arquitectónicas previas (Plan de Implementación y Review de la v3) y las correciones logradas en esta sesión de trabajo.

---

## 1. Visión General: El salto a la V3

El plugin de Figma "CoverOmatic" (v3) abandonó el enfoque de tener datos harcodeados (~50KB de JSON del catálogo) y lo movió a una base de datos externa en **Supabase**. Las carátulas y metadatos se obtienen a través de peticiones HTTP, y se mantiene una caché persistente de 4 horas usando `figma.clientStorage` para no sobrecargar la cuota de la API y ganar velocidad de carga en la herramienta.

### Arquitectura actual de la Interfaz (UI)
Originalmente, la interfaz del plugin era un *monolito* de casi 3700 líneas de Vanilla JS en un único archivo `ui.html`. Mezclaba CSS, marcado, estado, y llamadas a APIs. 

**Decisión Arquitectónica (Implementada):**
Hemos migrado toda la capa visual a **React + TypeScript + Vite**. 
Por requerimientos de Figma, usamos el plugin `vite-plugin-singlefile` para compilar todo el árbol de React, CSS e imágenes en un único archivo `ui.html` para distribución, mientras que en desarrollo el código fuente está modularizado bajo `v3/src/ui/`.

Componentes clave:
- `App.tsx`: Orquestador principal de pestañas.
- `CoverGrid.tsx`: Muestra las carátulas, maneja la selección y las validaciones condicionales de botones (como el "Botón Aleatorio").
- `VPSNextDialog.tsx`, `SeasonPicker.tsx`: Modales para flujos complejos (Añadir a VPS, Capítulos).

Dependencias principales: `@tanstack/react-query` para gestionar estados de carga de Supabase y TMDB en React.

---

## 2. Optimizaciones en el Back-end de Figma (`code.ts`)

Para que el plugin sea rápido inspeccionando componentes internos de Orange TV en el canvas de Figma, hemos introducido técnicas asincrónicas:
- Abandonamos las lentas iteraciones recursivas manuales de Javascript puro a favor de llamadas nativas optimizadas de C++ propias de la API de Figma como `node.findAllWithCriteria({ types: ['INSTANCE'] })`.
- Cacheamos qué variables o frames internos (`cover`, `titleTreatment`, etc) pertenecen al usuario para evitar bloqueos visuales al parsear docenas de cards seleccionadas.

---

## 3. Resolución de Bugs (Sesión Actual)

Durante la migración y estabilización de la app de React han surgido y se han solucionado errores clave de lógica y de UI:

### A. Botón de "Aplicar Aleatorio" invisible
* **Síntoma:** El botón nunca aparecía a pesar de haber seleccionado bloques con decenas de componentes dentro.
* **Causa 1 (Lógica de selección):** El contador interno solo se fijaba en nodos del tipo `cover`. Los componentes de Capítulos (`rowChapters`) no tienen ninguna capa llamada `cover` en su estructura profunda, por lo que el contador era `0`. Se reparó fusionando el máximo entre `coverCount` y `chapterCardCount`.
* **Causa 2 (Migración React UI):** El className escrito en JSX era `random-apply-bar`, pero el CSS indexado esperaba `.random-bar` para aplicar el ocultamiento `display: none` base. Esto rompía el comportamiento de aparición bajo demanda.


### B. Problema de Superposición Táctil en VPS (Z-Index Fighting)
* **Síntoma:** Al seleccionar "Añadir Capítulos" o "Añadir Relacionados" desde el popup flotante del VPS, el siguiente modal aparecía congelado y no respondía a clics.
* **Causa:** El overlay oscurecido del VPS Dialog tenía un `z-index` en CSS de `250`, mientras que el Season Picker renderizado posteriormente tenía un `z-index` de `200`. Visualmente, la trampa de clics del VPS seguía "arriba", atrapando y bloqueando todos los eventos del usuario. Se corrigió disminuyendo el z-index del VPS.


### C. Caída del "Title Treatment" en Slideshows y Filmin
* **Slideshow missing code:** Al querer ocultar el modal VPS a algunos componentes para que solo saliese explícitamente cuando `componentType === 'vps'`, se desvinculó de paso la lógica interna que autorizaba descargar imágenes `TITLE_TREATMENT` y `BACKGROUND` a los slideshows. Se restauró el modificador en `applyOTVContent`.
* **Filmin Logo & Title Treatment rotos:** Las herramientas internas calculaban el proveedor partiendo el `contentId` de Orange por un guión bajo (Ej. `PRIME_12345` => `PRIME`). Sin embargo, el contenido de Filmin no trae guión bajo (`FLMN10000050694`). Esto rompía el script devolviendo un proveedor nulo silencioso que interrumpía la cadena asíncrona de pintado.
* **Mejora:** Se refactorizó la función auxiliaria `extractProvider()` en `code.ts` usando un cotejamiento iterativo `.startsWith()` contra el diccionario `PROVIDER_MAP`. No es necesario separar con underscores. 

### D. Provider Logos en Aplicación Masiva (Aleatorio)
* **Síntoma:** La variante condicional que dibuja el logotipo del streaming (Ej. Disney+, M+) solo funcionaba si el usuario hacía clic en una única tarjeta en Figma. Al aplicar en masa usando "Aplicar Aleatorio", el logo permanecía en blanco.
* **Causa:** El bloque lógico que inyecta los `providerValues` en las propiedades Figma del componente jamás fue migrado al socket `apply-multiple-covers-url`. Se integró el bucle directamente.

### E. Integración de Logger Inteligente
* Para futuras depuraciones en UI, creamos un `LogStore` e implantamos una pestaña dedicada que chiva por consola de forma humana lo que está intentando aplicar el plugin (IDs, Componentes Reconocidos y Orígenes de Datos OTV/TMDB). 

---

## 4. Nota sobre credenciales de Supabase

El hook `useSupabaseCatalog.ts` contiene la `SUPABASE_ANON_KEY` directamente en el código. Esto es intencionado: la clave anon de Supabase es **pública y de solo lectura**. La seguridad real la proporcionan las **Row Level Security (RLS) policies** configuradas en Supabase, que restringen el acceso a la tabla `contents` (solo lectura de registros activos), `genres` (solo lectura) y `config` (solo lectura). La clave no otorga permisos de escritura ni acceso a datos no autorizados por las policies.

---

## 5. Mejoras post-review (2026-02-23)

Correcciones y optimizaciones aplicadas tras la revisión del handoff:

- **Fisher-Yates shuffle**: Reemplazado `sort(() => Math.random() - 0.5)` (distribución sesgada) por Fisher-Yates en todos los puntos de aleatorización de `CoverGrid.tsx`.
- **Provider Logo con feedback**: Extraída función `applyProviderLogo()` en `code.ts`. Los fallos ahora se notifican al usuario vía `figma.notify()` en lugar de tragarse silenciosamente.
- **Debounce en selección**: `sendSelection()` ahora se invoca con un debounce de 120ms para evitar resoluciones async innecesarias al cambiar rápidamente la selección.
- **TMDB feedback**: Si la petición de metadata a TMDB falla, se notifica al usuario y se registra en el LogStore (antes se aplicaba la imagen sin metadata y sin aviso).
- **`findMetadataScope()` mejorada**: Ahora busca preferentemente el ancestro más cercano que contenga nodos de texto con nombres de metadata conocidos (`title`, `rating`, `year`...), en lugar de detenerse en el primer ancestro con cualquier texto.
- **Cache VPS paralelizado**: `refreshCardCache()` ahora resuelve `getMainComponentAsync()` en batches paralelos de 10, reduciendo significativamente el tiempo de resolución en VPS con muchas cards.

---

## 6. Pestaña HTML Paste (v3.1 — 2026-02-25)

Nueva funcionalidad para aplicar contenido directamente desde el HTML de `orangetv.orange.es`, sin depender del catálogo Supabase.

### Arquitectura

- **Parser**: `HtmlPasteTab.tsx` — contiene `parseHtml()` que usa `DOMParser` del navegador. Detecta todos los elementos `app-carousel-*` y extrae sus cards según el tipo (slideshow, emission, channel, corner, generic). Extrae `backgroundUrl` del CSS inline con un regex robusto que soporta nombres de fichero con paréntesis (`COVER_ART(1).jpg`).
- **Backend**: handler `apply-multiple-covers-url` en `code.ts` — ya existía para la aplicación masiva con URLs; se extendió para recibir `carouselTitle` y aplicarlo al nodo de texto `Row_title` del componente via `setProperties` (component text property) o `setTextContent` como fallback.

### Comportamientos especiales implementados

- **Row_title**: tras aplicar todas las cards, busca en la selección una propiedad de texto de componente cuyo nombre base contenga "row" y la rellena con el título del carrusel. Si no hay component property, busca un text node llamado `row_title`.
- **row_card_channel offset**: si el componente Figma tiene "row" y "channel" en el nombre, salta los primeros 3 cover nodes para respetar las cards fijas de cabecera del componente.
- **Resilencia de imágenes**: cada imagen se carga en su propio try/catch. Una imagen no disponible no aborta las demás. Al final se notifica `X cover(s) aplicadas. Y no disponibles.`

### Archivos modificados en v3.1

| Archivo | Cambio |
|---------|--------|
| `src/ui/components/HtmlPasteTab.tsx` | Nuevo componente completo (parser + UI). Regex `extractBgUrl` robusto. Instrucciones paso a paso |
| `src/ui/components/Tabs.tsx` | Orden de tabs: Cine, Series, Personas, HTML, Log |
| `src/ui/index.css` | Estilos para `.html-paste-steps` y `.html-paste-step-num` |
| `src/code.ts` | Handler `apply-multiple-covers-url` ampliado: offset channel, Row_title via setProperties, error isolation por card. `setTextContent` mejorado para nodos de texto vacíos |

---

## 7. Próximos Pasos (Next Steps)

1. **Componente `card_emission` en Figma** — el DS aún no tiene un componente específico para emisiones. La pestaña HTML ya parsea `backgroundUrl`, `channelIconUrl`, `schedule`, `live`, `duration` de las emission cards; necesita el componente Figma para aplicarlos.
2. **Nuevos componentes DS 2026** — si surgen nuevos tipos de card en el Design System, actualizar la detección en `code.ts` y los switch de URLs en `CoverGrid.tsx`.
3. **Enriquecimiento con TheTVDB** (opcional) — para EPG shows con temporadas, TheTVDB ($12/año) daría sinopsis y episodios que TMDB no tiene.
