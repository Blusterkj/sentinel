/**
 * restore-seeds.mjs
 *
 * Phase 1: Migration script — ensures every incident in the live registry
 * has a genuine, WalrusScan-verifiable Walrus testnet blob ID.
 *
 * Run:  node scripts/restore-seeds.mjs
 *
 * Prerequisites:
 *   - Railway proxy is live and junk filter is active
 *   - npm install dotenv (already in devDependencies)
 *   - VITE_PROXY_URL in .env OR hardcoded fallback below
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ─── Load env ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

let envVars = {};
try {
  const envPath = resolve(__dirname, '../.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    envVars[key] = val;
  }
} catch (e) {
  console.warn('⚠️  Could not read .env file:', e.message);
}

// Priority: env var → hardcoded Railway URL
const PROXY_URL =
  envVars.VITE_PROXY_URL ||
  'https://sentinel-proxy-production.up.railway.app';

const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

console.log(`\n🔗 Using proxy: ${PROXY_URL}`);
console.log(`🔗 Walrus aggregator: ${WALRUS_AGGREGATOR}\n`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const e = new Error('TIMEOUT');
      e.isTimeout = true;
      throw e;
    }
    throw err;
  }
}

// ─── Step 2: Fetch live registry ──────────────────────────────────────────────
console.log('📡 Fetching live incident registry…');
let incidents;
try {
  const res = await fetchWithTimeout(`${PROXY_URL}/api/incidents`, {}, 15000);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  incidents = data.incidents || [];
} catch (err) {
  console.error('❌ Failed to fetch registry:', err.message);
  process.exit(1);
}

if (incidents.length === 0) {
  console.log('⚠️  Registry is empty — nothing to migrate. Did the proxy restart with junk filter?');
  process.exit(0);
}

console.log(`📋 Found ${incidents.length} incident(s) in live registry\n`);

// ─── Step 3: Check each blob ──────────────────────────────────────────────────
console.log('🔍 Checking blob validity…\n');

const toRestore = [];
const results = [];

for (const incident of incidents) {
  const { id, walrusBlobId } = incident;

  if (!walrusBlobId) {
    console.log(`  ⚠️  ${id} — no blobId → marked for re-store`);
    toRestore.push(incident);
    results.push({ id, oldBlobId: null, newBlobId: null, status: 'pending' });
    await sleep(200);
    continue;
  }

  console.log(`  🔍 Checking ${id}: ${walrusBlobId.slice(0, 16)}…`);

  try {
    const res = await fetchWithTimeout(
      `${WALRUS_AGGREGATOR}/${walrusBlobId}`,
      { method: 'HEAD' },
      10000
    );

    if (res.ok || res.status === 200) {
      console.log(`     ✅ VERIFIED — blob exists on Walrus testnet`);
      results.push({ id, oldBlobId: walrusBlobId, newBlobId: null, status: 'skipped' });
    } else if (res.status === 404) {
      console.log(`     ❌ 404 — blob not found → marked for re-store`);
      toRestore.push(incident);
      results.push({ id, oldBlobId: walrusBlobId, newBlobId: null, status: 'pending' });
    } else {
      console.log(`     ⚠️  HTTP ${res.status} — treating as unverified → marked for re-store`);
      toRestore.push(incident);
      results.push({ id, oldBlobId: walrusBlobId, newBlobId: null, status: 'pending' });
    }
  } catch (err) {
    console.log(`     ⚠️  Check failed (${err.message}) — marked for re-store`);
    toRestore.push(incident);
    results.push({ id, oldBlobId: walrusBlobId, newBlobId: null, status: 'pending' });
  }

  await sleep(500); // rate-limit delay between HEAD checks
}

console.log(`\n📊 ${incidents.length - toRestore.length} already verified, ${toRestore.length} need re-store\n`);

// ─── Step 4: Re-store incidents with missing/fake blobs ──────────────────────
if (toRestore.length > 0) {
  console.log('📤 Re-storing incidents on Walrus…\n');

  for (const incident of toRestore) {
    const { id } = incident;
    const resultEntry = results.find((r) => r.id === id);

    const payload = {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      description: incident.description,
      location: {
        lat: incident.location?.lat ?? 0,
        lng: incident.location?.lng ?? 0,
        address: incident.location?.address ?? 'Unknown',
      },
      timestamp: incident.timestamp,
      reportedBy: incident.reportedBy || 'community',
      status: incident.status || 'active',
    };

    console.log(`  📤 Storing: [${id}] "${incident.description?.slice(0, 50)}…"`);

    try {
      const res = await fetchWithTimeout(
        `${PROXY_URL}/api/store`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        120000 // 2 min — Walrus can be slow
      );

      if (res.ok) {
        const data = await res.json();
        if (data.blobId) {
          console.log(`     ✅ STORED → blobId: ${data.blobId}`);
          resultEntry.newBlobId = data.blobId;
          resultEntry.status = 'stored';
        } else {
          const msg = 'No blobId in response';
          console.log(`     ❌ FAILED — ${msg}`);
          console.log(`        Response: ${JSON.stringify(data).slice(0, 200)}`);
          resultEntry.status = 'failed';
          resultEntry.error = msg;
        }
      } else {
        let body = '';
        try { body = await res.text(); } catch {}
        const msg = `HTTP ${res.status}: ${body.slice(0, 100)}`;
        console.log(`     ❌ FAILED — ${msg}`);
        resultEntry.status = 'failed';
        resultEntry.error = msg;
      }
    } catch (err) {
      const msg = err.isTimeout ? 'TIMEOUT — exceeded 120s' : err.message;
      console.log(`     ❌ ${err.isTimeout ? 'TIMEOUT' : 'ERROR'} — ${msg}`);
      resultEntry.status = 'failed';
      resultEntry.error = msg;
    }

    // 3-second delay between stores — Walrus needs breathing room
    console.log('     ⏳ Waiting 3s before next store…');
    await sleep(3000);
  }
}

// ─── Step 5: Output results ───────────────────────────────────────────────────
const alreadyVerified = results.filter((r) => r.status === 'skipped').length;
const successfullyStored = results.filter((r) => r.status === 'stored').length;
const failed = results.filter((r) => r.status === 'failed').length;

console.log('\n=====================================');
console.log('MIGRATION COMPLETE');
console.log('=====================================');
console.log(`✅ Already verified:      ${alreadyVerified}`);
console.log(`✅ Successfully stored:   ${successfullyStored}`);
console.log(`❌ Failed:               ${failed}`);
console.log('=====================================\n');

if (failed > 0) {
  console.log('❌ Failed incidents (add to BLOCKLIST_IDS or re-run):');
  results.filter((r) => r.status === 'failed').forEach((r) => {
    console.log(`   • ${r.id} — ${r.error}`);
  });
  console.log('');
}

// Save blob-mapping.json
const mapping = {
  timestamp: new Date().toISOString(),
  proxyUrl: PROXY_URL,
  summary: { alreadyVerified, successfullyStored, failed },
  results,
};

const outPath = resolve(__dirname, 'blob-mapping.json');
try {
  mkdirSync(__dirname, { recursive: true });
  writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
  console.log(`💾 Saved full mapping to: ${outPath}`);
} catch (e) {
  console.error('⚠️  Could not save blob-mapping.json:', e.message);
}

console.log('\n✅ Done. Share blob-mapping.json to verify before proceeding to Phase 2.\n');
