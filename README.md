# OTV CoverOmatic - Plugin de Figma

Plugin de Figma para aplicar imágenes y metadatos de películas, series y personas desde TMDB.

## Estructura del Proyecto

Este repositorio contiene múltiples versiones del plugin:

```
/covers
├── v1/               # Versión 1.0 (Estable)
│   ├── code.ts       # Código principal del plugin
│   ├── code.js       # Código compilado
│   ├── ui.html       # Interfaz de usuario
│   ├── manifest.json # Configuración del plugin
│   └── ...
│
├── v2/               # Versión 2.0 (En desarrollo)
│   ├── code.ts       # Nueva versión con mejoras
│   ├── code.js       # Código compilado
│   ├── ui.html       # Interfaz actualizada
│   ├── manifest.json # Configuración actualizada
│   └── ...
│
└── node_modules/     # Dependencias compartidas
```

## Versiones

### v1.0 - Versión Estable
- ✅ Aplicar imágenes de TMDB a componentes de Figma
- ✅ Búsqueda de películas, series y personas
- ✅ Filtros por género y orientación
- ✅ Contenido aleatorio para múltiples componentes
- ✅ Campos soportados: title, rating, year, duration, sinopsis, ageTag

📁 Ubicación: `/v1`

### v2.0 - En Desarrollo
- 🚧 Nueva versión con enfoque mejorado
- 🚧 Características por definir

📁 Ubicación: `/v2`

## Desarrollo

### Compilar TypeScript

Para compilar los cambios en cada versión:

```bash
# Compilar v1
cd v1
npx tsc

# Compilar v2
cd v2
npx tsc
```

### Instalar Dependencias

```bash
npm install
```

## Configuración de Figma

1. Abre Figma Desktop
2. Ve a Plugins → Development → Import plugin from manifest
3. Selecciona el `manifest.json` de la versión que quieras usar:
   - `/v1/manifest.json` para v1.0
   - `/v2/manifest.json` para v2.0

## Contribuir

Para trabajar en una nueva versión:
1. Trabaja en la carpeta de la versión correspondiente
2. Compila los cambios con TypeScript
3. Prueba en Figma antes de hacer commit

---

**Desarrollado para**: OrangeTV | CitrusDLS
