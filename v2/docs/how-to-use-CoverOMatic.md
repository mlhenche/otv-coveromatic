# OTV CoverOmatic 2.0 - Guía Rápida

Plugin de Figma para aplicar imágenes y metadatos de películas, series, episodios y personas desde TMDB y el catálogo OrangeTV.

---

## ⚙️ Configuración Inicial

### Obtener API Key de TMDB

1. Ve a [themoviedb.org](https://www.themoviedb.org/) y crea una cuenta
2. En **Settings → API** obtén tu **API Key (v3 auth)**
3. En el plugin, haz clic en el icono 🔑 y pega la API Key
4. Haz clic en **Guardar**

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

#### Para Capítulos de Series (NUEVO):

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

### 2. Trabajar con series (NUEVO)

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

### 3. Flujo VPS completo (NUEVO)

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

### 5. Contenido aleatorio

**Para películas/series:**
1. Selecciona **2 o más componentes** en Figma (Shift + Click)
2. Aplica filtros si quieres (género, orientación)
3. Aparece el botón **"🎲 Contenido Aleatorio"**
4. Haz clic → Cada componente se rellena con contenido diferente

**Ejemplo:** Selecciona 6 cards vacías → Género: Comedia → Contenido Aleatorio → Las 6 se rellenan con películas de comedia diferentes.

### 6. Filtros y búsqueda

**Búsqueda normal:**
- Escribe en el campo de búsqueda
- Los resultados se filtran automáticamente

**Filtrar por género** (Cine y Series):
- Haz clic en un género (Acción, Comedia, Drama, etc.)
- Solo se mostrarán resultados de ese género

**Cambiar orientación** (Cine y Series):
- Icono 📱 = Portrait (poster vertical)
- Icono 📺 = Landscape (backdrop horizontal)

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

---

## 💡 Panel de Log

1. Pestaña **"Log"**
2. Ver todas las peticiones a la API de TMDB
3. **Verde** = Petición exitosa | **Rojo** = Error
4. Botón "Limpiar log" para vaciar el historial

---

## 🔄 Actualizar el catálogo con nuevos contenidos

Cuando se añadan nuevas secciones al `OrangeCatalog.html`, seguir este flujo para actualizar el plugin.

### Paso 1 — Añadir el HTML nuevo

Pegar el HTML de Orange TV al final de `OrangeCatalog.html`.

### Paso 2 — Ejecutar el pipeline de extracción

Desde la carpeta `v2/catalog/`:

```bash
node extract-catalog-v2.js   # Extrae y hace merge (preserva TMDB data existente)
node enrich-catalog.js        # Solo enriquece entradas nuevas con TMDB
node enrich-genres.js         # Solo añade géneros a entradas nuevas
node clean-catalog.js         # Elimina entradas con imágenes rotas (COVER_ART)
```

> Los tres primeros scripts son **incrementales**: saltan entradas que ya tienen datos TMDB, por lo que solo procesan las nuevas. El cuarto testea todas las imágenes con HEAD requests y elimina las que fallan.

### Paso 3 — Embeber en el plugin

Ejecutar este script Python (desde la carpeta `v2/`):

```bash
python3 << 'EOF'
import json

ui_path = 'plugin/ui.html'
cat_path = 'catalog/otv-catalog.json'

with open(cat_path) as f:
    catalog = json.load(f)

minified = json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))
new_line = f'    const OTV_CATALOG_DATA = {minified};\n'

with open(ui_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = next(i for i, l in enumerate(lines) if 'const OTV_CATALOG_DATA = ' in l)
end_idx = next(i for i in range(start_idx, len(lines)) if lines[i].rstrip().endswith('};'))
lines[start_idx:end_idx+1] = [new_line]

with open(ui_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'OK: {catalog["totalContents"]} entradas en ui.html')
EOF
```

> **Importante:** usar siempre este script Python (no `re.sub`) para el embedding. `re.sub` interpreta `\n` como salto de línea literal, rompiendo la sintaxis JavaScript.

---

**Versión**: 2.0
**Desarrollado para**: OrangeTV | CitrusDLS
**Última actualización**: Febrero 2026
