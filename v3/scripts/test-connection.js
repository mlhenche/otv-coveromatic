#!/usr/bin/env node
/**
 * test-connection.js - Prueba de conectividad a Supabase
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function testConnection() {
  console.log('Testing Supabase connection...\n');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Key: ${SUPABASE_SERVICE_KEY?.substring(0, 20)}...\n`);

  // Try the root endpoint first
  const url = `${SUPABASE_URL}/rest/v1/`;

  try {
    console.log(`Fetching: ${url}\n`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    console.log(`Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log(`\nResponse body:`);
    console.log(text);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    console.log('\n✅ Connection successful!');
  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.error(`Error type: ${error.constructor.name}`);
    console.error(`Error message: ${error.message}`);
    console.error(`Error cause:`, error.cause);
    console.error(`Full error:`, error);
    process.exit(1);
  }
}

testConnection();
