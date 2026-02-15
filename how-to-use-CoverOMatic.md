# OTV CoverOmatic 1.0 - Guía Rápida

Plugin de Figma para aplicar imágenes y metadatos de películas, series y personas desde TMDB.

---

## ⚙️ Configuración Inicial

### Obtener API Key de TMDB

1. Ve a [themoviedb.org](https://www.themoviedb.org/) y crea una cuenta
2. En **Settings → API** obtén tu **API Key (v3 auth)**
3. En el plugin, haz clic en el icono 🔑 y pega la API Key
4. Haz clic en **Guardar**

---

## 🏗️ Estructura de Componentes

### Lo básico: el frame `cover`

Para que el plugin funcione, tu componente **debe tener** un frame llamado `cover`:

```
📦 Tu Componente
  └─ 🖼️ cover  ← Aquí se aplica la imagen (OBLIGATORIO)
```

### Componente completo con metadatos

Si quieres que el plugin también rellene textos, añade estos elementos:

#### Para Películas y Series:

```
📦 Tu Componente
  ├─ 🖼️ cover         ← Imagen (obligatorio)
  ├─ 📝 title         ← Título
  ├─ ⭐ rating        ← Puntuación (ej: "7.5")
  ├─ 📅 year          ← Año
  ├─ ⏱️  duration     ← Duración o temporadas
  └─ 🎭 ageTag        ← Clasificación por edad (componente con variantes)
```

#### Para Personas:

```
📦 Tu Componente
  ├─ 🖼️ cover    ← Foto (obligatorio)
  ├─ 📝 name     ← Nombre
  └─ 📝 rol      ← Rol/departamento (se oculta automáticamente si es actor)
```

### Nombres de capas (case-insensitive)

| Nombre | Tipo | Uso | Obligatorio |
|--------|------|-----|-------------|
| `cover` | FRAME/RECTANGLE | Contenedor de imagen | ✅ Sí |
| `title` | TEXT | Título del contenido | ❌ No |
| `rating` | TEXT | Valoración TMDB | ❌ No |
| `year` | TEXT | Año de estreno | ❌ No |
| `duration` | TEXT | Duración o temporadas | ❌ No |
| `name` | TEXT | Nombre de persona | ❌ No |
| `rol` | TEXT | Rol de persona | ❌ No |
| `ageTag` | INSTANCE | Clasificación edad | ❌ No |

**Importante:**
- Los nombres NO son case-sensitive: `Cover`, `COVER`, `cover` funcionan igual
- Los elementos pueden estar anidados dentro de otros frames
- El `ageTag` puede estar oculto, el plugin lo mostrará temporalmente para actualizarlo
- El `ageTag` debe tener una propiedad `rating` con variantes: `"TP"`, `"7"`, `"12"`, `"16"`, `"18"`

---

## 🎯 Cómo Usar el Plugin

### 1. Aplicar una imagen a un componente

1. Selecciona tu componente en Figma
2. En el plugin, elige **Cine**, **Series** o **Personas**
3. Busca el contenido que quieres
4. Haz clic en la imagen → Se aplica al frame `cover` y se rellenan los textos

### 2. Buscar contenido

**Búsqueda normal:**
- Escribe en el campo de búsqueda
- Los resultados se filtran automáticamente

**Filtrar por género** (Cine y Series):
- Haz clic en un género (Acción, Comedia, Drama, etc.)
- Solo se mostrarán resultados de ese género

**Cambiar orientación** (Cine y Series):
- Icono 📱 = Portrait (poster vertical)
- Icono 📺 = Landscape (backdrop horizontal)

### 3. Búsqueda de personas por contenido (NUEVO)

En la pestaña **Personas**, ahora puedes buscar de dos formas:

**Por nombre** (modo por defecto):
- Busca directamente por nombre de la persona
- Ejemplo: "Ryan Coogler"

**Por contenido**:
1. Haz clic en el botón **"Por contenido"**
2. Escribe el nombre de una película o serie (mín. 3 caracteres)
3. Aparece un listado desplegable con resultados
4. Selecciona el contenido → Se muestra el elenco y equipo técnico
5. Haz clic en la foto de la persona que quieras aplicar

**Cambiar de contenido:**
- Simplemente vuelve a buscar otra película/serie
- El nuevo elenco sustituirá al anterior

**Volver a personas trending:**
- Haz clic en la **×** de la barra "Personas de: [título]"

### 4. Rellenar varios componentes a la vez

**Contenido aleatorio:**
1. Selecciona **2 o más componentes** en Figma (Shift + Click)
2. Aplica filtros si quieres (género, orientación)
3. Aparece el botón **"🎲 Contenido Aleatorio"**
4. Haz clic → Cada componente se rellena con contenido diferente

**Ejemplo:** Selecciona 6 cards vacías → Género: Comedia → Contenido Aleatorio → Las 6 se rellenan con películas de comedia diferentes.

### 5. Cargar más resultados

- Botón **"↻ Más"** en el footer
- Carga la siguiente página de resultados

---

## 🐛 Solución de Problemas

### "No se encontró ningún frame llamado 'cover'"
**Solución:** Asegúrate de que tu componente tenga un frame llamado `cover` (puede ser mayúsculas o minúsculas).

### Los textos no se rellenan
**Solución:** Verifica que las capas de texto tengan los nombres correctos: `title`, `rating`, `year`, `duration`, `name`, `rol`.

### El ageTag no cambia
**Solución:**
- Debe ser un componente de tipo INSTANCE
- Debe llamarse `ageTag` (o variaciones)
- Debe tener una propiedad `rating` con variantes: "TP", "7", "12", "16", "18"

### "API Key inválida"
**Solución:**
- Copia de nuevo la API Key desde TMDB
- Asegúrate de usar la v3 (no v4)
- Revisa tu conexión a internet

### El dropdown de búsqueda por contenido no aparece
**Solución:**
- Asegúrate de haber cambiado a modo "Por contenido"
- Escribe al menos 3 caracteres en el buscador

---

## 💡 Panel de Log

1. Pestaña **"Log"**
2. Ver todas las peticiones a la API de TMDB
3. **Verde** = Petición exitosa | **Rojo** = Error
4. Botón "Limpiar log" para vaciar el historial

---

**Versión**: 1.0
**Desarrollado para**: OrangeTV | CitrusDLS
