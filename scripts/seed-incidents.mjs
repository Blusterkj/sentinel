/**
 * seed-incidents.mjs
 * Posts a set of real-looking incidents to the live proxy → Walrus testnet.
 * Each gets a genuine blobId verifiable on walruscan.com/testnet/blob/<id>
 *
 * Run: node scripts/seed-incidents.mjs
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROXY_URL = 'https://sentinelproduction.up.railway.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INCIDENTS = [
  {
    id: crypto.randomUUID(),
    type: 'fire',
    severity: 'critical',
    description: 'Major fire reported at a multi-storey commercial complex on MG Road. Thick black smoke visible from over 2km away. Fire tenders have been dispatched and residents in adjacent buildings are being evacuated.',
    location: { lat: 12.9716, lng: 77.5946, address: 'MG Road, Bengaluru, Karnataka 560001, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 min ago
    reportedBy: 'community',
    status: 'active',
  },
  {
    id: crypto.randomUUID(),
    type: 'medical',
    severity: 'high',
    description: 'Elderly man collapsed near India Gate metro station. Bystanders performing CPR. Ambulance has been called but has not arrived yet. Patient is unresponsive and requires immediate medical attention.',
    location: { lat: 28.6129, lng: 77.2295, address: 'India Gate, New Delhi, Delhi 110001, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(), // 9 min ago
    reportedBy: 'community',
    status: 'active',
  },
  {
    id: crypto.randomUUID(),
    type: 'accident',
    severity: 'high',
    description: 'Serious road accident on the Mumbai-Pune Expressway near Khopoli. Two vehicles involved — one truck and one passenger car. Car is overturned. At least 3 people injured, one critically. Traffic backed up for over 4km.',
    location: { lat: 18.7879, lng: 73.3441, address: 'Mumbai-Pune Expressway, Khopoli, Maharashtra, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 34).toISOString(), // 34 min ago
    reportedBy: 'community',
    status: 'active',
  },
  {
    id: crypto.randomUUID(),
    type: 'natural_disaster',
    severity: 'critical',
    description: 'Flash flooding reported across multiple low-lying areas of Hyderabad following 3 hours of heavy rainfall. Hussain Sagar lake overflow is imminent. Several vehicles stranded on submerged roads. NDRF teams deployed.',
    location: { lat: 17.3850, lng: 78.4867, address: 'Hussain Sagar, Hyderabad, Telangana 500004, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 52).toISOString(), // 52 min ago
    reportedBy: 'community',
    status: 'active',
  },
  {
    id: crypto.randomUUID(),
    type: 'crime',
    severity: 'high',
    description: 'Armed robbery reported at a jewellery shop on Park Street, Kolkata. Three masked individuals fled with cash and ornaments estimated at over ₹15 lakhs. Police have been notified and are reviewing CCTV footage from nearby cameras.',
    location: { lat: 22.5514, lng: 88.3612, address: 'Park Street, Kolkata, West Bengal 700016, India' },
    timestamp: new Date(Date.now() - 1000 * 60 * 26).toISOString(), // 26 min ago
    reportedBy: 'community',
    status: 'active',
  },
];

async function fetchWithTimeout(url, options = {}, ms = 120000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') { const e = new Error('TIMEOUT'); e.isTimeout = true; throw e; }
    throw err;
  }
}

console.log(`\n🔗 Proxy: ${PROXY_URL}`);
console.log(`📦 Seeding ${INCIDENTS.length} real incidents into Walrus testnet...\n`);

const results = [];

for (const [i, incident] of INCIDENTS.entries()) {
  console.log(`[${i + 1}/${INCIDENTS.length}] 📤 Storing: ${incident.type.toUpperCase()}/${incident.severity}`);
  console.log(`    📍 ${incident.location.address}`);
  console.log(`    📝 "${incident.description.slice(0, 70)}…"`);

  try {
    const res = await fetchWithTimeout(`${PROXY_URL}/api/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
    }, 120000);

    if (res.ok) {
      const data = await res.json();
      if (data.blobId) {
        console.log(`    ✅ Stored → blobId: ${data.blobId}`);
        console.log(`    🔗 https://walruscan.com/testnet/blob/${data.blobId}`);
        results.push({ ...incident, walrusBlobId: data.blobId, status: 'seeded' });
      } else {
        console.log(`    ❌ No blobId returned: ${JSON.stringify(data).slice(0, 100)}`);
        results.push({ ...incident, status: 'failed', error: 'no blobId' });
      }
    } else {
      const body = await res.text();
      console.log(`    ❌ HTTP ${res.status}: ${body.slice(0, 100)}`);
      results.push({ ...incident, status: 'failed', error: `HTTP ${res.status}` });
    }
  } catch (err) {
    console.log(`    ❌ ${err.isTimeout ? 'TIMEOUT' : 'ERROR'}: ${err.message}`);
    results.push({ ...incident, status: 'failed', error: err.message });
  }

  if (i < INCIDENTS.length - 1) {
    console.log(`    ⏳ Waiting 5s before next...\n`);
    await sleep(5000);
  }
}

console.log('\n=====================================');
console.log('SEEDING COMPLETE');
console.log('=====================================');
const seeded = results.filter(r => r.status === 'seeded').length;
const failed = results.filter(r => r.status === 'failed').length;
console.log(`✅ Successfully seeded: ${seeded}`);
console.log(`❌ Failed:             ${failed}`);
console.log('=====================================\n');

// Save results
const outPath = resolve(__dirname, 'seed-results.json');
writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
console.log(`💾 Saved to ${outPath}\n`);

if (seeded > 0) {
  console.log('✅ Verified blob URLs:');
  results.filter(r => r.walrusBlobId).forEach(r => {
    console.log(`   ${r.type}/${r.severity} → https://walruscan.com/testnet/blob/${r.walrusBlobId}`);
  });
}
