# Verificación del Plugin v3 - Migración a Supabase

## Resumen de cambios

### ✅ Completado

1. **Eliminación de catálogo embebido**
   - Eliminado `OTV_CATALOG_DATA_LEGACY` (~50KB de JSON embebido)
   - Reducción de tamaño: 165K → 116K (49KB menos)
   - Archivo: `v3/plugin/ui.html`

2. **Configuración de Supabase**
   - Añadida constante `SUPABASE_URL`
   - Añadida constante `SUPABASE_ANON_KEY` (solo lectura)
   - Añadida constante `CACHE_TTL_MS` (4 horas)
   - Función helper `sbFetch()` para llamadas a Supabase

3. **Carga asíncrona desde Supabase**
   - Reemplazada función `loadOTVCatalog()` síncrona por versión async
   - Carga en paralelo: contents + genres + config
   - Transforma datos de snake_case (DB) a camelCase (código)
   - Compatible con código existente (interfaz sin cambios)

4. **Sistema de caché con clientStorage**
   - **ui.html**: Envía mensaje `cache-catalog` cuando carga exitosamente
   - **code.ts**: Handler para guardar en `clientStorage`
   - **ui.html**: Envía mensaje `get-cached-catalog` cuando falla carga
   - **code.ts**: Handler para leer de `clientStorage` y responder
   - **ui.html**: Handler `cached-catalog` que procesa datos cacheados
   - TTL de 4 horas para validez del caché

5. **Manejo de errores y fallback offline**
   - Intenta cargar desde Supabase
   - Si falla, solicita caché
   - Usa caché incluso si está expirado (modo degradado)
   - Solo muestra error si no hay caché en absoluto
   - Mensajes de consola detallados para debugging

---

## Verificación de archivos modificados

### 1. ui.html
```bash
# Verificar tamaño reducido
ls -lh v3/plugin/ui.html
# Debe mostrar ~116K

# Verificar que no hay OTV_CATALOG_DATA_LEGACY
grep -c "OTV_CATALOG_DATA_LEGACY" v3/plugin/ui.html
# Debe retornar 0

# Verificar configuración Supabase
grep "SUPABASE_URL" v3/plugin/ui.html
grep "SUPABASE_ANON_KEY" v3/plugin/ui.html
grep "CACHE_TTL_MS" v3/plugin/ui.html

# Verificar función async loadOTVCatalog
grep -A 5 "async function loadOTVCatalog" v3/plugin/ui.html
```

### 2. code.ts
```bash
# Verificar handlers de caché
grep -A 10 "cache-catalog" v3/src/code.ts
grep -A 10 "get-cached-catalog" v3/src/code.ts

# Compilar TypeScript
cd v3/src
npm run build
# Debe compilar sin errores
```

### 3. Scripts de gestión
Todos los scripts están en `v3/scripts/`:

- ✅ `migrate-to-supabase.js` - Migración inicial completada (304 contents)
- ✅ `manage-content.js` - Activar/desactivar contenidos
- ✅ `add-content.js` - Añadir contenidos con enriquecimiento TMDB
- ✅ `enrich-catalog.js` - Re-enriquecer contenidos existentes
- ✅ `sync-to-supabase.js` - Sincronizar desde parser de OrangeTV
- ✅ `test-connection.js` - Verificar conexión a Supabase
- ✅ `test-scripts.sh` - Suite de tests automatizados
- ✅ `update-ui-for-supabase.js` - Script usado para modificar ui.html

---

## Cómo probar el plugin en Figma

### Paso 1: Cargar el plugin en Figma

1. Abre Figma Desktop
2. Ve a **Plugins** → **Development** → **Import plugin from manifest...**
3. Selecciona el archivo: `v3/manifest.json`
4. El plugin debería aparecer en **Plugins** → **Development** → **CoverOmatic v3**

### Paso 2: Abrir el plugin

1. Crea un nuevo documento o abre uno existente
2. Ve a **Plugins** → **Development** → **CoverOmatic v3**
3. Se abrirá la interfaz del plugin

### Paso 3: Verificar carga desde Supabase

#### Escenario A: Con conexión a internet (primera vez)

**Resultado esperado:**
1. La consola del plugin debe mostrar:
   ```
   Loading OTV catalog from Supabase...
   OTV catalog loaded from Supabase: 185 movies, 119 series
   Catalog cached successfully
   ```
2. El plugin debe mostrar la pestaña OTV con películas y series disponibles
3. Los filtros de género deben funcionar
4. La búsqueda debe funcionar

**Cómo verificar la consola:**
- En Figma Desktop, abre DevTools: **Plugins** → **Development** → **Show/Hide Console**
- O usa `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

#### Escenario B: Con conexión a internet (segunda vez, con caché válido)

**Resultado esperado:**
1. La consola debe mostrar:
   ```
   Loading OTV catalog from Supabase...
   OTV catalog loaded from Supabase: 185 movies, 119 series
   Catalog cached successfully
   ```
2. El plugin carga desde Supabase y actualiza el caché
3. Si Supabase responde rápido, no notarás diferencia

#### Escenario C: Sin conexión a internet (con caché)

**Resultado esperado:**
1. La consola debe mostrar:
   ```
   Loading OTV catalog from Supabase...
   Error loading catalog from Supabase: [error details]
   Attempting to load from cache...
   Using cached catalog (age: X minutes)
   OTV catalog loaded from cache: 185 movies, 119 series
   ```
2. El plugin funciona normalmente usando datos cacheados
3. Si el caché tiene más de 4 horas, mostrará:
   ```
   Using EXPIRED cached catalog (age: X hours). Offline mode.
   ```
   Pero seguirá funcionando con datos desactualizados

#### Escenario D: Sin conexión y sin caché

**Resultado esperado:**
1. La consola debe mostrar:
   ```
   Loading OTV catalog from Supabase...
   Error loading catalog from Supabase: [error details]
   Attempting to load from cache...
   ```
2. El plugin muestra mensaje de error:
   ```
   ⚠️
   No hay catálogo disponible.
   Comprueba tu conexión a internet.
   ```

### Paso 4: Verificar funcionalidad OTV

1. **Seleccionar un componente con propiedad "cover"**
   - Crea un rectángulo
   - Añade component property llamada "cover" (Text type)

2. **Aplicar contenido OTV**
   - Pestaña OTV → Busca "Gladiator" (o cualquier título)
   - Selecciona la película
   - Click en "Cover Portrait" o "Cover Landscape"
   - El cover debe aplicarse correctamente

3. **Verificar URL generada**
   - El plugin debe generar URLs con el patrón:
     ```
     https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160
     ```
   - Donde `{contentId}` es el ID del contenido seleccionado

4. **Verificar contenidos relacionados**
   - Después de aplicar un cover, usa "Add Related Content"
   - Debe mostrar contenidos del mismo género

5. **Verificar series (episodios)**
   - Busca una serie (ej: "Breaking Bad")
   - Usa "Add Episode Thumbnail" → debe cargar episodios desde TMDB

---

## Verificar estado de Supabase

### Conexión desde terminal

```bash
cd v3/scripts

export SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUyNTc4OSwiZXhwIjoyMDg3MTAxNzg5fQ.HFG2tgpLOwG4mLY79ND64MNvswFvFZTqSRcI56YtQIA"
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Test conexión
node test-connection.js

# Ver estadísticas
node -e "
async function stats() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?select=*&active=eq.true';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Prefer': 'count=exact'
    }
  });
  const count = res.headers.get('content-range');
  console.log('✓ Contenidos activos:', count);
}
stats();
"
```

**Resultado esperado:**
```
✅ Connection successful!
✓ Contenidos activos: 0-303/304
```

---

## Troubleshooting

### Plugin no carga catálogo

1. **Abrir consola del plugin** (`Cmd+Option+I`)
2. Buscar errores de red o de fetch
3. Verificar que las constantes `SUPABASE_URL` y `SUPABASE_ANON_KEY` sean correctas
4. Verificar que Supabase esté accesible:
   ```bash
   curl -I https://zmzehngquxtqirpjxyhn.supabase.co
   ```

### Error "fetch failed" en el plugin

- **Causa**: Problemas de CORS o SSL
- **Solución**: Verificar que la ANON key sea correcta
- **Nota**: El plugin usa la ANON key (no la SERVICE_ROLE key)

### Caché no funciona

1. Verificar que `code.ts` tiene los handlers de caché
2. Compilar de nuevo: `cd v3/src && npm run build`
3. Recargar el plugin en Figma (cerrar y volver a abrir)
4. Verificar consola para mensajes de caché

### Contenidos no aparecen

1. Verificar que hay contenidos activos en Supabase:
   ```bash
   cd v3/scripts
   node -e "..." # (ver comando arriba)
   ```
2. Si el count es 0, ejecutar migración:
   ```bash
   node migrate-to-supabase.js
   ```

---

## Checklist de verificación final

- [ ] Plugin compila sin errores (`npm run build`)
- [ ] ui.html tiene ~116K (reducción de 49KB)
- [ ] No hay `OTV_CATALOG_DATA_LEGACY` en ui.html
- [ ] Supabase tiene 304 contenidos activos
- [ ] Plugin carga catálogo desde Supabase (primera vez)
- [ ] Plugin usa caché en cargas posteriores
- [ ] Plugin funciona offline con caché válido
- [ ] Plugin usa caché expirado si no hay conexión
- [ ] Plugin muestra error si no hay caché ni conexión
- [ ] Aplicar covers funciona correctamente
- [ ] URLs generadas son correctas
- [ ] Búsqueda funciona
- [ ] Filtro por género funciona
- [ ] Contenidos relacionados funciona
- [ ] Episodios de series funcionan

---

## Próximos pasos opcionales

1. **Panel de administración web**
   - Crear interfaz web para gestionar catálogo sin usar scripts CLI
   - Autenticación con Supabase Auth
   - CRUD de contenidos

2. **Botón de actualización manual**
   - Añadir botón en UI para forzar recarga desde Supabase
   - Sin necesidad de cerrar y reabrir el plugin

3. **Indicador de estado de conexión**
   - Mostrar badge indicando si está usando Supabase o caché
   - Mostrar antigüedad del caché

4. **Sincronización automática**
   - Webhook de OrangeTV → script → Supabase
   - Actualización automática cuando hay nuevos contenidos

---

## Contacto

Para problemas o dudas sobre el plugin v3:
- Revisar `v3/scripts/README.md` para gestión del catálogo
- Revisar `v3/scripts/TESTING.md` para pruebas de scripts
- Revisar logs de consola del plugin para debugging
