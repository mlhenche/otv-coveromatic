# TODO — CoverOmatic v3

## Próxima tarea: Soporte para contenidos EPG y emisiones

### Contexto

Además del catálogo VOD (películas/series de streaming), Orange TV tiene contenidos de tipo **EPG** (programas de TV de la TDT y canales de pago) y **emisiones** (retransmisiones en directo/programadas). Estos contenidos NO están en TMDB.

### 3 tipos de contenido a soportar

#### Tipo 1: EPG Shows (programas de TV)

Programas de televisión con temporadas, como series pero de la TDT. Componente Angular: `app-card-generic` con URLs `/epg/`.

**Datos disponibles en el HTML:**
- Título (ej: "Got Talent España", "El Hormiguero", "Pasapalabra")
- Rating (algunos tienen, otros no)
- Año
- Temporadas (ej: "5 temporadas")
- Clasificación por edad (TP, 7, 12, 16, 18)
- Cover landscape: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/epg/COVER_ART/COVER_ART_{epgId}.jpg`
- Variante con prefijo ED: `.../epg/COVER_ART/ED_COVER_ART_{epgId}.jpg`

**Datos que FALTAN:**
- Género (Entretenimiento, Informativo, Serie, Programa, Deportes...)
- Episodios / últimas emisiones
- Sinopsis

**EPG IDs encontrados de ejemplo:**
| Título | EPG ID | Rating | Año | Temp | Edad |
|--------|--------|--------|-----|------|------|
| Got Talent España | 3994826 | 6.4 | 2025 | 5 | 12 |
| Sueños de libertad | 4415297 | 7.9 | 2023 | 3 | 12 |
| Renacer | 3994471 | 6.1 | 2024 | 2 | 12 |
| Viajeros Cuatro | 3997024 | - | 2025 | 8 | 12 |
| El Hormiguero | 4261075 | 4.8 | 2006 | 1 | 7 |
| El capitán en Japón | 4998737 | - | 2026 | 1 | 12 |
| Horizonte | 4029287 | - | 2021 | 4 | 16 |
| Pasapalabra | 4261095 | - | 2025 | 3 | TP |
| First Dates | 3996973 | - | 2025 | 5 | 12 |
| Los Gipsy Kings | 4092620 | 7.5 | 2016 | 2 | 12 |
| Código 10 | 3996977 | - | 2025 | 3 | 18 |
| Universo Calleja | 5002081 | - | 2025 | 2 | 12 |

**Nota:** Hay un caso mixto — "La que se avecina" tiene URL `/vod/` con prefijo U7D: `.../vod/COVER_ART/U7D_MFO_298249197FDF_COVER_ART.jpg`

#### Tipo 2: Emisiones (retransmisiones en directo/programadas)

Eventos programados con fecha/hora, típicamente deportes pero también otros contenidos. Componente Angular: `app-card-emission`.

**Datos disponibles en el HTML:**
- Título emisión (ej: "Avilés Industrial - Real Madrid Castilla")
- Background: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/epg/BACKGROUND/BACKGROUND_{epgId}.jpg` (3840x2160)
- Logo del canal: `https://pc.orangetv.orange.es/pc/api/rtv/v1/images/attachments_new/PRIMERA_FEDERACION_176x122.png` (3840x2160)
- Fecha (ej: "Sáb 21 feb")
- Horario (ej: "21:00 - 23:05")
- Duración (ej: "2h 5m")
- Estado "En directo" (badge rojo, clase `emission-info__status`)
- Título de sección/carousel (ej: "Primera Federación: En directo y próximamente")

**Datos que FALTAN:**
- Nombre del canal en texto (se infiere del logo)
- Categoría (Deportes, Cine, etc.)

**Componente Figma sugerido (`card_emission`):**
```
📦 card_emission
  ├─ 🖼️ cover           ← Background de la emisión
  ├─ 🖼️ channelLogo     ← Logo del canal
  ├─ 📝 title           ← "Avilés Industrial - Real Madrid Castilla"
  ├─ 📝 date            ← "Sáb 21 feb"
  ├─ 📝 time            ← "21:00 - 23:05"
  ├─ 📝 duration        ← "2h 5m"
  └─ 🔴 liveIndicator   ← Badge "En directo" (show/hide)
```

#### Tipo 3: Programación EPG de canales

La programación completa de canales TDT (La 1, Antena 3, Telecinco...) y de pago (Canal Cocina, Eurosport, Movistar La Liga...). Necesita:
- Cover landscape por programa
- Datos de la emisión (horario, duración)
- Canal
- Género del programa

---

### Propuesta de implementación: HTML Paste

**Opción más pragmática** — añadir al plugin un textarea donde el diseñador pegue directamente el HTML de una fila/carousel de Orange TV. El plugin parsea el HTML y extrae los datos automáticamente.

**Ventajas:**
- Cero APIs externas, cero coste
- Datos siempre actualizados (son los de la web en ese momento)
- Funciona con CUALQUIER tipo de card de Orange TV
- No necesita base de datos ni mantenimiento
- El diseñador elige exactamente qué fila usar
- Cubre los 3 tipos de contenido de golpe

**Flujo:**
```
1. Diseñador abre orangetv.orange.es
2. Inspecciona elemento → copia el HTML del carousel/fila
3. En el plugin: pestaña "HTML Paste" → pega el HTML
4. El plugin detecta el tipo de card (generic vs emission)
5. Parsea con DOMParser y extrae datos
6. Muestra preview de las cards extraídas
7. El diseñador selecciona y aplica a sus componentes
```

**Detección automática del tipo de card:**
```javascript
const cardTypes = {
  'app-card-generic + /epg/':  parseEPGCard,      // EPG shows
  'app-card-emission':         parseEmissionCard,  // Emisiones/directo
  'app-card-generic + /vod/':  parseVodCard        // VOD (ya soportado)
};
```

**Datos extraídos por tipo:**

EPG Show → `{ title, rating, year, seasons, ageRating, coverUrl, epgId, type: "epg" }`

Emisión → `{ title, backgroundUrl, channelLogoUrl, date, time, duration, isLive, section, type: "emission" }`

**Categorización automática (sin API):** El título del carousel (`carousel-title`) ya indica el género:
- "Lo más visto de la TDT" → Mixto
- "Primera Federación: En directo" → Deportes
- "Series que no te puedes perder" → Serie
- "Informativos" → Informativo

---

### APIs externas para enriquecimiento (opcional, futuro)

Si se necesitan datos que no están en el HTML (sinopsis, episodios detallados, programación completa):

| API | Cobertura TV ES | Precio | Mejor para |
|-----|-----------------|--------|------------|
| **TheTVDB** | ⭐⭐⭐⭐ | $12/año | Shows de TV con temporadas |
| **Gracenote/TMS** | ⭐⭐⭐⭐⭐ | $$$ | Programación EPG completa |
| **OMDb** | ⭐⭐ | Gratis | Datos básicos IMDB |

**TheTVDB** sería la mejor opción calidad/precio para enriquecer EPG shows con sinopsis, géneros y episodios. Requiere API key ($12/año).

---

### Pasos para implementar

1. **Diseñar el componente `card_emission` en Figma** (cover, channelLogo, title, date, time, duration, liveIndicator)
2. **Añadir pestaña "HTML Paste" al plugin** con textarea + parser
3. **Implementar parsers** para `app-card-generic` (EPG) y `app-card-emission`
4. **Conectar con los componentes Figma** existentes (card_landscape para EPG, card_emission para emisiones)
5. **Opcional:** Tabla `epg_contents` en Supabase para guardar shows de TV recurrentes
6. **Opcional:** Integración con TheTVDB para sinopsis/episodios

---

### Notas adicionales

- Los URLs de imágenes EPG usan `/epg/` en lugar de `/vod/` pero el dominio base es el mismo (`pc.orangetv.orange.es`)
- Los BACKGROUND de emisiones vienen en 3840x2160 (alta resolución)
- Los logos de canales están en `/attachments_new/` con formato `{NOMBRE_CANAL}_{ancho}x{alto}.png`
- Algunos shows EPG que también son VOD (ej: "La que se avecina") tienen URLs mixtas con prefijo `U7D_`
