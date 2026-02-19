# Guía de Pruebas - Scripts de Gestión OTV

## Configuración previa

Todas las pruebas requieren estas variables de entorno:

```bash
cd v3/scripts

export NODE_TLS_REJECT_UNAUTHORIZED=0
export SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUyNTc4OSwiZXhwIjoyMDg3MTAxNzg5fQ.HFG2tgpLOwG4mLY79ND64MNvswFvFZTqSRcI56YtQIA"
export TMDB_API_KEY="tu-api-key"  # Opcional
```

---

## Opción 1: Test Suite Automatizado

Ejecuta todos los tests de una vez:

```bash
./test-scripts.sh
```

Esto probará:
- ✓ Conexión a Supabase
- ✓ Estado actual del catálogo
- ✓ Activar/desactivar contenidos
- ✓ Listar contenidos
- ✓ Estadísticas por provider

---

## Opción 2: Pruebas Individuales

### 1. Verificar conexión

```bash
node test-connection.js
```

**Resultado esperado:**
```
✅ Connection successful!
```

---

### 2. Ver estado actual del catálogo

```bash
node -e "
async function check() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?select=*';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Prefer': 'count=exact'
    }
  });
  const count = res.headers.get('content-range');
  console.log('Total contenidos:', count);
}
check();
"
```

**Resultado esperado:**
```
Total contenidos: 0-319/320
```

---

### 3. Probar `manage-content.js`

**3.1. Obtener un contentId de ejemplo:**

```bash
node -e "
async function getOne() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?select=content_id,title&limit=1';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const data = await res.json();
  console.log('ContentId:', data[0].content_id);
  console.log('Título:', data[0].title);
}
getOne();
"
```

**3.2. Desactivar ese contenido:**

```bash
# Reemplaza CONTENT_ID con el valor obtenido arriba
node manage-content.js --disable --contentId "CONTENT_ID"
```

**Resultado esperado:**
```
⏸️ Desactivando contenido(s)...

✅ 1 contenido(s) desactivado(s)
   - Título del contenido (CONTENT_ID)
```

**3.3. Reactivarlo:**

```bash
node manage-content.js --enable --contentId "CONTENT_ID"
```

**Resultado esperado:**
```
✅ Activando contenido(s)...

✅ 1 contenido(s) activado(s)
   - Título del contenido (CONTENT_ID)
```

---

### 4. Probar `add-content.js`

**Solo si tienes TMDB_API_KEY configurada:**

```bash
node add-content.js --title "Gladiator II" --contentId "TEST_001"
```

**Resultado esperado:**
```
🚀 Añadiendo contenido(s) a Supabase...

📝 Añadiendo: Gladiator II
   ContentId: TEST_001
   🔍 Buscando en TMDB...
   ✓ Encontrado: Gladiator II (movie)
   ✓ TMDB ID: 558449
   ✓ Géneros: 28, 18, 12
   ✅ Insertado correctamente

📊 Resumen:
   ✅ Añadidos: 1
```

**4.1. Verificar que se añadió:**

```bash
node -e "
async function check() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?content_id=eq.TEST_001&select=*';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data[0], null, 2));
}
check();
"
```

**4.2. Eliminar el contenido de prueba:**

```bash
node -e "
async function remove() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?content_id=eq.TEST_001';
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  console.log('✓ Contenido de prueba eliminado');
}
remove();
"
```

---

### 5. Probar `enrich-catalog.js`

**Solo si tienes TMDB_API_KEY configurada:**

**5.1. Enriquecer solo los que no tienen TMDB ID:**

```bash
node enrich-catalog.js --only-missing
```

Esto puede tardar varios minutos dependiendo de cuántos contenidos sin TMDB data haya.

**5.2. Enriquecer un contenido específico:**

```bash
node enrich-catalog.js --contentId "CONTENT_ID"
```

**Resultado esperado:**
```
🚀 Enriqueciendo catálogo con datos de TMDB...

📖 Obteniendo contenidos...
   ✓ 1 contenido(s) a enriquecer

📝 Título del contenido
   ContentId: CONTENT_ID
   🔍 Buscando en TMDB...
   ✓ Encontrado: Título TMDB (movie)
   ✓ TMDB ID: 12345
   ✓ Géneros: 18, 28
   ✅ Actualizado correctamente

📊 Resumen:
   ✅ Enriquecidos: 1
```

---

### 6. Probar `sync-to-supabase.js`

**6.1. Crear un archivo de prueba:**

```bash
cat > test-catalog.json << 'EOF'
{
  "catalog": {
    "test-1": {
      "title": "Test Movie 1",
      "contentId": "TEST_SYNC_001",
      "mediaType": "movie"
    },
    "test-2": {
      "title": "Test Movie 2",
      "contentId": "TEST_SYNC_002",
      "mediaType": "movie"
    }
  },
  "genreNames": {
    "28": "Acción",
    "12": "Aventura"
  }
}
EOF
```

**6.2. Sincronizar (sin enriquecimiento para ir rápido):**

```bash
node sync-to-supabase.js --file test-catalog.json --skip-enrichment
```

**Resultado esperado:**
```
🚀 Sincronizando catálogo con Supabase...

📖 Leyendo test-catalog.json...
   ✓ 2 contenidos únicos en el archivo

📖 Obteniendo contenidos actuales de Supabase...
   ✓ 320 contenidos en Supabase

📊 Resumen de cambios:
   📥 A insertar: 2
   🔄 A actualizar: 0
   ⏸️  A desactivar: 0

📥 Insertando nuevos contenidos...

   + Test Movie 1
   + Test Movie 2

✅ Sincronización completada!

📊 Estadísticas finales:
   📥 Insertados: 2
   🔄 Actualizados: 0
   ⏸️  Desactivados: 0
```

**6.3. Limpiar contenidos de prueba:**

```bash
node -e "
async function cleanup() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?content_id=like.TEST_SYNC_%';
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  console.log('✓ Contenidos de prueba eliminados');
}
cleanup();
"
```

---

## Consultas útiles para verificar datos

### Ver todos los providers

```bash
node -e "
async function providers() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?select=provider&active=eq.true';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const data = await res.json();
  const counts = {};
  data.forEach(c => {
    const p = c.provider || 'Unknown';
    counts[p] = (counts[p] || 0) + 1;
  });
  console.log('Contenidos por provider:\n');
  Object.entries(counts)
    .sort((a,b) => b[1] - a[1])
    .forEach(([p, count]) => console.log(\`  \${p.padEnd(20)} \${count}\`));
}
providers();
"
```

### Ver contenidos sin TMDB ID

```bash
node -e "
async function missing() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?tmdb_id=is.null&select=title,content_id';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Prefer': 'count=exact'
    }
  });
  const count = res.headers.get('content-range');
  console.log('Contenidos sin TMDB ID:', count);
}
missing();
"
```

### Ver todos los géneros

```bash
node -e "
async function genres() {
  const url = process.env.SUPABASE_URL + '/rest/v1/genres?select=*&order=name.asc';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const data = await res.json();
  console.log('Géneros disponibles:\n');
  data.forEach(g => console.log(\`  \${String(g.id).padStart(3)} - \${g.name}\`));
}
genres();
"
```

---

## Troubleshooting

### Si obtienes "fetch failed"
```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Si obtienes "Invalid API key"
Verifica que la SERVICE_KEY sea correcta (no la ANON key):
```bash
echo $SUPABASE_SERVICE_KEY | cut -c1-30
# Debe empezar con: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX
```

### Para limpiar completamente y volver a migrar
```bash
node migrate-to-supabase.js
```

Este script limpia las tablas y vuelve a insertar todo desde `otv-catalog.json`.
