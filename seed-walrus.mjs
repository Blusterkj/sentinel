/**
 * seed-walrus.mjs — One-time script to store all 21 seed incidents on Walrus via MemWal.
 *
 * Run from the sentinel project root:
 *   node seed-walrus.mjs
 *
 * This runs in Node.js (no CORS issues), stores each incident sequentially,
 * and saves the mapping of incident ID → real blob ID to public/blob-map.json.
 * The React app reads this file to display real, verifiable Walrus blob IDs.
 */

import { MemWal } from '@mysten-incubation/memwal';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ─── Config ──────────────────────────────────────────────────
const MEMWAL_KEY = 'a719e77e3ed1e8215b73daf2a9381979a43c3e012750c36a63f6266897f264b5';
const MEMWAL_ACCOUNT_ID = '0xb84fc39e2a39d6cf1dcc5dd87b71132634ca698c2951e870bdb9e6f8b2dce227';
const MEMWAL_SERVER_URL = 'https://relayer.memwal.ai';
const NAMESPACE = 'sentinel';
const OUTPUT_FILE = 'public/blob-map.json';

// ─── MemWal Client ───────────────────────────────────────────
const memwal = MemWal.create({
  key: MEMWAL_KEY,
  accountId: MEMWAL_ACCOUNT_ID,
  serverUrl: MEMWAL_SERVER_URL,
  namespace: NAMESPACE,
});

// ─── Seed Incidents ──────────────────────────────────────────
const daysAgo = (d, h = 0, m = 0) =>
  new Date(Date.now() - d * 86400000 - h * 3600000 - m * 60000).toISOString();

const SEED_INCIDENTS = [
  { id: 'demo-1', type: 'medical', severity: 'high', description: 'Person collapsed on MG Road near the metro station. Unresponsive. Bystanders performing CPR. Ambulance dispatched from Manipal Hospital.', location: { lat: 12.9752, lng: 77.6062, address: 'MG Road Metro Station, Bengaluru' }, timestamp: daysAgo(0, 0, 12), reportedBy: 'Witness', status: 'active' },
  { id: 'demo-2', type: 'fire', severity: 'high', description: 'Kitchen fire in commercial building on Brigade Road. Smoke visible from two blocks away. Fire department arrived in 8 minutes. Two floors evacuated.', location: { lat: 12.9719, lng: 77.6070, address: 'Brigade Road, Bengaluru' }, timestamp: daysAgo(0, 0, 28), reportedBy: 'Shop owner', status: 'active' },
  { id: 'demo-3', type: 'accident', severity: 'medium', description: 'Two-vehicle collision at the Silk Board junction. One person with head injuries. Traffic backed up 2km on Hosur Road. Ambulance and traffic police at scene.', location: { lat: 12.9176, lng: 77.6230, address: 'Silk Board Junction, Bengaluru' }, timestamp: daysAgo(0, 0, 45), reportedBy: 'Motorist', status: 'active' },
  { id: 'demo-4', type: 'crime', severity: 'medium', description: 'Chain snatching reported near Indiranagar 100ft Road. Two suspects on black Pulsar motorcycle, fled towards CMH Road. Victim: woman in her 30s, minor injuries.', location: { lat: 12.9784, lng: 77.6405, address: 'Indiranagar 100ft Road, Bengaluru' }, timestamp: daysAgo(1, 2), reportedBy: 'Victim', status: 'active' },
  { id: 'demo-5', type: 'crime', severity: 'high', description: 'Armed robbery at jewellery shop on Avenue Road. Suspect brandished knife, stole gold worth ₹8 lakh. Shop CCTV captured clear face image. Police pursuing.', location: { lat: 12.9670, lng: 77.5770, address: 'Avenue Road, Chickpet, Bengaluru' }, timestamp: daysAgo(1, 8), reportedBy: 'Shop owner', status: 'active' },
  { id: 'demo-6', type: 'medical', severity: 'low', description: 'Elderly person fell at Lalbagh botanical garden entrance. Minor bruises and scraped knee. First aid administered by park security. Family notified.', location: { lat: 12.9507, lng: 77.5848, address: 'Lalbagh Botanical Garden, Bengaluru' }, timestamp: daysAgo(2, 4), reportedBy: 'Park security', status: 'resolved' },
  { id: 'demo-7', type: 'natural_disaster', severity: 'medium', description: 'Flash flooding on Outer Ring Road near Marathahalli bridge. 12 vehicles stranded, water at knee level. BBMP pumps deployed. Diversion via Kundalahalli.', location: { lat: 12.9591, lng: 77.6969, address: 'Outer Ring Road, Marathahalli, Bengaluru' }, timestamp: daysAgo(2, 6), reportedBy: 'BBMP Control Room', status: 'resolved' },
  { id: 'demo-8', type: 'accident', severity: 'high', description: 'BMTC bus collided with auto-rickshaw at KR Puram railway crossing. Three passengers injured, one critical. Traffic diverted for 2 hours.', location: { lat: 12.9988, lng: 77.6874, address: 'KR Puram Railway Crossing, Bengaluru' }, timestamp: daysAgo(3, 10), reportedBy: 'Traffic police', status: 'resolved' },
  { id: 'demo-9', type: 'fire', severity: 'medium', description: 'Electrical fire in server room at tech park near Bellandur. Sprinklers activated. Building partially evacuated. No casualties. Short circuit suspected.', location: { lat: 12.9261, lng: 77.6762, address: 'Ecoworld Tech Park, Bellandur, Bengaluru' }, timestamp: daysAgo(3, 14), reportedBy: 'Facility manager', status: 'resolved' },
  { id: 'demo-10', type: 'crime', severity: 'medium', description: "Wallet and phone snatched from pedestrian on Church Street near Koshy's restaurant. Suspect fled on foot into Brigade Road lane. Area has poor CCTV coverage.", location: { lat: 12.9735, lng: 77.6060, address: 'Church Street, Bengaluru' }, timestamp: daysAgo(5, 22), reportedBy: 'Victim', status: 'active' },
  { id: 'demo-11', type: 'crime', severity: 'medium', description: 'Two bikes stolen from parking area near Commercial Street metro exit. Lock cut with bolt cutter. Night security guard was away from post.', location: { lat: 12.9832, lng: 77.6097, address: 'Commercial Street, Bengaluru' }, timestamp: daysAgo(5, 3), reportedBy: 'Vehicle owner', status: 'active' },
  { id: 'demo-12', type: 'medical', severity: 'medium', description: 'Construction worker fell from second floor scaffolding at Whitefield building site. Suspected fracture. Taken to Columbia Asia hospital by co-workers.', location: { lat: 12.9698, lng: 77.7500, address: 'ITPL Main Road, Whitefield, Bengaluru' }, timestamp: daysAgo(7, 9), reportedBy: 'Site foreman', status: 'resolved' },
  { id: 'demo-13', type: 'natural_disaster', severity: 'high', description: 'Large tree uprooted on Sankey Road during evening storm, blocking both lanes. Power lines down, live wire hazard. BESCOM crew and BBMP tree-cutting team dispatched.', location: { lat: 12.9900, lng: 77.5760, address: 'Sankey Road, Sadashivanagar, Bengaluru' }, timestamp: daysAgo(7, 18), reportedBy: 'Resident', status: 'resolved' },
  { id: 'demo-14', type: 'accident', severity: 'low', description: 'Minor fender-bender on Bannerghatta Road near Meenakshi Temple. No injuries. Both drivers exchanged insurance details. Slight traffic slowdown.', location: { lat: 12.9036, lng: 77.5946, address: 'Bannerghatta Road, Bengaluru' }, timestamp: daysAgo(9, 11), reportedBy: 'Motorist', status: 'resolved' },
  { id: 'demo-15', type: 'fire', severity: 'low', description: 'Small garbage fire near Majestic bus station platform 4. Quickly extinguished by station staff. Cause: discarded cigarette butt in dry waste bin.', location: { lat: 12.9767, lng: 77.5713, address: 'Majestic Bus Station, Bengaluru' }, timestamp: daysAgo(9, 5), reportedBy: 'Station staff', status: 'resolved' },
  { id: 'demo-16', type: 'crime', severity: 'high', description: 'House burglary in HAL 2nd Stage, Indiranagar. Family was away for weekend. Electronics worth ₹3 lakh and cash stolen. Forced entry through kitchen window.', location: { lat: 12.9780, lng: 77.6450, address: 'HAL 2nd Stage, Indiranagar, Bengaluru' }, timestamp: daysAgo(10, 2), reportedBy: 'Home owner', status: 'active' },
  { id: 'demo-17', type: 'medical', severity: 'high', description: 'Food poisoning outbreak at street food stall near VV Puram food street. 8 people hospitalized with vomiting and dehydration. Health inspector notified.', location: { lat: 12.9450, lng: 77.5750, address: 'VV Puram Food Street, Bengaluru' }, timestamp: daysAgo(11, 20), reportedBy: 'Hospital ER', status: 'resolved' },
  { id: 'demo-18', type: 'crime', severity: 'medium', description: 'Drunk driving hit-and-run near Koramangala 5th Block. Victim: delivery rider. Suspect vehicle: white Swift, partial plate KA-03. Dashcam footage available.', location: { lat: 12.9352, lng: 77.6245, address: 'Koramangala 5th Block, Bengaluru' }, timestamp: daysAgo(12, 23), reportedBy: 'Witness', status: 'active' },
  { id: 'demo-19', type: 'crime', severity: 'medium', description: "Phone snatching near Cubbon Park metro entrance. Suspect on scooter approached from behind, grabbed phone from victim's hand. Third such incident this month.", location: { lat: 12.9763, lng: 77.5929, address: 'Cubbon Park Metro Station, Bengaluru' }, timestamp: daysAgo(12, 21), reportedBy: 'Victim', status: 'active' },
  { id: 'demo-20', type: 'accident', severity: 'medium', description: 'Pothole-related motorcycle accident on Bellary Road near Hebbal flyover. Rider skidded into oncoming lane. Helmet saved his life. Road repair pending for 3 weeks.', location: { lat: 13.0358, lng: 77.5970, address: 'Bellary Road, Hebbal, Bengaluru' }, timestamp: daysAgo(13, 7), reportedBy: 'Motorist', status: 'resolved' },
  { id: 'demo-21', type: 'natural_disaster', severity: 'low', description: 'Minor waterlogging reported in Rajajinagar 4th Block underpass. Water depth about 6 inches. Traffic able to pass slowly. BBMP drain clearing scheduled.', location: { lat: 12.9905, lng: 77.5545, address: 'Rajajinagar 4th Block, Bengaluru' }, timestamp: daysAgo(13, 15), reportedBy: 'Resident', status: 'resolved' },
];

// ─── Format text for MemWal ──────────────────────────────────
function formatIncidentText(incident) {
  return `SENTINEL INCIDENT REPORT
ID: ${incident.id}
Timestamp: ${incident.timestamp}
Type: ${incident.type.replace('_', ' ').toUpperCase()}
Severity: ${incident.severity.toUpperCase()}
Location: ${incident.location.address} (lat: ${incident.location.lat}, lng: ${incident.location.lng})
Description: ${incident.description}
Reported By: ${incident.reportedBy}
Status: ${incident.status}`;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('\n🔗 SENTINEL — Walrus Seed Script');
  console.log('================================\n');

  // Load existing blob map to resume from where we left off
  let blobMap = {};
  if (existsSync(OUTPUT_FILE)) {
    try {
      blobMap = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
      console.log(`📂 Found existing blob-map.json with ${Object.keys(blobMap).length} entries\n`);
    } catch {
      blobMap = {};
    }
  }

  const toSeed = SEED_INCIDENTS.filter((inc) => !blobMap[inc.id]);
  if (toSeed.length === 0) {
    console.log('✅ All 21 incidents already seeded! Nothing to do.\n');
    console.log('Blob map:', JSON.stringify(blobMap, null, 2));
    return;
  }

  console.log(`📊 ${Object.keys(blobMap).length} already seeded, ${toSeed.length} remaining\n`);

  let successes = 0;
  let failures = 0;

  for (let i = 0; i < toSeed.length; i++) {
    const incident = toSeed[i];
    const text = formatIncidentText(incident);
    const progress = `[${i + 1}/${toSeed.length}]`;

    process.stdout.write(`${progress} ${incident.id} (${incident.type}) → `);

    try {
      const result = await memwal.rememberAndWait(text, undefined, {
        pollIntervalMs: 2000,
        timeoutMs: 120000,
      });

      blobMap[incident.id] = result.blob_id;
      successes++;
      console.log(`✅ ${result.blob_id}`);

      // Save after each success so we can resume
      writeFileSync(OUTPUT_FILE, JSON.stringify(blobMap, null, 2));
    } catch (err) {
      failures++;
      console.log(`❌ ${err.message || err}`);
    }

    // Gentle delay between requests
    if (i < toSeed.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log('\n================================');
  console.log(`✅ Successes: ${successes}`);
  console.log(`❌ Failures:  ${failures}`);
  console.log(`📊 Total in blob-map: ${Object.keys(blobMap).length}/21`);
  console.log(`📁 Saved to: ${OUTPUT_FILE}\n`);

  if (Object.keys(blobMap).length > 0) {
    console.log('🎯 The React app will automatically load real blob IDs from blob-map.json');
    console.log('   Run `npm run dev` and check the Memory page!\n');
  }
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
