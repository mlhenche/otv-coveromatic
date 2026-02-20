# Migración de la UI a React + Vite (Opción B)

El objetivo de esta fase es reemplazar el archivo monolítico `ui.html` por una arquitectura moderna basada en componentes, utilizando React (con TypeScript) y empaquetándolo todo con Vite en un único archivo HTML compatible con Figma.

## User Review Required

> [!IMPORTANT]
> **Cambios estructurales:** Esto requiere instalar nuevas dependencias en `v3/package.json` y reorganizar los archivos del frontend. El archivo actual `v3/plugin/ui.html` será generado automáticamente en el proceso de  `build`. El antiguo contenido de `ui.html` se descompondrá en pequeños archivos bajo la carpeta `v3/src/ui`.
> 
> **Peticiones de red:** Introduciremos `@tanstack/react-query` para gestionar la caché de las llamadas a Supabase desde la UI y mejorar la gestión del estado (carga, error, éxito). ¡Esto hará el código mucho más limpio!

## Proposed Changes

### 1. Dependencias y Configuración (Vite)

- **Actualizar `v3/package.json`**: Añadir React, Vite, TypeScript para React, Tailwind (opcional pero recomendado para estilado rápido, aunque podemos mantener CSS puro si lo prefieres) y `@tanstack/react-query`.
- **Nuevo script de compilación**:
  ```json
  "build": "tsc && vite build",
  "dev": "vite build --watch"
  ```
- **Crear `v3/vite.config.ts`**: Configurado con `vite-plugin-singlefile` para que Vite escupa un único `ui.html` con todo el CSS y JS inyectado (requisito indispensable de Figma).

---

### 2. Estructura de Componentes en `v3/src/ui`

Dividiremos los ~3700 líneas del `ui.html` original en componentes tipados y manejables:

#### [NEW] `v3/src/ui/App.tsx`
Punto de entrada. Controla qué pestaña está activa y provee el cliente de React Query.

#### [NEW] `v3/src/ui/components/Header.tsx`
Contiene los logos, el selector de modo (Live/Cache) y la llave de la API (TMDB Key).

#### [NEW] `v3/src/ui/components/Tabs.tsx`
Tabs de navegación: OTV Movies, OTV Series, TMDB, Extras, VPS Random y Capítulos.

#### [NEW] `v3/src/ui/components/Filters.tsx`
Filtro de búsqueda por texto, año y menús desplegables (géneros).

#### [NEW] `v3/src/ui/components/CoverGrid.tsx`
La cuadrícula donde se renderizan las tarjetas. Maneja los estados de `<Loading />`, `<Error />` y `<Empty />`.

#### [NEW] `v3/src/ui/components/CoverCard.tsx`
Componente individual de la película/serie. Despacha el mensaje `apply-cover` o `apply-cover-url` a Figma al hacer clic.

#### [NEW] `v3/src/ui/components/FooterLog.tsx`
La consola inferior y el contador inteligente de "Selection Info" que responde a los mensajes que envía `code.ts`.

---

### 3.Hooks Personalizados (Figma API & Supabase)

#### [NEW] `v3/src/ui/hooks/useFigmaSelection.ts`
Escucha los mensajes `selection-info` y `selection-changed` provenientes del sandbox (`code.ts`).

#### [NEW] `v3/src/ui/hooks/useSupabaseCatalog.ts`
Implementa React Query (`useQuery`) para hacer el fetch asíncrono a Supabase, reemplazando la lógica manual en Vanilla JS.

#### [DELETE] `v3/plugin/ui.html` (Original)
El archivo monolítico desaparecerá para ser reemplazado por la salida construida desde Vite.

## Verification Plan

### Automated Tests
1. Ejecutar `npm install` para asentar dependencias.
2. Ejecutar `npm run build` en el directorio `v3`.
3. Verificar que se genera un `v3/plugin/ui.html` empaquetado y válido, acompañado del `v3/plugin/code.js`.

### Manual Verification
1. Abrir el plugin en Figma (Development > Plugins > En desarrollo).
2. Asegurar que la interfaz carga correctamente, con estilos intactos.
3. Verificar que el catálogo de Orange TV carga los datos desde Supabase y los muestra en el `<CoverGrid />`.
4. Seleccionar un nodo en Figma y observar si el `<FooterLog />` cuenta los `cover` identificados correctamente.
5. Hacer clic en una tarjeta y confirmar que la imagen y los textos de metadatos se aplican bien en el canvas de Figma.
