#!/bin/bash
# test-scripts.sh
# Script para probar todas las funcionalidades de gestión del catálogo

# Configuración (ajusta estos valores)
export SUPABASE_URL="https://zmzehngquxtqirpjxyhn.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUyNTc4OSwiZXhwIjoyMDg3MTAxNzg5fQ.HFG2tgpLOwG4mLY79ND64MNvswFvFZTqSRcI56YtQIA"
export TMDB_API_KEY=""  # Añade tu TMDB API key si quieres probar enriquecimiento
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Suite - Scripts de Gestión OTV${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

# Función auxiliar para ejecutar tests
run_test() {
    echo -e "\n${GREEN}► $1${NC}"
    echo -e "${YELLOW}─────────────────────────────────────────${NC}"
}

# TEST 1: Verificar conexión
run_test "TEST 1: Verificar conexión a Supabase"
node test-connection.js

# TEST 2: Contar contenidos actuales
run_test "TEST 2: Ver estado actual del catálogo"
node -e "
async function check() {
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

  const allRes = await fetch(process.env.SUPABASE_URL + '/rest/v1/contents?select=*', {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Prefer': 'count=exact'
    }
  });
  const allCount = allRes.headers.get('content-range');
  console.log('✓ Contenidos totales:', allCount);
}
check();
"

# TEST 3: Probar manage-content.js (desactivar y reactivar)
run_test "TEST 3: Probar activación/desactivación de contenidos"
echo "→ Buscando un contenido para probar..."
CONTENT_ID=$(node -e "
async function getFirst() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?select=content_id,title&limit=1';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const data = await res.json();
  if (data.length > 0) {
    console.log(data[0].content_id);
  }
}
getFirst();
")

if [ ! -z "$CONTENT_ID" ]; then
    echo "→ Usando contentId: $CONTENT_ID"
    echo ""
    echo "→ Desactivando contenido..."
    node manage-content.js --disable --contentId "$CONTENT_ID"
    echo ""
    echo "→ Reactivando contenido..."
    node manage-content.js --enable --contentId "$CONTENT_ID"
else
    echo "⚠️  No se encontró ningún contenido para probar"
fi

# TEST 4: Probar add-content.js (añadir y luego eliminar contenido de prueba)
run_test "TEST 4: Probar añadir contenido nuevo"
echo "→ Añadiendo contenido de prueba..."
if [ ! -z "$TMDB_API_KEY" ]; then
    node add-content.js --title "Test Movie" --contentId "TEST_999999"
else
    echo "⚠️  TMDB_API_KEY no configurada, se añadirá sin enriquecimiento"
    # Podríamos hacerlo manualmente sin TMDB, pero para el test lo omitimos
fi

# TEST 5: Listar algunos contenidos
run_test "TEST 5: Listar contenidos de ejemplo"
node -e "
async function list() {
  const url = process.env.SUPABASE_URL + '/rest/v1/contents?select=title,content_id,provider,media_type&active=eq.true&limit=10&order=title.asc';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
    }
  });
  const data = await res.json();
  console.log('✓ Primeros 10 contenidos:\n');
  data.forEach((c, i) => {
    console.log(\`  \${i+1}. \${c.title}\`);
    console.log(\`     ID: \${c.content_id} | Provider: \${c.provider || 'N/A'} | Type: \${c.media_type || 'N/A'}\`);
  });
}
list();
"

# TEST 6: Ver estadísticas por provider
run_test "TEST 6: Estadísticas por provider"
node -e "
async function stats() {
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
    const provider = c.provider || 'Unknown';
    counts[provider] = (counts[provider] || 0) + 1;
  });

  console.log('✓ Contenidos por provider:\n');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([provider, count]) => {
      console.log(\`  \${provider.padEnd(20)} \${count}\`);
    });
}
stats();
"

echo -e "\n${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Tests completados${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"
