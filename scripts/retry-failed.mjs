/**
 * retry-failed.mjs — retries the 3 incidents that failed in seed-incidents.mjs
 * Uses 30s gap between requests to avoid Walrus rate limiting
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROXY_URL = 'https://sentinelproduction.up.railway.app';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FAILED = [
  {
    id: '71f13e8d-e1b2-46e5-b208-d3ff8ee8c640',
    type: 'accident', severity: 'high',
    description: 'Serious road accident on the Mumbai-Pune Expressway near Khopoli. Two vehicles involved — one truck and one passenger car. Car is overturned. At least 3 people injured, one critically. Traffic backed up for over 4km.',
    location: { lat: 18.7879, lng: 73.3441, address: 'Mumbai-Pune Expressway, Khopoli, Maharashtra, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    reportedBy: 'community', status: 'active',
  },
  {
    id: '4ea50409-7131-4118-b0f5-92af99b547af',
    type: 'natural_disaster', severity: 'critical',
    description: 'Flash flooding reported across multiple low-lying areas of Hyderabad following 3 hours of heavy rainfall. Hussain Sagar lake overflow is imminent. Several vehicles stranded on submerged roads. NDRF teams deployed.',
    location: { lat: 17.385, lng: 78.4867, address: 'Hussain Sagar, Hyderabad, Telangana 500004, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
    reportedBy: 'community', status: 'active',
  },
  {
    id: '0e3b1195-f157-4155-9fe2-a95670fd3990',
    type: 'crime', severity: 'high',
    description: 'Armed robbery reported at a jewellery shop on Park Street, Kolkata. Three masked individuals fled with cash and ornaments estimated at over 15 lakhs. Police have been notified and are reviewing CCTV footage from nearby cameras.',
    location: { lat: 22.5514, lng: 88.3612, address: 'Park Street, Kolkata, West Bengal 700016, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 26).toISOString(),
    reportedBy: 'community', status: 'active',
  },
];

console.log(`\n🔗 Proxy: ${PROXY_URL}`);
console.log(`🔄 Retrying ${FAILED.length} failed incidents with 30s gap between each...\n`);

const results = [];

for (const [i, incident] of FAILED.entries()) {
  console.log(`[${i+1}/${FAILED.length}] 📤 ${incident.type.toUpperCase()}/${incident.severity}`);
  console.log(`    📍 ${incident.location.address}`);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    const res = await fetch(`${PROXY_URL}/api/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (res.ok) {
      const data = await res.json();
      if (data.blobId) {
        console.log(`    ✅ blobId: ${data.blobId}`);
        console.log(`    🔗 https://walruscan.com/testnet/blob/${data.blobId}`);
        results.push({ id: incident.id, type: incident.type, blobId: data.blobId, status: 'stored' });
      } else {
        console.log(`    ❌ No blobId: ${JSON.stringify(data).slice(0, 80)}`);
        results.push({ id: incident.id, type: incident.type, status: 'failed', error: 'no blobId' });
      }
    } else {
      const body = await res.text();
      console.log(`    ❌ HTTP ${res.status}: ${body.slice(0, 80)}`);
      results.push({ id: incident.id, type: incident.type, status: 'failed', error: `HTTP ${res.status}` });
    }
  } catch (err) {
    console.log(`    ❌ ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR'}: ${err.message}`);
    results.push({ id: incident.id, type: incident.type, status: 'failed', error: err.message });
  }

  if (i < FAILED.length - 1) {
    console.log(`    ⏳ Waiting 30s before next (rate-limit buffer)...\n`);
    await sleep(30000);
  }
}

console.log('\n=====================================');
const ok = results.filter(r => r.status === 'stored').length;
const fail = results.filter(r => r.status === 'failed').length;
console.log(`✅ Stored: ${ok}  ❌ Failed: ${fail}`);
console.log('=====================================\n');

if (ok > 0) {
  console.log('🔗 Blob URLs:');
  results.filter(r => r.blobId).forEach(r =>
    console.log(`   ${r.type} → https://walruscan.com/testnet/blob/${r.blobId}`)
  );
}

writeFileSync(resolve(__dirname, 'retry-results.json'), JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
console.log('\n💾 Saved retry-results.json\n');
