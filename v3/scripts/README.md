# Scripts de gestión del catálogo OTV en Supabase

Estos scripts permiten gestionar el catálogo de contenidos de Orange TV almacenado en Supabase.

## Configuración

Todos los scripts requieren variables de entorno. Crea un archivo `.env` o expórtalas en tu shell:

```bash
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbG..."
export TMDB_API_KEY="tu-api-key-de-tmdb"  # Opcional para algunos scripts
```

**Importante**: Para evitar errores de certificado SSL, usa:
```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Scripts disponibles

### 1. `migrate-to-supabase.js` - Migración inicial

Migra el catálogo completo desde `otv-catalog.json` a Supabase. **Limpia las tablas antes de insertar**.

```bash
node migrate-to-supabase.js
```

**Salida esperada:**
- ✓ Géneros insertados
- ✓ Contenidos insertados (deduplicados automáticamente)

---

### 2. `manage-content.js` - Activar/desactivar contenidos

Gestiona el estado `active` de los contenidos (soft delete).

**Desactivar un contenido:**
```bash
node manage-content.js --disable --contentId "SKYS_0002700001"
```

**Activar un contenido:**
```bash
node manage-content.js --enable --contentId "SKYS_0002700001"
```

**Desactivar todos los contenidos:**
```bash
node manage-content.js --disable --all
```

**Activar todos los contenidos:**
```bash
node manage-content.js --enable --all
```

---

### 3. `add-content.js` - Añadir contenidos nuevos

Añade uno o varios contenidos al catálogo. Busca automáticamente en TMDB para enriquecer los datos.

**Añadir un contenido individual:**
```bash
node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001"
```

**Especificar el tipo de media:**
```bash
node add-content.js --title "Gladiator II" --contentId "SKYS_0002700001" --mediaType movie
```

**Añadir varios desde un archivo JSON:**
```bash
node add-content.js --file nuevos-contenidos.json
```

**Formato del archivo JSON:**
```json
[
  { "title": "Gladiator II", "contentId": "SKYS_0002700001" },
  { "title": "Wicked 2", "contentId": "SKYS_0002700002", "mediaType": "movie" }
]
```

**Qué hace:**
1. Busca el título en TMDB
2. Obtiene `tmdb_id`, `tmdb_title`, `media_type`, `genre_ids`
3. Extrae el `provider` del prefijo del `contentId`
4. Inserta en Supabase

---

### 4. `enrich-catalog.js` - Re-enriquecer con datos de TMDB

Actualiza los metadatos de TMDB de los contenidos existentes.

**Enriquecer todo el catálogo:**
```bash
node enrich-catalog.js
```

**Solo los que no tienen `tmdb_id`:**
```bash
node enrich-catalog.js --only-missing
```

**Un contenido específico:**
```bash
node enrich-catalog.js --contentId "SKYS_0002700001"
```

**Qué hace:**
1. Busca cada contenido en TMDB por título
2. Actualiza `tmdb_id`, `tmdb_title`, `media_type`, `genre_ids`
3. Respeta rate limits de TMDB (4 req/seg)

---

### 5. `sync-to-supabase.js` - Sincronizar desde parser de OrangeTV

Sincroniza el catálogo desde un `catalog.json` generado por el parser de la web de Orange TV.

**Sincronizar con enriquecimiento TMDB:**
```bash
node sync-to-supabase.js --file catalog.json
```

**Sincronizar sin enriquecimiento (más rápido):**
```bash
node sync-to-supabase.js --file catalog.json --skip-enrichment
```

**Qué hace:**
1. Lee el `catalog.json`
2. Compara con los contenidos actuales en Supabase
3. **Nuevos** → `INSERT` + enriquecimiento TMDB (si no se usa `--skip-enrichment`)
4. **Existentes** → `UPDATE` si el título cambió
5. **Eliminados** → `active = false` (soft delete)

**Salida esperada:**
```
📊 Resumen de cambios:
   📥 A insertar: 15
   🔄 A actualizar: 3
   ⏸️  A desactivar: 2
```

---

## Flujo de trabajo recomendado

### Primera vez (migración inicial)
```bash
# 1. Ejecutar schema.sql en Supabase (UI o CLI)
# 2. Migrar el catálogo actual
node migrate-to-supabase.js
```

### Añadir contenidos nuevos manualmente
```bash
node add-content.js --title "Nueva Película" --contentId "SKYS_123456"
```

### Actualizar desde la web de Orange TV
```bash
# 1. Generar catalog.json con el parser existente
# 2. Sincronizar con Supabase
node sync-to-supabase.js --file catalog.json
```

### Re-enriquecer contenidos sin TMDB data
```bash
node enrich-catalog.js --only-missing
```

### Desactivar un contenido que ya no existe
```bash
node manage-content.js --disable --contentId "SKYS_0002700001"
```

---

## Solución de problemas

### Error: "Invalid API key"
- Verifica que las API keys sean correctas
- Las keys de Supabase se encuentran en: `Project Settings > API`
- Asegúrate de usar la `service_role` key, no la `anon` key

### Error: "certificate has expired"
- Añade `export NODE_TLS_REJECT_UNAUTHORIZED=0` antes de ejecutar
- Esto puede ocurrir si la fecha del sistema está muy adelantada

### Error: "duplicate key value violates unique constraint"
- El script `migrate-to-supabase.js` limpia las tablas antes de insertar
- Si usas `add-content.js` con un `contentId` que ya existe, obtendrás este error
- Usa `sync-to-supabase.js` para actualizaciones incrementales

### Rate limiting de TMDB
- Los scripts respetan automáticamente los rate limits (250ms entre requests)
- Si obtienes errores 429, aumenta el delay en el código

---

## Notas importantes

- **Backups**: Supabase hace backups automáticos, pero considera exportar los datos antes de operaciones masivas
- **TMDB API**: Gratis hasta 3000 requests/día. Obtén tu key en [themoviedb.org](https://www.themoviedb.org/settings/api)
- **Providers soportados**: Prime Video, SkyShowtime, Disney+, Max, RTVE Play, Filmin, A3 Premium, Orange TV
- **Deduplicación**: Los scripts deduplicán automáticamente por `contentId` (se queda con el último)
