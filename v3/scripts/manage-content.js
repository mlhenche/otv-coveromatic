#!/usr/bin/env node
/**
 * manage-content.js
 *
 * Activa o desactiva contenidos en Supabase (soft delete).
 *
 * Uso:
 *   node manage-content.js --disable --contentId "SKYS_0002700001"
 *   node manage-content.js --enable --contentId "SKYS_0002700001"
 *   node manage-content.js --disable --all
 *   node manage-content.js --enable --all
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL        - URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY - Service role key
 */

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const action = args.includes('--disable') ? 'disable' : args.includes('--enable') ? 'enable' : null;
const contentIdIndex = args.indexOf('--contentId');
const contentId = contentIdIndex >= 0 ? args[contentIdIndex + 1] : null;
const all = args.includes('--all');

if (!action) {
  console.error('❌ Debe especificar --enable o --disable');
  process.exit(1);
}

if (!contentId && !all) {
  console.error('❌ Debe especificar --contentId <id> o --all');
  process.exit(1);
}

// Helper: fetch a Supabase REST API
async function sbFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const newStatus = action === 'enable';
  const actionText = action === 'enable' ? 'Activando' : 'Desactivando';
  const statusEmoji = action === 'enable' ? '✅' : '⏸️';

  console.log(`${statusEmoji} ${actionText} contenido(s)...\n`);

  let endpoint;
  if (all) {
    endpoint = 'contents';
  } else {
    endpoint = `contents?content_id=eq.${contentId}`;
  }

  const result = await sbFetch(endpoint, {
    method: 'PATCH',
    body: JSON.stringify({ active: newStatus }),
  });

  if (result.length === 0) {
    console.log('⚠️  No se encontraron contenidos para actualizar');
    if (contentId) {
      console.log(`   ContentId: ${contentId}`);
    }
  } else {
    console.log(`✅ ${result.length} contenido(s) ${action === 'enable' ? 'activado(s)' : 'desactivado(s)'}`);
    if (result.length <= 5) {
      result.forEach(r => {
        console.log(`   - ${r.title} (${r.content_id})`);
      });
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
