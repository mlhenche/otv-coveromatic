# OTV CoverOmatic 1.0 - Guía de Uso

Plugin de Figma para aplicar covers y metadatos de películas, series y personas desde The Movie Database (TMDB).

## 📋 Tabla de Contenidos

- [Configuración Inicial](#configuración-inicial)
- [Estructura de Componentes](#estructura-de-componentes)
- [Casos de Uso](#casos-de-uso)
- [Nombres de Capas Requeridos](#nombres-de-capas-requeridos)
- [Filtros y Búsqueda](#filtros-y-búsqueda)
- [Contenido Aleatorio](#contenido-aleatorio)
- [Solución de Problemas](#solución-de-problemas)

---

## ⚙️ Configuración Inicial

### 1. Obtener API Key de TMDB

1. Ve a [https://www.themoviedb.org/](https://www.themoviedb.org/)
2. Crea una cuenta o inicia sesión
3. Ve a **Settings → API** y obtén tu API Key
4. Copia el **API Key (v3 auth)**

### 2. Configurar el Plugin

1. Abre el plugin en Figma: **Plugins → OTV CoverOmatic 1.0**
2. Haz clic en el icono de **llave** (🔑) en la esquina superior derecha
3. Pega tu API Key de TMDB
4. Haz clic en **Guardar**

---

## 🏗️ Estructura de Componentes

Para que el plugin funcione correctamente, tus componentes deben seguir esta estructura de nombres:

### Elemento Obligatorio

#### **Frame de Imagen: `cover`**
- **Tipo**: FRAME, RECTANGLE, o cualquier nodo con propiedad `fills`
- **Nombre**: `cover` (case-insensitive: "Cover", "COVER", "cover" funcionan)
- **Función**: Contenedor donde se aplicará la imagen de portada

```
📦 Tu Componente
  ├─ 🖼️ cover         ← Imagen de la portada (OBLIGATORIO)
  ├─ 📝 title         ← Título de la película/serie
  ├─ ⭐ rating        ← Valoración (ej: "7.5")
  ├─ 📅 year          ← Año de estreno
  ├─ ⏱️  duration     ← Duración o temporadas
  └─ 🎭 ageTag        ← Clasificación por edad (componente con variantes)
```

### Elementos Opcionales de Texto

#### **Para Películas y Series:**

| Nombre de Capa | Tipo | Contenido | Ejemplo |
|----------------|------|-----------|---------|
| `title` | TEXT | Título del contenido | "Los pecadores" |
| `rating` | TEXT | Valoración TMDB | "7.5" |
| `year` | TEXT | Año de estreno | "2025" |
| `duration` | TEXT | Duración (películas) o temporadas (series) | "2h 17min" / "3 temporadas" |

#### **Para Personas:**

| Nombre de Capa | Tipo | Contenido | Ejemplo |
|----------------|------|-----------|---------|
| `name` | TEXT | Nombre de la persona | "Ryan Coogler" |
| `rol` | TEXT | Rol/departamento | "Director/a" / "Guionista" |

### Componente de Clasificación por Edad

#### **`ageTag`**
- **Tipo**: INSTANCE (componente de Figma)
- **Nombre**: `agetag` (case-insensitive)
- **Propiedad requerida**: `rating` (o `rating#...`)
- **Valores posibles**: `"TP"`, `"7"`, `"12"`, `"16"`, `"18"`

**Importante**: Este componente puede estar **oculto** y seguirá funcionando. El plugin lo hará visible temporalmente para actualizar la propiedad y luego lo volverá a ocultar.

---

## 🎯 Casos de Uso

### Caso 1: Aplicar Cover Individual

**Escenario**: Rellenar un solo componente con datos de una película específica.

**Pasos**:
1. Selecciona el componente en Figma
2. En el plugin, elige la pestaña **"Cine"**
3. Busca la película deseada
4. Haz clic en la imagen de la película

**Resultado**: El componente se rellena con:
- Portada de la película
- Título
- Valoración
- Año
- Duración
- Clasificación por edad

---

### Caso 2: Rellenar Componentes de Series

**Escenario**: Aplicar datos de una serie.

**Pasos**:
1. Selecciona el componente
2. Cambia a la pestaña **"Series"**
3. Busca y selecciona la serie
4. Haz clic en la imagen

**Resultado**: Similar a películas, pero `duration` muestra el número de temporadas:
- Ejemplo: "3 temporadas"

---

### Caso 3: Aplicar Personas (Actores/Directores)

**Escenario**: Crear fichas de reparto o equipo técnico.

**Pasos**:
1. Selecciona el componente
2. Cambia a la pestaña **"Personas"**
3. Busca el nombre de la persona
4. Haz clic en su foto

**Resultado**:
- Foto de la persona
- Nombre
- Rol (se oculta automáticamente si es actor, se muestra para director, guionista, etc.)

---

### Caso 4: Contenido Aleatorio para Múltiples Componentes

**Escenario**: Tienes 6 componentes vacíos y quieres rellenarlos rápidamente con películas de comedia diferentes.

**Pasos**:
1. **Selecciona múltiples componentes** en Figma (Shift + Click)
2. En el plugin:
   - Pestaña: **"Cine"**
   - Filtro de género: **"Comedia"**
3. Aparecerá el botón **"🎲 Contenido Aleatorio"**
4. Haz clic en el botón

**Resultado**:
- Cada componente se rellena con una película de comedia **diferente**
- Los datos son aleatorios pero respetan el filtro aplicado

---

### Caso 5: Filtrar por Género

**Escenario**: Solo quieres ver películas de acción.

**Pasos**:
1. Pestaña **"Cine"** o **"Series"**
2. En la barra de géneros, haz clic en **"Acción"**
3. Navega por los resultados filtrados

---

### Caso 6: Cambiar Orientación (Portrait/Landscape)

**Escenario**: Necesitas imágenes horizontales en lugar de posters verticales.

**Pasos**:
1. Selecciona el componente
2. En el plugin, haz clic en el icono de orientación **horizontal** (📺)
3. Selecciona la imagen deseada

**Resultado**: Se aplica el backdrop (imagen horizontal) en lugar del poster.

**Nota**: La orientación landscape no está disponible para personas.

---

## 🏷️ Nombres de Capas Requeridos

### Resumen de Nombres (Case-Insensitive)

| Elemento | Nombre | Tipo | Obligatorio | Notas |
|----------|--------|------|-------------|-------|
| Imagen de portada | `cover` | FRAME/RECTANGLE | ✅ Sí | Sin esto el plugin no funcionará |
| Título | `title` | TEXT | ❌ No | Para películas y series |
| Valoración | `rating` | TEXT | ❌ No | Puntuación de TMDB (0-10) |
| Año | `year` | TEXT | ❌ No | Año de estreno |
| Duración | `duration` | TEXT | ❌ No | Horas/minutos o temporadas |
| Nombre persona | `name` | TEXT | ❌ No | Solo para personas |
| Rol persona | `rol` | TEXT | ❌ No | Solo para personas (se oculta si es actor) |
| Clasificación edad | `agetag` | INSTANCE | ❌ No | Componente con variantes de rating |

### Ejemplo de Jerarquía Correcta

```
🎬 card_portrait_generic_2col (INSTANCE)
├─ 🖼️ cover (FRAME)
├─ 📦 metadata (FRAME)
│  ├─ 📝 title (TEXT)
│  ├─ ⭐ rating (TEXT)
│  ├─ 📅 year (TEXT)
│  ├─ ⏱️  duration (TEXT)
│  └─ 🎭 ageTag (INSTANCE)
│     └─ [Propiedad: rating = "16"]
└─ 🖼️ additional_elements...
```

**Notas Importantes**:
- Los nombres NO son case-sensitive: `Cover`, `COVER`, `cover` funcionan igual
- Los elementos de texto pueden estar **anidados** dentro de frames
- El componente `ageTag` puede estar **oculto**
- Solo el frame `cover` es **obligatorio**

---

## 🔍 Filtros y Búsqueda

### Búsqueda por Texto

1. Escribe en el campo de búsqueda
2. Los resultados se filtran automáticamente
3. Funciona en las tres categorías: Cine, Series, Personas

### Filtros por Género

**Disponible en**: Cine y Series

**Géneros disponibles**:
- Todos (predeterminado)
- Acción
- Aventura
- Animación
- Comedia
- Crimen
- Documental
- Drama
- Familia
- Fantasía
- Historia
- Terror
- Música
- Misterio
- Romance
- Ciencia ficción
- Película de TV
- Suspense
- Bélica
- Western

**Cómo usar**:
1. Haz clic en un chip de género
2. Solo se mostrarán resultados de ese género
3. Haz clic en "Todos" para quitar el filtro

### Cargar Más Resultados

- Botón **"↻ Más"** en la parte inferior
- Carga la siguiente página de resultados
- Si llegas al final, vuelve a la primera página

---

## 🎲 Contenido Aleatorio

### Cuándo Aparece el Botón

El botón **"🎲 Contenido Aleatorio"** aparece cuando:
- Tienes **2 o más componentes** seleccionados
- Los componentes tienen un frame llamado `cover`
- Hay suficientes resultados disponibles

### Cómo Funciona

1. **Selecciona múltiples componentes** en Figma
2. **Aplica filtros** si quieres (género, búsqueda, orientación)
3. Haz clic en **"Contenido Aleatorio"**
4. Cada componente se rellena con datos **diferentes** y **aleatorios**

### Ejemplo Práctico

**Situación**: Tienes 5 tarjetas vacías y quieres rellenarlas con series de ciencia ficción.

**Pasos**:
1. Selecciona las 5 tarjetas
2. Pestaña: **Series**
3. Género: **Ciencia ficción**
4. Click en **"🎲 Contenido Aleatorio"**

**Resultado**:
- Las 5 tarjetas se rellenan con series de ciencia ficción diferentes
- Cada una con sus metadatos completos (título, rating, año, temporadas, clasificación)

---

## 🐛 Solución de Problemas

### ❌ "No se encontró ningún frame llamado 'cover'"

**Problema**: El componente seleccionado no tiene un elemento llamado `cover`.

**Solución**:
- Asegúrate de que haya un frame o shape llamado exactamente `cover` dentro del componente
- Verifica que el nombre esté escrito correctamente (puede ser mayúsculas o minúsculas)

---

### ❌ Los textos no se rellenan

**Problema**: La imagen se aplica pero los textos (title, rating, etc.) no cambian.

**Solución**:
- Verifica que los nodos de texto tengan los nombres correctos: `title`, `rating`, `year`, `duration`
- Los nombres deben coincidir exactamente (aunque no importan mayúsculas/minúsculas)
- Asegúrate de que los nodos sean de tipo TEXT

---

### ❌ El ageTag no cambia su valor

**Problema**: La clasificación por edad no se actualiza.

**Solución**:
- Verifica que el componente se llame `ageTag` (o variaciones como "agetag", "AgeTag")
- Debe ser un componente de tipo INSTANCE (no un simple texto)
- Debe tener una propiedad llamada `rating` con variantes: "TP", "7", "12", "16", "18"
- El componente puede estar oculto, pero debe existir

---

### ❌ "API Key inválida"

**Problema**: El plugin no puede conectarse a TMDB.

**Solución**:
- Verifica que hayas copiado correctamente la API Key
- Asegúrate de usar la API Key v3 (no v4)
- Revisa tu conexión a internet
- Vuelve a introducir la API Key desde la configuración

---

### ❌ "No hay suficientes contenidos con imagen"

**Problema**: Intentas usar Contenido Aleatorio pero no hay suficientes resultados.

**Solución**:
- Haz clic en el botón **"Más"** para cargar más resultados
- Quita o cambia el filtro de género
- Selecciona menos componentes

---

### ❌ Las imágenes no se cargan en el grid

**Problema**: Ves placeholders vacíos en lugar de imágenes.

**Solución**:
- Verifica tu conexión a internet
- Espera unos segundos para que carguen
- Recarga el plugin

---

## 📊 Panel de Log

### Acceder al Log

1. Pestaña **"Log"** en el plugin
2. Ver todas las peticiones a la API de TMDB
3. Revisar códigos de estado y respuestas

### Interpretar el Log

- **Verde**: Petición exitosa (200 OK)
- **Rojo**: Error en la petición (401, 404, etc.)
- Haz clic en una entrada para ver detalles
- Botón **"Limpiar log"** para vaciar el historial

---

## 💡 Consejos y Mejores Prácticas

### Organización de Componentes

1. **Crea un componente base** con todos los elementos nombrados correctamente
2. **Usa Auto Layout** para que los textos se adapten al contenido
3. **Mantén el frame `cover`** siempre en la misma posición

### Workflow Eficiente

1. **Configura los filtros primero** antes de seleccionar componentes
2. Usa **"Contenido Aleatorio"** para prototipos rápidos
3. **Guarda tu API Key** - el plugin la recuerda entre sesiones

### Diseño de Componentes

1. **Componentes de ageTag**: Crea variantes para todos los valores (TP, 7, 12, 16, 18)
2. **Texto dinámico**: Usa Auto Layout para que los textos se ajusten
3. **Estados vacíos**: Diseña placeholders para cuando no haya datos

---

## 🎨 Ejemplo de Componente Completo

```
🎬 MovieCard (COMPONENT SET)
├─ 🖼️ cover (FRAME) ← Imagen de portada
│  └─ [fills: IMAGE]
├─ 📦 content (FRAME - Auto Layout)
│  ├─ 📝 title (TEXT) ← "Los pecadores"
│  │  └─ [characters: "Los pecadores"]
│  ├─ 📦 metadata_row (FRAME - Auto Layout)
│  │  ├─ ⭐ rating (TEXT) ← "7.5"
│  │  ├─ 📅 year (TEXT) ← "2025"
│  │  └─ ⏱️  duration (TEXT) ← "2h 17min"
│  └─ 🎭 ageTag (INSTANCE) ← Clasificación
│     └─ [Property: rating = "16"]
└─ 🏷️ tags (FRAME)
   ├─ rentalTag (INSTANCE)
   ├─ rateTag (INSTANCE)
   └─ numberTag (INSTANCE)
```

---

## 📞 Soporte

Para reportar bugs o solicitar features:
1. Consulta primero esta guía
2. Revisa el panel de Log para errores
3. Contacta al equipo de desarrollo de OrangeTV

---

**Versión**: 1.0
**Última actualización**: 2026
**Desarrollado para**: OrangeTV | CitrusDLS
