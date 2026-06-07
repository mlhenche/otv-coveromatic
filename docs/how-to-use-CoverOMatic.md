# CoverOmatic 3.0 - Guía Rápida

Plugin de Figma para aplicar imágenes y metadatos de películas, series, episodios y personas desde TMDB y el catálogo OrangeTV.

**Novedades v3.1:**
- 🌐 Nueva pestaña **HTML Paste** — aplica contenido de cualquier carrusel de Orange TV sin necesidad de catálogo
- 🏷️ Soporte para EPG, emisiones en directo y canales (además del VOD habitual)
- ✅ Título del carrusel aplicado automáticamente al nodo `Row_title` del componente

**Novedades v3.0:**
- 🚀 Catálogo cargado dinámicamente desde Supabase (sin necesidad de actualizar el plugin)
- 📦 Plugin 49KB más ligero (sin JSON embebido)
- 💾 Sistema de caché inteligente (funciona offline con datos guardados)
- 🔄 Actualizaciones automáticas del catálogo en tiempo real

---

## ⚠️ Advertencia Importante para Diseñadores

**IMPORTANTE:** Siempre comprobar y validar los datos que añade el plugin antes de publicar los diseños. El plugin obtiene información automáticamente de TMDB y del catálogo OTV, pero pueden existir:

- **Errores en metadatos de TMDB:** Títulos, sinopsis o fechas incorrectas
- **Imágenes de baja calidad:** O con relaciones de aspecto incorrectas
- **Clasificaciones por edad:** Pueden no corresponder con las clasificaciones españolas
- **Géneros mal asignados:** O información incompleta
- **Contenido inapropiado:** En sinopsis o títulos que no pasan validación

**Responsabilidad final:** El diseñador debe revisar y corregir cualquier información antes de entregar los diseños finales al cliente.

---

## ⚙️ Configuración Inicial

### Obtener API Key de TMDB

1. Ve a [themoviedb.org](https://www.themoviedb.org/) y crea una cuenta
2. En **Settings → API** obtén tu **API Key (v3 auth)**
3. En el plugin, haz clic en el icono 🔑 y pega la API Key
4. Haz clic en **Guardar**

### Primera carga del catálogo (automática)

Al abrir el plugin por primera vez:
1. Se conecta automáticamente a Supabase para cargar el catálogo OTV
2. Los datos se guardan en caché local (válido 4 horas)
3. En las siguientes aperturas, usa el caché si está disponible

**Modo offline:** Si no tienes conexión a internet, el plugin usa automáticamente el catálogo cacheado (aunque esté expirado). Verás un mensaje en consola indicando la antigüedad de los datos.

---

## 🏗️ Estructura de Componentes

### El frame `cover` (obligatorio)

Todos los componentes **deben tener** un frame llamado `cover` para que el plugin funcione:

```
📦 Tu Componente
  └─ 🖼️ cover  ← Aquí se aplica la imagen (OBLIGATORIO)
```

### Componentes con metadatos

#### Para Películas y Series (portrait/landscape):

```
📦 card_portrait / card_landscape
  ├─ 🖼️ cover         ← Imagen (obligatorio)
  ├─ 📝 title         ← Título
  ├─ ⭐ rating        ← Puntuación (ej: "7.5")
  ├─ 📅 year          ← Año
  ├─ ⏱️  duration     ← Duración o temporadas
  ├─ 📄 sinopsis      ← Sinopsis
  └─ 🎭 ageTag        ← Clasificación por edad (componente con variantes)
```

#### Para VPS (Video Product Section):

```
📦 vps
  ├─ 🖼️ cover              ← Background panorámico
  ├─ 🖼️ titleTreatment     ← Logo del contenido (opcional)
  ├─ 📝 title              ← Título
  ├─ ⭐ rating             ← Puntuación
  ├─ 📅 year               ← Año
  ├─ ⏱️  duration          ← Duración o temporadas
  ├─ 📄 sinopsis           ← Sinopsis
  └─ 🎭 ageTag             ← Clasificación por edad
```

#### Para Capítulos de Series:

```
📦 card_chapters
  ├─ 🖼️ cover      ← Imagen still del episodio
  ├─ 📝 title      ← Título del episodio
  ├─ 📝 chapter    ← Número de episodio (formato: "T01 | E03")
  ├─ ⏱️  duration  ← Duración del episodio
  └─ 📄 sinopsis   ← Sinopsis del episodio
```

#### Para Personas:

```
📦 card_reparto
  ├─ 🖼️ cover    ← Foto
  ├─ 📝 name     ← Nombre
  └─ 📝 rol      ← Rol/departamento (se oculta automáticamente si es actor)
```

### Tabla de nombres de capas

| Nombre | Tipo | Uso | Componente |
|--------|------|-----|------------|
| `cover` | FRAME/RECTANGLE | Contenedor de imagen | Todos (obligatorio) |
| `titleTreatment` | FRAME/RECTANGLE | Logo del contenido | VPS |
| `title` | TEXT | Título | Todos menos personas |
| `rating` | TEXT | Valoración TMDB | Películas, series, VPS |
| `year` | TEXT | Año de estreno | Películas, series, VPS |
| `duration` | TEXT | Duración o temporadas | Películas, series, capítulos, VPS |
| `sinopsis` | TEXT | Sinopsis | Todos |
| `chapter` | TEXT | Número de episodio | Capítulos |
| `name` | TEXT | Nombre de persona | Personas |
| `rol` | TEXT | Rol de persona | Personas |
| `ageTag` | INSTANCE | Clasificación edad | Películas, series, VPS |
| `providerLogoSquare` | INSTANCE | Logo del proveedor (cuadrado) | Todos |
| `providerLogoRectangle` | INSTANCE | Logo del proveedor (rectangular) | Todos |

**Importante:**
- Los nombres NO son case-sensitive: `Cover`, `COVER`, `cover` funcionan igual
- Los elementos pueden estar anidados dentro de otros frames
- El plugin detecta automáticamente el tipo de componente por su nombre
- Soporta nombres personalizados: si tu componente se llama `card01` pero es una instancia de `card_chapters`, funcionará igual

---

## 🎯 Cómo Usar el Plugin

### 1. Aplicar contenido básico

1. Selecciona tu componente en Figma
2. En el plugin, elige la pestaña **Cine** o **Series**
3. Busca el contenido que quieres
4. Haz clic en la imagen → Se aplica al frame `cover` y se rellenan los textos

### 2. Trabajar con series

Cuando haces hover sobre una **serie** en el catálogo OTV, aparecen dos opciones:

**Botón "Datos":**
- Aplica los metadatos generales de la serie (título, año, temporadas, sinopsis, etc.)
- Igual que hacer clic en una película

**Botón "Temporadas"** (solo series):
- Abre el selector de temporadas y episodios
- Puedes elegir episodios individuales o aplicar varios a la vez

#### Aplicar capítulos individuales

1. Selecciona **una** card de tipo `card_chapters`
2. Hover sobre la serie → Click en **"Temporadas"**
3. Selecciona la temporada
4. Click en el episodio que quieras → Se aplica a la card

#### Aplicar varios capítulos a la vez

1. Selecciona **varias** cards de tipo `card_chapters` (o un frame que las contenga)
2. Hover sobre la serie → Click en **"Temporadas"**
3. Selecciona la temporada
4. Click en **"Añadir capítulos"** → Se aplican los episodios en orden a todas las cards

### 3. Flujo VPS completo

Cuando aplicas contenido a una **VPS**, aparece un diálogo con opciones:

#### Para series VPS:

1. **Añadir capítulos**
   - Abre el selector de temporadas
   - Puedes añadir episodios de distintas temporadas
   - Vuelve al diálogo después de cada aplicación

2. **Añadir contenido relacionado**
   - Filtra el catálogo OTV por los géneros de la serie
   - Aplica aleatoriamente a las cards portrait/landscape que tengas seleccionadas
   - Perfecto para rellenar un carrusel con contenido del mismo género

3. **Ver reparto**
   - Te lleva a la pestaña Personas con el reparto de la serie
   - Puedes aplicar fotos de actores a tus componentes de reparto

4. **Más tarde**
   - Cierra el diálogo completamente

#### Para películas VPS:

1. **Añadir contenido relacionado**
   - Igual que en series, filtra por géneros y aplica aleatoriamente

2. **Ver reparto**
   - Te lleva a la pestaña Personas con el reparto de la película

3. **Más tarde**
   - Cierra el diálogo

**El diálogo es persistente:** Después de añadir capítulos o contenido relacionado, el diálogo vuelve a aparecer para que puedas seguir añadiendo más contenido sin perder la referencia de la serie/película.

### 4. Búsqueda de personas

En la pestaña **Personas**, puedes buscar de dos formas:

**Por nombre** (modo por defecto):
- Busca directamente por nombre de la persona
- Ejemplo: "Ryan Coogler"

**Por contenido**:
1. Haz clic en el botón **"Por contenido"**
2. Escribe el nombre de una película o serie (mín. 3 caracteres)
3. Aparece un listado desplegable con resultados
4. Selecciona el contenido → Se muestra el elenco y equipo técnico en orden: directores, guionistas, actores
5. Haz clic en la foto de la persona que quieras aplicar

### 5. Pestaña HTML — Contenido directo de Orange TV

La pestaña **HTML** permite aplicar cualquier carrusel de la web de Orange TV a tus componentes Figma, sin necesidad de que el contenido esté en el catálogo. Funciona con VOD, EPG, emisiones en directo y canales.

#### Cómo obtener el HTML

1. Abre **orangetv.orange.es** en Chrome y navega a la página que quieras
2. Haz clic derecho en cualquier parte de la página → **Inspeccionar**
3. En el panel de DevTools, localiza la etiqueta `<app-root>` al inicio del código
4. Haz clic derecho sobre `<app-root>` → **Edit as HTML**
5. Selecciona todo el contenido (Ctrl+A), cópialo y pégalo en el campo de texto del plugin

#### Aplicar contenido

1. Una vez pegado el HTML, haz clic en **Parsear HTML**
2. Aparece la lista de carruseles detectados. Haz clic en el que quieras
3. Ves el grid de cards con sus imágenes
   - **Clic en una card** → aplica esa card al componente seleccionado en Figma
   - **Botón "Aplicar fila completa"** → aplica todas las cards en orden a los componentes seleccionados
4. Si el componente tiene un nodo de texto de título de fila, se rellena automáticamente con el nombre del carrusel

#### Notas

- **Carruseles de canales** (`app-carousel-channel`): al aplicar la fila completa, las primeras 3 cards se saltan automáticamente (son cards fijas de cabecera del componente Figma `row_card_channel`)
- Las imágenes se cargan directamente desde la CDN de Orange TV — necesitas conexión de red
- Si alguna imagen no está disponible se salta esa card y continúa con las demás; al final se notifica cuántas se aplicaron y cuántas fallaron

---

### 6. Contenido aleatorio

**Para películas/series:**
1. Selecciona **2 o más componentes** en Figma (Shift + Click)
2. Aplica filtros si quieres (género, orientación)
3. Aparece el botón **"🎲 Contenido Aleatorio"**
4. Haz clic → Cada componente se rellena con contenido diferente

**Ejemplo:** Selecciona 6 cards vacías → Género: Comedia → Contenido Aleatorio → Las 6 se rellenan con películas de comedia diferentes.

### 7. Filtros y búsqueda

**Búsqueda normal:**
- Escribe en el campo de búsqueda
- Los resultados se filtran automáticamente

**Filtrar por género** (Cine y Series):
- Haz clic en un género (Acción, Comedia, Drama, etc.)
- Solo se mostrarán resultados de ese género

**Cambiar orientación** (Cine y Series):
- Icono 📱 = Portrait (poster vertical)
- Icono 📺 = Landscape (backdrop horizontal)

### 8. Provider Logo Automático

El plugin detecta **automáticamente el proveedor** del contenido desde el ID y actualiza el componente `providerLogoSquare` o `providerLogoRectangle` si lo tienes en tu diseño.

**Cómo funciona:**
1. El plugin extrae el prefijo del `contentId` (parte antes del primer `_` o `-`)
2. Mapea el prefijo al valor correcto de la variable "provider"
3. Actualiza automáticamente el componente providerLogo

**Tabla de correspondencias:**

| Prefijo en contentId | Variable "provider" en Figma |
|----------------------|------------------------------|
| `PRIME`              | Prime Video                  |
| `SKYS`               | SkyShowtime                  |
| `DSN`                | Disney+                      |
| `MAX`                | Max                          |
| `RTVE`               | RTVE Play                    |
| `FLMN`               | Filmin                       |
| `APREM`              | A3 Premium                   |

**Ejemplo:**
- Si aplicas contenido con `contentId = "PRIME_12345_..."`
- El componente `providerLogo` cambiará su variable `provider` a `"Prime Video"`
- El logo se actualizará automáticamente

**Nota:** Si el contentId no tiene un prefijo reconocido, el componente providerLogo no se modifica (mantiene su valor actual).

---

## 🐛 Solución de Problemas

### "No se encontró ningún frame llamado 'cover'"
**Solución:** Asegúrate de que tu componente tenga un frame llamado `cover` (puede ser mayúsculas o minúsculas).

### Los textos no se rellenan
**Solución:** Verifica que las capas de texto tengan los nombres correctos según la tabla de arriba.

### El ageTag no cambia
**Solución:**
- Debe ser un componente de tipo INSTANCE
- Debe llamarse `ageTag` (o variaciones)
- Debe tener una propiedad `rating` con variantes: "TP", "7", "12", "16", "18"

### No detecta mis cards con nombres personalizados
**Solución:**
- Si tus instancias se llaman `card01`, `card02`, etc., asegúrate de que sean instancias de componentes llamados `card_portrait`, `card_landscape`, `card_chapters`, etc.
- El plugin busca tanto en el nombre de la instancia como en el nombre del componente padre

### El botón "Temporadas" no aparece
**Solución:**
- Solo aparece en **series** del catálogo OTV
- Haz hover sobre la card de la serie para ver los botones

### El diálogo VPS no aparece
**Solución:**
- Solo aparece cuando aplicas contenido a una VPS
- El contenido debe tener un `tmdbId` válido

### El catálogo no carga o aparece vacío
**Solución:**
1. Abre la consola del plugin (Cmd+Option+I en Mac / Ctrl+Shift+I en Windows)
2. Busca mensajes de error relacionados con Supabase
3. Si ves "Error loading catalog from Supabase", verifica tu conexión a internet
4. El plugin intentará usar el caché local si existe
5. Si es la primera vez que usas el plugin, necesitas conexión a internet para la carga inicial

### El catálogo muestra datos desactualizados
**Solución:**
- El caché del plugin tiene una validez de 4 horas
- Si han pasado más de 4 horas, cierra y vuelve a abrir el plugin
- Con conexión a internet, se actualizará automáticamente desde Supabase

---

## 💡 Panel de Log

1. Pestaña **"Log"**
2. Ver todas las peticiones a la API de TMDB
3. **Verde** = Petición exitosa | **Rojo** = Error
4. Botón "Limpiar log" para vaciar el historial

---

## 🔄 Gestión del catálogo (v3.0 - Supabase)

### Nuevo sistema con Supabase

En la v3.0, el catálogo OTV se gestiona centralizadamente en Supabase. **Ya no es necesario actualizar el plugin** cuando se añaden contenidos nuevos.

### Scripts de gestión disponibles

Todos los scripts están en `v3/scripts/` y requieren configurar variables de entorno:

```bash
cd v3/scripts

# Configurar variables
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."
export TMDB_API_KEY="tu-api-key"  # Opcional para algunos scripts
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

#### 1. Añadir contenidos nuevos

```bash
# Añadir un contenido individual (busca automáticamente en TMDB)
node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001"

# Añadir varios desde un archivo JSON
node add-content.js --file nuevos-contenidos.json
```

#### 2. Sincronizar desde el HTML de OrangeTV

```bash
# 1. Parsear HTML de Orange TV (genera catalog.json)
cd ../catalog
node extract-catalog-v2.js

# 2. Sincronizar con Supabase (compara y actualiza)
cd ../scripts
node sync-to-supabase.js --file ../catalog/catalog.json
```

Este script:
- ✅ Inserta contenidos nuevos
- ✅ Actualiza contenidos existentes que hayan cambiado
- ✅ Desactiva contenidos que ya no estén en el HTML (soft delete)
- ✅ Enriquece automáticamente con datos de TMDB

#### 3. Re-enriquecer con TMDB

```bash
# Solo contenidos que no tengan tmdb_id
node enrich-catalog.js --only-missing

# Todo el catálogo
node enrich-catalog.js

# Un contenido específico
node enrich-catalog.js --contentId "SKYS_0002700001"
```

#### 4. Activar/desactivar contenidos

```bash
# Desactivar un contenido (soft delete)
node manage-content.js --disable --contentId "SKYS_0002700001"

# Reactivar
node manage-content.js --enable --contentId "SKYS_0002700001"
```

### Flujo recomendado para actualizar el catálogo

**Opción A - Desde la web de OrangeTV:**
```bash
# 1. Copiar HTML de Orange TV a OrangeCatalog.html
# 2. Extraer catálogo
cd v3/catalog
node extract-catalog-v2.js

# 3. Sincronizar con Supabase
cd ../scripts
node sync-to-supabase.js --file ../catalog/catalog.json
```

**Opción B - Añadir contenidos manualmente:**
```bash
cd v3/scripts
node add-content.js --title "Nueva Película" --contentId "SKYS_123456"
```

### ¿Cuándo se actualizan los diseñadores?

**Automáticamente:** Los cambios en Supabase se reflejan en el plugin la próxima vez que:
- El diseñador abre el plugin (carga desde Supabase)
- El caché expira (4 horas) y el plugin recarga

**No es necesario:**
- Republicar el plugin
- Actualizar archivos locales
- Notificar a los diseñadores

### Documentación completa

Para más detalles sobre los scripts de gestión:
- Ver `v3/scripts/README.md` - Documentación completa de todos los scripts
- Ver `v3/scripts/TESTING.md` - Guía de testing y verificación
- Ver `v3/PLUGIN_TESTING.md` - Testing del plugin en Figma

---

## 📊 Estadísticas del catálogo

**Estado actual (v3.1 — febrero 2026):**
- ~529 contenidos activos en Supabase
- ~470 con TMDB ID (media_type, géneros) | ~59 sin TMDB ID (realities, programas)
- 8 proveedores: Orange TV, SkyShowtime, Disney+, Max, Prime Video, RTVE Play, Filmin, A3 Premium

---

**Versión**: 3.1
**Desarrollado para**: OrangeTV | CitrusDLS
**Última actualización**: Febrero 2026

**Cambios en v3.1:**
- Nueva pestaña HTML Paste para contenido directo de orangetv.orange.es
- Soporte para EPG, emisiones en directo y canales
- Título del carrusel aplicado a nodo Row_title del componente
- Offset automático para row_card_channel (salta las 3 primeras cards)
- Instrucciones visuales paso a paso en la pestaña HTML
