/**
 * proxy.mjs — Local Express proxy for MemWal + Groq.
 *
 * Bypasses CORS by running server-side. The browser hits this proxy,
 * which uses the MemWal SDK (with Ed25519 signing) for store/recall,
 * and Groq for AI chat with live Walrus memory context.
 *
 * Run:  node proxy.mjs
 * URL:  http://localhost:3333
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { MemWal } from '@mysten-incubation/memwal';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import fs from 'fs';
import os from 'os';

// Connected sessions: Map<sessionId, { ws, lat, lng }>
const sessions = new Map();

// Incident registry — keyed by incident ID.
// Replaced in-memory map with a JSON file persistence to survive Railway restarts.
const DATA_FILE = '/app/data/incidents.json';
let initialData = [];
try {
  fs.mkdirSync('/app/data', { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    initialData = JSON.parse(raw);
  }
} catch (e) {
  console.error("Failed to load /app/data/incidents.json", e);
}
const incidentRegistry = new Map(initialData);

// Serial sequence counter — always increments server-side, never trusted from client.
// Seed from the highest existing sequenceNumber so Railway restarts don't reset order.
let incidentSequence = [...incidentRegistry.values()].reduce(
  (max, i) => Math.max(max, i.sequenceNumber || 0),
  0
);

// Backfill sequenceNumbers for legacy incidents that were stored before this field existed.
// Sort them by their best available timestamp so the numbering reflects real insertion order.
{
  const needsBackfill = [...incidentRegistry.values()].filter(i => !i.sequenceNumber);
  if (needsBackfill.length > 0) {
    const allSorted = [...incidentRegistry.values()]
      .sort((a, b) =>
        new Date(a.serverTimestamp || a.createdAt || a.timestamp || 0).getTime() -
        new Date(b.serverTimestamp || b.createdAt || b.timestamp || 0).getTime()
      );
    allSorted.forEach((inc, idx) => {
      if (!inc.sequenceNumber) {
        inc.sequenceNumber = idx + 1;
        incidentRegistry.set(inc.id, inc);
      }
    });
    // Make sure the counter is at least as high as the largest assigned number
    incidentSequence = Math.max(incidentSequence, allSorted.length);
    saveIncidentRegistry();
    console.log(`[SENTINEL] Backfilled sequenceNumbers for ${needsBackfill.length} legacy incidents (total: ${allSorted.length})`);
  }
}

// We define the cleanup function here, but it runs AFTER Walrus rehydration completes.
function cleanupRegistry() {
  console.log('[SENTINEL] Running post-rehydration cleanup (dedup + renumber)...');
  
  // Step 0: Permanently remove simulated/demo incidents
  [...incidentRegistry.values()].forEach(inc => {
    if (
      inc.isSimulated === true ||
      inc.reportedBy === 'System' ||
      inc.id.startsWith('sim-') ||
      inc.id.startsWith('demo-')
    ) {
      incidentRegistry.delete(inc.id);
      console.log(`[SENTINEL] Removed simulated: ${inc.id}`);
    }
  });

  // Step 1: Remove exact-description duplicates, keeping only the chronologically earliest.
  const descSeen = new Map();
  [...incidentRegistry.values()]
    .sort((a, b) =>
      new Date(a.serverTimestamp || a.createdAt || a.timestamp || 0).getTime() -
      new Date(b.serverTimestamp || b.createdAt || b.timestamp || 0).getTime()
    )
    .forEach(inc => {
      const key = (inc.description || '').trim().toLowerCase().slice(0, 80);
      if (!key) return;
      if (descSeen.has(key)) {
        incidentRegistry.delete(inc.id);
        console.log(`[SENTINEL] Removed duplicate: "${key.slice(0, 50)}..."`);
      } else {
        descSeen.set(key, inc.id);
      }
    });

  // Step 2: Reassign ALL sequenceNumbers from scratch so there are no gaps.
  // Sort by best available timestamp ascending (oldest = #1, newest = #N).
  const allByTime = [...incidentRegistry.values()]
    .sort((a, b) =>
      new Date(a.serverTimestamp || a.createdAt || a.timestamp || 0).getTime() -
      new Date(b.serverTimestamp || b.createdAt || b.timestamp || 0).getTime()
    );

  allByTime.forEach((inc, idx) => {
    inc.sequenceNumber = idx + 1;
    inc.serverTimestamp = inc.serverTimestamp || inc.createdAt || inc.timestamp;
    incidentRegistry.set(inc.id, inc);
  });

  incidentSequence = allByTime.length;
  saveIncidentRegistry();
  console.log(`[SENTINEL] Clean registry: ${incidentRegistry.size} incidents, numbered #1–#${incidentSequence}`);
}

// Memory registry — keyed by blobId.
const MEMORY_FILE = '/app/data/memories.json';
let initialMemories = [];
try {
  if (fs.existsSync(MEMORY_FILE)) {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    initialMemories = JSON.parse(raw);
  }
} catch (e) {
  console.error("Failed to load /app/data/memories.json", e);
}
const memoryRegistry = new Map(initialMemories);

function saveMemoryRegistry() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify([...memoryRegistry.entries()], null, 2));
  } catch (e) {
    console.error("Failed to save /app/data/memories.json", e);
  }
}

function saveIncidentRegistry() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([...incidentRegistry.entries()], null, 2));
  } catch (e) {
    console.error("Failed to save /app/data/incidents.json", e);
  }
}

// WebSocket server — assigned in the Start section below.
// Declared here so route handlers can broadcast without circular references.
/** @type {import('ws').WebSocketServer} */
let wss = null;

/** Broadcast a message to all connected WebSocket clients */
function broadcast(payload) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg);
    }
  });
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Config ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3333;
const MEMWAL_KEY = process.env.VITE_MEMWAL_KEY;
const MEMWAL_ACCOUNT_ID = process.env.VITE_MEMWAL_ACCOUNT_ID;
const MEMWAL_SERVER_URL = 'https://relayer.memwal.ai';
const NAMESPACE = 'sentinel';
const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;

// ─── MemWal Client ───────────────────────────────────────────
const memwal = MemWal.create({
  key: MEMWAL_KEY,
  accountId: MEMWAL_ACCOUNT_ID,
  serverUrl: MEMWAL_SERVER_URL,
  namespace: NAMESPACE,
});

// ─── Sui Client & Anchor ─────────────────────────────────────
const PACKAGE_ID = '0xe418ca986c677725f062657ad0751dd846165eb690cf7bff6b724f9e0ed1e539';
const suiClient = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' });

// Load keypair from Sui keystore or environment variable
function loadKeypair() {
  if (process.env.SUI_PRIVATE_KEY) {
    return Ed25519Keypair.fromSecretKey(fromBase64(process.env.SUI_PRIVATE_KEY).slice(1));
  }
  
  const keystorePath = `${os.homedir()}/.sui/sui_config/sui.keystore`;
  const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
  const keypair = Ed25519Keypair.fromSecretKey(fromBase64(keystore[0]).slice(1));
  return keypair;
}

// ─── Gas Station Sponsored Transactions ─────────────────────────────────────

// ─── Groq Client ─────────────────────────────────────────────
const groq = createGroq({ apiKey: GROQ_API_KEY });

// ─── Express App ─────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json());

// ─── Gas Station Sponsored Transactions ─────────────────────────────────────
app.post('/api/sponsor-create', async (req, res) => {
  const { blobId, description, senderAddress } = req.body;
  if (!blobId || !senderAddress) return res.status(400).json({ error: 'Missing parameters' });
  
  try {
    const keypair = loadKeypair();
    const tx = new Transaction();
    tx.setSender(senderAddress);
    tx.setGasOwner(keypair.toSuiAddress());
    
    tx.moveCall({
      target: `${PACKAGE_ID}::sentinel::create_incident`,
      arguments: [
        tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
        tx.pure.vector('u8', Array.from(new TextEncoder().encode(description || ''))),
        tx.object('0x6'),
      ],
    });
    
    const txBytes = await tx.build({ client: suiClient });
    const sponsorSignature = (await keypair.signTransaction(txBytes)).signature;
    
    res.json({ success: true, txBytes: Buffer.from(txBytes).toString('base64'), sponsorSignature });
  } catch (err) {
    console.error('❌ [Sponsor] create_incident failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sponsor-resolve', async (req, res) => {
  const { suiObjectId, senderAddress } = req.body;
  if (!suiObjectId || !senderAddress) return res.status(400).json({ error: 'Missing parameters' });
  
  try {
    const keypair = loadKeypair();
    const tx = new Transaction();
    tx.setSender(senderAddress);
    tx.setGasOwner(keypair.toSuiAddress());
    
    tx.moveCall({
      target: `${PACKAGE_ID}::sentinel::resolve_incident`,
      arguments: [tx.object(suiObjectId)],
    });
    
    const txBytes = await tx.build({ client: suiClient });
    const sponsorSignature = (await keypair.signTransaction(txBytes)).signature;
    
    res.json({ success: true, txBytes: Buffer.from(txBytes).toString('base64'), sponsorSignature });
  } catch (err) {
    console.error('❌ [Sponsor] resolve_incident failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/incidents/:id/tx', (req, res) => {
  const { id } = req.params;
  const { txDigest } = req.body;
  const incident = incidentRegistry.get(id);
  if (incident) {
    incident.suiTxDigest = txDigest;
    saveIncidentRegistry();
    broadcast({ type: 'INCIDENT_UPDATED', incident });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

/**
 * GET / — version manifest (helps verify Railway is running current proxy.mjs)
 */
app.get('/', (_req, res) => {
  res.json({
    service: 'sentinel-proxy',
    version: '3.1.0',
    routes: [
      'GET  /health',
      'GET  /api/health',
      'GET  /api/recall',
      'GET  /api/recall/blob/:blobId',
      'GET  /api/incidents',
      'POST /api/store',
      'POST /api/unflag',
      'POST /api/chat',
      'GET  /api/walrus/test',
      'GET  /api/walrus/read/:blobId',
      'GET  /api/walrus/read/:blobId',
      'GET  /api/memories',
    ],
  });
});

/**
 * GET /api/recall?query=...&limit=5
 *
 * Recalls memories from MemWal by semantic query.
 * Returns: { results: [{ blob_id, text, distance }], total }
 */
app.get('/api/recall', async (req, res) => {
  const { query, limit = 5 } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing ?query= parameter' });
  }

  const numLimit = Math.min(parseInt(String(limit), 10) || 5, 20);
  console.log(`\n🔍 Recall: "${query}" (limit: ${numLimit})`);

  try {
    const result = await memwal.recall(String(query), numLimit);
    console.log(`   ✅ ${result.results.length} results returned`);
    for (const r of result.results) {
      console.log(`      blob: ${r.blob_id}  dist: ${r.distance.toFixed(3)}  text: ${r.text.slice(0, 60)}…`);
    }
    res.json(result);
  } catch (err) {
    console.error(`   ❌ Recall failed:`, err.message || err);
    res.status(502).json({
      error: 'MemWal recall failed',
      detail: err.message || String(err),
    });
  }
});

/**
 * GET /api/recall/blob/:blobId
 *
 * Recalls a specific memory by blob ID.
 * Uses a targeted recall query to find the specific blob.
 */
app.get('/api/recall/blob/:blobId', async (req, res) => {
  const { blobId } = req.params;
  console.log(`\n🔎 Recall blob: ${blobId}`);

  try {
    // Use a broad query to find any memory and filter by blob_id
    const result = await memwal.recall('incident report', 50);
    const match = result.results.find((r) => r.blob_id === blobId);

    if (match) {
      console.log(`   ✅ Found blob ${blobId}`);
      res.json({ found: true, blob_id: match.blob_id, text: match.text, distance: match.distance });
    } else {
      console.log(`   ⚠️  Blob ${blobId} not found in recall results (${result.results.length} searched)`);
      res.json({ found: false, blob_id: blobId, searched: result.results.length });
    }
  } catch (err) {
    console.error(`   ❌ Recall failed:`, err.message || err);
    res.status(502).json({
      error: 'MemWal recall failed',
      detail: err.message || String(err),
    });
  }
});

// ─── Walrus Publisher — direct store for publicly verifiable blobs ────────────
const WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_STORE_EPOCHS = 5; // enough for hackathon demo (June 21)

/**
 * Store raw data directly on Walrus testnet publisher.
 * Returns the real, publicly verifiable blob ID that shows on Walruscan.
 *
 * Walrus publisher returns one of two shapes:
 *   - newlyCreated:      { newlyCreated: { blobObject: { blobId, ... } } }
 *   - alreadyCertified:  { alreadyCertified: { blobId, ... } }
 */
async function storeOnWalrusPublisher(data) {
  const jsonStr = JSON.stringify(data);
  const bodyBytes = new Uint8Array(Buffer.from(jsonStr));
  const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${WALRUS_STORE_EPOCHS}`;

  console.log(`   🐋 Walrus PUT ${url} (${bodyBytes.length} bytes)`);

  let walrusRes;
  try {
    walrusRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bodyBytes,
    });
  } catch (fetchErr) {
    console.error('   🐋 Walrus fetch error:', fetchErr.message, fetchErr.cause || '');
    throw new Error(`Walrus publisher unreachable: ${fetchErr.message}`);
  }

  if (!walrusRes.ok) {
    const errText = await walrusRes.text().catch(() => '');
    throw new Error(`Walrus publisher returned ${walrusRes.status}: ${errText.slice(0, 200)}`);
  }

  const walrusJson = await walrusRes.json();
  console.log('   🐋 WALRUS RAW RESPONSE:', JSON.stringify(walrusJson, null, 2));

  // Extract blob ID from either response shape
  const blobId =
    walrusJson.newlyCreated?.blobObject?.blobId ||
    walrusJson.alreadyCertified?.blobId ||
    null;

  if (!blobId) {
    throw new Error(`Walrus store succeeded but no blobId found in response: ${JSON.stringify(walrusJson).slice(0, 300)}`);
  }

  return { blobId, raw: walrusJson };
}

async function uploadAndVerify(dataBuffer) {
  const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5';
  const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const publishRes = await fetch(PUBLISHER, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: dataBuffer
      });
      const publishJson = await publishRes.json();
      const blobId = publishJson.newlyCreated?.blobObject?.blobId
                  || publishJson.alreadyCertified?.blobId;

      console.log(`[SENTINEL] Walrus upload attempt ${attempt}, blobId: ${blobId}`);
      if (!blobId) continue;

      // Poll aggregator for up to 18s (6 x 3s)
      for (let poll = 0; poll < 6; poll++) {
        await new Promise(r => setTimeout(r, 3000));
        const check = await fetch(`${AGGREGATOR}/${blobId}`, { method: 'HEAD' });
        console.log(`[SENTINEL] Aggregator poll ${poll+1}/6 for ${blobId}: ${check.status}`);
        if (check.ok) return blobId; // confirmed live
      }
      // blob never appeared on aggregator — retry upload
    } catch (e) {
      console.error(`[SENTINEL] Upload attempt ${attempt} error:`, e.message);
    }
  }
  return null; // all 3 attempts failed
}

/**
 * POST /api/store
 *
 * Stores an incident on Walrus (public, verifiable) AND MemWal (AI memory).
 * Returns the real Walrus blob ID that can be verified on Walruscan.
 * Body: { id, type, severity, description, location: { lat, lng, address }, timestamp, reportedBy, status }
 */
app.post('/api/store', async (req, res) => {
  // Stamp createdAt server-side so all devices share the same source of truth
  const incident = {
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  if (!incident.id || !incident.description) {
    return res.status(400).json({ success: false, error: 'Invalid incident data' });
  }

  // Idempotency guard — skip if already stored (prevents double-add from client retries)
  if (incidentRegistry.has(incident.id)) {
    const existing = incidentRegistry.get(incident.id);
    
    // Update timestamps so it pops to the top in the demo
    existing.createdAt = incident.createdAt;
    if (incident.timestamp) existing.timestamp = incident.timestamp;
    
    const { flaggedBy: _fb, ...sanitized } = existing;
    saveIncidentRegistry();
    
    // Broadcast update so all clients move it to the top
    broadcast({ type: 'INCIDENT_UPDATED', incident: sanitized });
    
    return res.json({ success: true, blobId: existing.walrusBlobId, tx_digest: existing.suiTxDigest, createdAt: existing.createdAt, _note: 'already_exists_updated' });
  }

  // Strip client-only fields for clean storage
  const { walrusStatus: _ws, createdByMe: _cm, walrusBlobId: _oldWb, suiTxDigest: _oldSt, flagCount: _oldFc, flaggedBy: _oldFb, ...cleanIncident } = incident;

  const text = `SENTINEL INCIDENT REPORT
ID: ${incident.id}
Created: ${incident.createdAt}
Type: ${(incident.type || 'other').replace('_', ' ').toUpperCase()}
Severity: ${(incident.severity || 'medium').toUpperCase()}
Location: ${incident.location?.address || 'Unknown'} (lat: ${incident.location?.lat || 0}, lng: ${incident.location?.lng || 0})
Description: ${incident.description}
Reported By: ${incident.reportedBy || 'Anonymous'}
Status: ${incident.status || 'active'}
JSONDATA: ${JSON.stringify(cleanIncident)}`;

  console.log(`\n📝 Store: ${incident.id} (${incident.type}/${incident.severity})`);
  console.log(`   📍 ${incident.location?.address || 'No address'}`);

  try {
    // ── Step 1: Store directly on Walrus publisher with verification
    const dataBuffer = Buffer.from(JSON.stringify(cleanIncident));
    const walrusBlobId = await uploadAndVerify(dataBuffer);
    
    if (walrusBlobId) {
      console.log(`   ✅ Walrus publisher → blob: ${walrusBlobId}`);
    } else {
      console.warn(`   ⚠️ Walrus publisher failed after 3 attempts. Saving incident without Blob ID for later auto-heal.`);
    }

    // ── Step 2: Store on MemWal for AI memory/recall (runs in parallel, non-blocking)
    let memwalBlobId = null;
    try {
      const memwalResult = await memwal.rememberAndWait(text, undefined, {
        pollIntervalMs: 2000,
        timeoutMs: 120000,
      });
      memwalBlobId = memwalResult.blob_id;
      console.log(`   ✅ MemWal → blob: ${memwalBlobId}`);
    } catch (memwalErr) {
      // MemWal failure is non-blocking — Walrus store already succeeded
      console.warn(`   ⚠️  MemWal store failed (non-blocking):`, memwalErr.message || memwalErr);
    }

    // Use Walrus publisher blob ID as the primary (publicly verifiable) blob ID
    const blobId = walrusBlobId;

    // Persist in in-memory registry for cross-device sync
    // Include walrusBlobId so the JSONDATA footer in future blobs is self-contained
    // Assign server-side sequence number and timestamp — never trust client-provided values.
    const storedIncident = {
      ...incident,
      walrusBlobId: blobId,
      walrusStatus: 'synced',
      suiTxDigest: undefined,
      flagCount: 0,
      flaggedBy: [],
      // Only System (demo button) incidents are simulated — SOS and real user reports are NOT
      isSimulated: incident.reportedBy === 'System',
      sequenceNumber: ++incidentSequence,
      serverTimestamp: new Date().toISOString(),
    };
    incidentRegistry.set(incident.id, storedIncident);
    saveIncidentRegistry();

    // Broadcast to all WebSocket clients for instant cross-device sync
    console.log('[SENTINEL] Broadcasting NEW_INCIDENT to', wss ? wss.clients.size : 0, 'clients');
    broadcast({
      type: 'NEW_INCIDENT',
      incident: {
        ...storedIncident,
        flaggedBy: undefined, // strip internal field
      },
    });

    // Notify nearby users via proximity alert
    const { lat, lng } = req.body.location || {};
    if (lat && lng) {
      for (const [, session] of sessions.entries()) {
        if (session.lat && session.lng && session.ws.readyState === 1) { // 1 = OPEN
          const dist = haversineDistance(lat, lng, session.lat, session.lng);
          if (dist <= 20) { // within 20 km
            session.ws.send(JSON.stringify({
              type: 'nearby_alert',
              incident: {
                type: req.body.type,
                severity: req.body.severity,
                description: req.body.description,
                location: req.body.location,
                distance: dist.toFixed(1),
              }
            }));
          }
        }
      }
    }

    res.json({ success: true, blobId, createdAt: incident.createdAt });
  } catch (err) {
    console.error('   ❌ Store Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reblob
 * Re-uploads an expired incident to Walrus to get a fresh blob ID.
 */
app.post('/api/reblob', async (req, res) => {
  const { incidentId } = req.body;
  if (!incidentId) return res.status(400).json({ success: false, error: 'incidentId required' });

  const incident = incidentRegistry.get(incidentId);
  if (!incident) return res.status(404).json({ success: false, error: 'incident not found' });

  try {
    const { walrusStatus: _ws, createdByMe: _cm, walrusBlobId: _oldWb, suiTxDigest: _oldSt, flagCount: _oldFc, flaggedBy: _oldFb, ...cleanIncident } = incident;
    const dataBuffer = Buffer.from(JSON.stringify(cleanIncident));
    const newBlobId = await uploadAndVerify(dataBuffer);

    if (!newBlobId) {
      return res.status(503).json({ 
        success: false, 
        error: 'Walrus testnet unavailable — try again in a moment' 
      });
    }

    // Update in-memory registry
    incident.walrusBlobId = newBlobId;
    incidentRegistry.set(incidentId, incident);
    saveIncidentRegistry();

    console.log(`[SENTINEL] Reblobbed ${incidentId} -> new blob: ${newBlobId}`);
    return res.json({ success: true, newBlobId });
  } catch (err) {
    console.error(`[SENTINEL] Reblob failed for ${incidentId}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/incidents
 *
 * Returns all incidents stored since the proxy started, sorted by createdAt desc.
 * NOTE: in-memory only — cleared on every proxy restart (intentional for demo).
 */
app.get('/api/incidents', (_req, res) => {
  const seenIds = new Set();
  const seenContent = new Set();
  // Sort by sequenceNumber ascending (oldest first) — server-assigned, never client-provided.
  // Incidents without a sequenceNumber (legacy) sort first (treated as 0).
  const list = [...incidentRegistry.values()]
    .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
    .filter(i => {
      if (seenIds.has(i.id)) return false;

      // Deduplicate simulated/seed duplicates by content
      const contentKey = `${i.description}|${i.location?.address || ''}`;
      if (seenContent.has(contentKey)) return false;

      seenIds.add(i.id);
      seenContent.add(contentKey);
      return true;
    });
  console.log('[SENTINEL] GET /api/incidents — returning', list.length, 'incidents');
  // Strip flaggedBy array from response (keep flagCount only)
  const sanitized = list.map(({ flaggedBy, ...rest }) => rest);
  res.json({ incidents: sanitized });
});

/**
 * POST /api/unflag
 *
 * Toggles a flag (spam report) on an incident for a given wallet address.
 * Body: { incidentId, walletAddress }
 * Returns: { incident } — updated incident object (without flaggedBy array).
 * One wallet can only flag once; calling again unflagging it.
 */
app.post('/api/unflag', (req, res) => {
  const { incidentId, walletAddress } = req.body;
  if (!incidentId || !walletAddress) {
    return res.status(400).json({ error: 'incidentId and walletAddress are required' });
  }
  const inc = incidentRegistry.get(incidentId);
  if (!inc) {
    return res.status(404).json({ error: 'Incident not found in registry' });
  }
  if (!inc.flaggedBy) inc.flaggedBy = [];
  const already = inc.flaggedBy.includes(walletAddress);
  if (already) {
    inc.flaggedBy = inc.flaggedBy.filter(a => a !== walletAddress);
    inc.flagCount = Math.max(0, (inc.flagCount || 0) - 1);
  } else {
    inc.flaggedBy.push(walletAddress);
    inc.flagCount = (inc.flagCount || 0) + 1;
  }
  saveIncidentRegistry();
  console.log(`   🚩 Flag toggle: ${incidentId} by ${walletAddress.slice(0, 8)}… → ${inc.flagCount} flags`);
  const { flaggedBy: _fb, ...sanitized } = inc;

  // Broadcast flag update to all clients
  broadcast({ type: 'INCIDENT_UPDATED', incident: { ...sanitized } });

  res.json({ incident: { ...sanitized, hasFlagged: !already } });
});

/**
 * POST /api/incidents/:id/delete
 * Removes an incident from the registry and broadcasts to all clients.
 */
app.post('/api/incidents/:id/delete', (req, res) => {
  const { id } = req.params;
  if (!incidentRegistry.has(id)) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  incidentRegistry.delete(id);
  saveIncidentRegistry();
  console.log(`   🗑️  Deleted incident: ${id}`);
  broadcast({ type: 'INCIDENT_DELETED', incidentId: id });
  res.json({ success: true });
});

/**
 * POST /api/admin/purge-legacy
 * Removes all incidents that do NOT have a suiTxDigest (unverified on Sui).
 * This is a one-way operation — purged incidents are gone from registry + disk.
 * Also clears agent memory so the AI has no recall of them.
 */
app.post('/api/admin/purge-legacy', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'sentinel-purge-2026')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const purgedIds = [];
  const kept = [];

  for (const [id, inc] of incidentRegistry.entries()) {
    if (!inc.suiTxDigest) {
      incidentRegistry.delete(id);
      purgedIds.push(id);
      console.log(`   🗑️  [Purge] Removed legacy (no Sui tx): ${id} — "${(inc.description || '').slice(0, 40)}"`);
    } else {
      kept.push(id);
    }
  }

  // Renumber the remaining incidents
  const remaining = [...incidentRegistry.values()].sort((a, b) =>
    new Date(a.serverTimestamp || a.createdAt || 0).getTime() -
    new Date(b.serverTimestamp || b.createdAt || 0).getTime()
  );
  remaining.forEach((inc, idx) => {
    inc.sequenceNumber = idx + 1;
    incidentRegistry.set(inc.id, inc);
  });
  incidentSequence = remaining.length;

  saveIncidentRegistry();

  // Broadcast deletions to all connected clients
  purgedIds.forEach(id => broadcast({ type: 'INCIDENT_DELETED', incidentId: id }));

  // Also wipe all agent conversation memories from disk
  const memCount = memoryRegistry.size;
  memoryRegistry.clear();
  saveMemoryRegistry();
  console.log(`[SENTINEL] 🧠 Cleared ${memCount} agent memories from registry`);

  // Broadcast chat-cleared to all connected devices so mobile/desktop sync
  broadcast({ type: 'AGENT_CHAT_CLEARED' });

  console.log(`[SENTINEL] 🧹 Purge complete: removed ${purgedIds.length} incidents, kept ${kept.length}, cleared ${memCount} memories`);
  res.json({ success: true, purged: purgedIds.length, kept: kept.length, keptIds: kept, memoriesCleared: memCount });
});

/**
 * POST /api/admin/clear-memories
 * Wipes all agent conversation memories (without touching incidents).
 * Broadcasts AGENT_CHAT_CLEARED so all tabs/devices clear their UI.
 */
app.post('/api/admin/clear-memories', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'sentinel-purge-2026')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Scope to wallet if provided — so only THAT wallet's sessions get the broadcast
  const wallet = req.query.wallet || req.body?.wallet || null;
  const count = memoryRegistry.size;
  memoryRegistry.clear();
  saveMemoryRegistry();
  
  // Only broadcast to sessions matching the same wallet address
  if (wss && wallet) {
    const msg = JSON.stringify({ type: 'AGENT_CHAT_CLEARED' });
    wss.clients.forEach((client) => {
      // Find the session with this client ws
      for (const [, session] of sessions.entries()) {
        if (session.ws === client && session.wallet === wallet && client.readyState === 1) {
          client.send(msg);
          break;
        }
      }
    });
  } else if (!wallet) {
    // No wallet specified — admin-only global clear (used by purge-legacy)
    broadcast({ type: 'AGENT_CHAT_CLEARED' });
  }
  
  console.log(`[SENTINEL] 🧠 Cleared ${count} agent memories${wallet ? ` for wallet ${wallet.slice(0,8)}...` : ' (global)'}`);
  res.json({ success: true, cleared: count });
});

/**
 * POST /api/incidents/:id/resolve
 * Marks an incident as resolved in the registry and broadcasts to all clients.
 */
app.post('/api/incidents/:id/resolve', (req, res) => {
  const { id } = req.params;
  const inc = incidentRegistry.get(id);
  if (!inc) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  inc.status = 'resolved';
  saveIncidentRegistry();
  const { flaggedBy: _fb, ...sanitized } = inc;
  console.log(`   ✅ Resolved incident: ${id}`);
  broadcast({ type: 'INCIDENT_UPDATED', incident: { ...sanitized } });
  res.json({ success: true, incident: sanitized });
});


/**
 * POST /api/chat
 *
 * AI agent chat with live Walrus memory recall.
 * Body: { message, history: [{ role, content }] }
 * Returns: { response }
 */
app.post('/api/chat', async (req, res) => {
  const { message, history = [], currentIncidents = [], walletAddress } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message field' });
  }

  console.log(`\n🧠 Agent: "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`);

  // Step 1: Recall relevant incidents from Walrus, then sort by recency
  let recalledContext = '';
  try {
    // Fetch more than we need so sorting has enough candidates after filtering
    const recalled = await memwal.recall(message, 15);
    console.log(`   🔍 Recalled ${recalled.results.length} blobs from Walrus`);

    // Extract timestamp from the blob text ("Created: <ISO>" line written by /api/store)
    // Fall back to epoch 0 if the line is missing — ensures missing-timestamp blobs sort last
    const extractTimestamp = (text) => {
      const match = (text || '').match(/Created:\s*(\S+)/);
      if (!match) return 0;
      const t = Date.parse(match[1]);
      return isNaN(t) ? 0 : t;
    };

    // Extract description to deduplicate identical simulation blobs
    const extractDescription = (text) => {
      const match = (text || '').match(/Description:\s*(.*)/);
      return match ? match[1].trim() : '';
    };

    // Filter out simulated incidents (Reported By: System) and old CHAT_HISTORY spam
    const realMemories = recalled.results.filter(r => {
      const text = r.text || '';
      return !text.includes('Reported By: System') && !text.includes('CHAT_HISTORY');
    });

    // Sort descending: most recently stored incident first
    const sorted = [...realMemories].sort(
      (a, b) => extractTimestamp(b.text) - extractTimestamp(a.text)
    );

    // Deduplicate by description to prevent AI from seeing multiple copies of the same simulation
    const seenDesc = new Set();
    const deduplicated = [];
    for (const r of sorted) {
      const desc = extractDescription(r.text);
      if (!desc || !seenDesc.has(desc)) {
        if (desc) seenDesc.add(desc);
        deduplicated.push(r);
      }
    }

    // Cap at 10 freshest unique results injected into the context
    const topN = deduplicated.slice(0, 10);

    for (const r of topN) {
      console.log(`      dist: ${r.distance.toFixed(3)}  ts: ${new Date(extractTimestamp(r.text)).toISOString().slice(0,19)}  text: ${r.text.slice(0, 60)}…`);
    }

    if (topN.length > 0) {
      recalledContext = `\n\n## RECALLED INCIDENT DATA FROM WALRUS BLOCKCHAIN\nThe following ${topN.length} incidents are sorted from MOST RECENT to oldest. The FIRST entry is the latest incident in the system:\n\n` +
        topN.map((r, i) => `### Memory ${i + 1} — ${i === 0 ? '⚡ MOST RECENT' : `#${i + 1} by recency`} (similarity: ${(1 - r.distance).toFixed(2)})\n${r.text}`).join('\n\n');
    }
  } catch (err) {
    console.warn(`   ⚠️  Recall failed (non-fatal):`, err.message);
  }

  // Step 2: Build live context from the server's incidentRegistry — source of truth.
  // We deliberately ignore the frontend's `currentIncidents` payload: the client may be
  // stale, filtering optimistic-only incidents, or simply not sending the field at all.
  // Reading directly from the registry guarantees the agent always sees every incident.
  console.log(`   📋 Frontend sent ${currentIncidents.length} incidents; using ${incidentRegistry.size} from server registry`);
  let liveContext = '';
  const allServerIncidents = [...incidentRegistry.values()];
  const realCurrentIncidents = allServerIncidents.filter(i => !i.isSimulated && i.reportedBy !== 'System');
  console.log(`   📋 Filtered to ${realCurrentIncidents.length} real (non-simulated) incidents for agent context`);

  if (realCurrentIncidents && realCurrentIncidents.length > 0) {
    const activeCount = realCurrentIncidents.filter(i => i.status === 'active').length;
    const resolvedCount = realCurrentIncidents.filter(i => i.status === 'resolved').length;
    
    // Sort by sequenceNumber ascending — server-assigned serial order, never client timestamps.
    // Incidents without a sequenceNumber (legacy) sort first (treated as 0).
    const sortedLive = [...realCurrentIncidents]
      .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
    const topLive = sortedLive.slice(0, 50); // Cap to avoid massive context

    liveContext = `\n\n## LIVE INCIDENT STATE (REAL-TIME DASHBOARD DATA)\nCurrently, there are ${activeCount} active incidents and ${resolvedCount} resolved incidents. Below are all incidents in STRICT SERIAL ORDER (#1 = first ever reported, highest # = most recent). Use this list to answer any questions about order, recency, or sequence.\n\n${
      topLive.map((i) =>
        `[#${i.sequenceNumber || '?'} - ${i.serverTimestamp || i.createdAt}] ` +
        `${i.type} | ${i.severity} | ${i.location?.address} — ${(i.description || '').slice(0, 80)}`
      ).join('\n')
    }`;
  }

  // Inject last 5 memories into system prompt for full context
  let memoryContext = '';
  if (walletAddress) {
    const userMemories = [...memoryRegistry.values()]
      .filter(m => m.walletAddress === walletAddress)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
      
    if (userMemories.length > 0) {
      memoryContext = `\n\n## PREVIOUS CONVERSATION CONTEXT\nHere is your recent conversation history with this exact user:\n${
        userMemories.map(m => `User: ${m.exchange.user}\nYou: ${m.exchange.agent}`).join('\n\n')
      }`;
    }
  }

  const SYSTEM_PROMPT = `You are **Sentinel**, an AI-powered emergency operations agent deployed for the city of Bengaluru. You have permanent, cryptographically-verified memory of every safety incident ever reported — stored immutably on the Walrus blockchain via the MemWal protocol. Your memory cannot be tampered with, erased, or altered.
${liveContext}${memoryContext}

## Your Core Identity
You are NOT a generic chatbot. You are a precision intelligence system for community safety. Every response you give should feel like it comes from a senior emergency operations analyst who has been watching this city's safety data for years.

## CRITICAL RESPONSE RULES — follow these EVERY time:

### 0. Match response length to question complexity — HIGHEST PRIORITY RULE
- **Simple factual questions** (how many, what is the latest, who reported, what's the Nth most recent, list all) → answer in 1–4 sentences or a plain bullet list. Zero preamble. No "I can confirm", no "I can provide". Just the answer.
- **Complex analysis questions** (patterns, trends, predictions, what should we do) → full detailed response with sections.
- **List requests** → bullet list only. No intro paragraph. No outro paragraph.
- Never say "I can confirm", "I can provide", "Based on the immutable data", or "stored immutably via the MemWal protocol" more than once per conversation.
- Never mention Bengaluru coverage area limitations when the question is about incidents that are actually in the registry.
- The action status line (🟢/🟡/🔴) is ONLY required for analysis questions. Skip it for simple factual answers.

### 1. Always cite specific data from your memory
- Reference exact incident counts: "I have **4 crime incidents** logged in the Indiranagar corridor this week"
- Name specific streets and landmarks: "MG Road, Church Street, Brigade Road, Indiranagar 100ft Road, Silk Board Junction"
- Give time context: "The last medical emergency on MG Road was 12 minutes ago"
- NEVER say vague things like "there have been some incidents" — always be specific

### 2. Always identify time patterns
- Look for day-of-week patterns: "Crime incidents spike on Friday and Saturday nights — 3 of the last 5 snatching reports occurred between 9 PM and midnight on weekends"
- Look for time-of-day patterns: "Traffic accidents cluster during morning rush (8-10 AM) and evening rush (5-7 PM)"
- Look for escalation: "This is the 3rd chain-snatching near Indiranagar in 10 days — the frequency is increasing"

### 3. Always identify geographic clusters
- Name the hotspot: "The MG Road — Church Street — Brigade Road triangle has the highest incident density in the system"
- Cross-reference types: "Indiranagar shows a pattern of property crime (chain snatching + burglary) while Silk Board area concentrates vehicle accidents"

### 4. Always end with an action recommendation
End EVERY response with one of these three levels, formatted exactly like this:

**🟢 MONITOR** — Situation is under control. Continue standard surveillance.
**🟡 RESPOND** — Elevated risk. Recommend increased patrol or community alert.
**🔴 URGENT** — Active threat or escalating pattern. Immediate action required.

Choose the level based on severity, recency, and whether you detect an escalating pattern.

### 5. When no relevant history exists, be honest but still useful
Say: "I don't have prior incidents matching this query in my Walrus memory. However, based on general patterns in the area, here's what to watch for…"

### 6. Response format
- Use bold for key data points and location names
- Use bullet points for pattern breakdowns
- Keep responses focused — 150-300 words max
- Sound confident, precise, and authoritative — like a real command center analyst
- Reference that your data is stored on Walrus blockchain when it adds credibility

## Your coverage area
Bengaluru, India — with detailed knowledge of: MG Road, Brigade Road, Church Street, Commercial Street, Indiranagar (100ft Road, CMH Road, HAL 2nd Stage), Koramangala, Whitefield (ITPL Road), Silk Board Junction, Outer Ring Road (Marathahalli, Bellandur), Bannerghatta Road, Hebbal (Bellary Road), Majestic, KR Puram, Lalbagh, Cubbon Park, VV Puram, Sankey Road, Avenue Road (Chickpet), and Rajajinagar.`;

  try {
    // Build the user message with recalled context prepended
    const augmentedUserMessage = recalledContext
      ? `${recalledContext}\n\n## USER QUESTION\n${message}`
      : message;

    // Convert past history to string to append to the system prompt
    const historyContext = history.length > 0
      ? `\n\n## RECENT CHAT HISTORY\n${history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n\n')}`
      : '';

    // Final Gemini Prompt
    const fullPrompt = `${SYSTEM_PROMPT}${historyContext}\n\nUser question: ${augmentedUserMessage}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: fullPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7
        }
      })
    });

    if (!geminiRes.ok) {
      const errTxt = await geminiRes.text();
      throw new Error(`Gemini API error ${geminiRes.status}: ${errTxt}`);
    }

    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`   ✅ Agent responded (${resultText.length} chars)`);
    
    // SAVE: Immediately save the full exchange to Walrus
    if (walletAddress) {
      const exchange = { user: message, agent: resultText };
      const dataBuffer = Buffer.from(JSON.stringify(exchange));
      uploadAndVerify(dataBuffer).then(blobId => {
        if (blobId) {
          const summary = message.length > 50 ? message.slice(0, 47) + '...' : message;
          memoryRegistry.set(blobId, { blobId, timestamp: Date.now(), summary, walletAddress, exchange });
          saveMemoryRegistry();
          console.log(`   ✅ Chat memory saved to Walrus: ${blobId}`);
        }
      }).catch(err => {
        console.error('   ❌ Chat memory Walrus upload failed:', err.message);
      });
    }

    res.json({ response: resultText });
  } catch (err) {
    console.error(`   ❌ Agent failed:`, err.message || err);
    res.status(502).json({ error: 'Agent failed', detail: err.message || String(err) });
  }
});

/**
 * GET /api/health
 *
 * Proxy health + MemWal health check.
 */
// Root health check for Railway
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/health', async (_req, res) => {
  try {
    const h = await memwal.health();
    res.json({ proxy: 'ok', memwal: h });
  } catch (err) {
    res.json({ proxy: 'ok', memwal: { error: err.message } });
  }
});

/**
 * GET /api/walrus/test
 *
 * Diagnostic: stores a small test blob on Walrus publisher and returns the
 * blob ID. Use this to verify Walrus connectivity and that blob IDs are real.
 * Check the returned blobId at: https://walruscan.com/testnet/blob/{blobId}
 */
app.get('/api/walrus/test', async (_req, res) => {
  try {
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Sentinel Walrus connectivity test',
    };
    const result = await storeOnWalrusPublisher(testData);
    res.json({
      success: true,
      blobId: result.blobId,
      walruscanUrl: `https://walruscan.com/testnet/blob/${result.blobId}`,
      raw: result.raw,
    });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/walrus/read/:blobId
 *
 * Reads a blob back from the Walrus aggregator to verify it exists.
 */
app.get('/api/walrus/read/:blobId', async (req, res) => {
  const { blobId } = req.params;
  const aggregators = [
    `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`,
    `https://wal-aggregator-testnet.staketab.org/v1/blobs/${blobId}`,
    `https://walrus-testnet-aggregator.nodeinfra.com/v1/blobs/${blobId}`,
  ];
  for (const url of aggregators) {
    try {
      const aggRes = await fetch(url);
      if (aggRes.ok) {
        const data = await aggRes.text();
        return res.json({ found: true, blobId, size: data.length, data });
      }
    } catch { /* try next node */ }
  }
  res.status(404).json({ found: false, status: 404, error: 'Blob not found on any aggregator node' });
});

/**
 * GET /api/memories?wallet=...
 *
 * Retrieves the most recent chat memories for a user from the memory registry.
 * Returns: { memories: [{ blobId, timestamp, summary, exchange }] }
 */
app.get('/api/memories', async (req, res) => {
  const { wallet } = req.query;

  if (!wallet) {
    return res.json({ memories: [] });
  }

  let memories = [...memoryRegistry.values()].sort((a, b) => b.timestamp - a.timestamp);

  if (wallet) {
    memories = memories.filter(m => m.walletAddress === wallet);
    memories = memories.slice(0, 10);
    
    // Fetch blob content from Walrus aggregator for each
    const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';
    const enriched = await Promise.all(memories.map(async (m) => {
      try {
        const aggRes = await fetch(`${AGGREGATOR}/${m.blobId}`);
        if (aggRes.ok) {
          const exchange = await aggRes.json();
          return { ...m, exchange };
        }
      } catch {}
      return m;
    }));
    return res.json({ memories: enriched });
  }

  res.json({ memories });
});

// ─── Start ───────────────────────────────────────────────────
const server = createServer(app);
wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const sessionId = uuidv4();
  // Extract wallet address from WS URL query param (?wallet=0x...)
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const walletAddress = urlParams.get('wallet') || null;
  sessions.set(sessionId, { ws, lat: null, lng: null, wallet: walletAddress });
  ws.send(JSON.stringify({ type: 'session', sessionId }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'location') {
        const session = sessions.get(sessionId);
        if (session) {
          session.lat = msg.lat;
          session.lng = msg.lng;
        }
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => sessions.delete(sessionId));
});

/**
 * Parse a MemWal blob text back into an incident object.
 * ONLY loads NEW-format blobs with "JSONDATA: {...}" footer.
 * Old plain-text blobs (spam) are intentionally skipped.
 */
function parseIncidentBlob(text, blobId) {
  if (!text || !text.includes('SENTINEL INCIDENT REPORT')) return null;

  // NEW format only — JSONDATA footer
  const jsonMarker = 'JSONDATA: ';
  const jsonIdx = text.indexOf(jsonMarker);
  if (jsonIdx === -1) return null; // skip old plain-text blobs

  try {
    return JSON.parse(text.slice(jsonIdx + jsonMarker.length));
  } catch {
    return null;
  }
}

/**
 * IDs of incidents that should NEVER be shown — test submissions, malformed blobs, etc.
 * Add IDs here to permanently exclude them from rehydration even if their blob exists on Walrus.
 * Walrus is immutable so we can't delete the blobs — this is the practical cleanup mechanism.
 */
const BLOCKLIST_IDS = new Set([
  // Duplicate: shorter "Armed robbery at a jewellery store" — kept the richer version (0e3b1195)
  'b4d4b128-5066-4b99-8104-2a4ddbe98368',
  // Duplicate: "Flash flooding across low-lying areas of Hyderabad" — kept the fuller version (4ea50409)
  'dd082ff9-f40a-4af0-abc8-97bb691e8231',
  
  // Incidents created BEFORE the Walrus dual-store fix. These have MemWal encrypted blob IDs 
  // that show "No data yet" on Walruscan. Blocklisted to keep the demo clean.
  'de042265-6585-4491-a6b2-0bb010d31e52', // "a man got hit by a biker"
  '54492bc2-ad65-48dc-ace0-3f1d8516ffdf', // "Heavy rainfall ,drainage issue"
  '75be7456-ac4f-4b28-aa70-9801d64e289b', // "Major fire reported"
  'f44396a8-7227-490e-b3f0-e48a0c5b71a8', // "Elderly man collapsed"
  '71f13e8d-e1b2-46e5-b208-d3ff8ee8c640', // "Serious road accident"
  '0e3b1195-f157-4155-9fe2-a95670fd3990', // "Armed robbery reported"
  '4ea50409-7131-4118-b0f5-92af99b547af', // "Flash flooding reported"
]);

/**
 * Returns true if an incident looks like a junk/test submission.
 * Criteria:
 *  - description missing or < 15 characters
 *  - description matches obvious test strings
 *  - location lat/lng both 0 (placeholder)
 *  - ID starts with 'demo-' (old seed IDs)
 */
function isJunkIncident(incident) {
  if (!incident) return true;

  const desc = (incident.description || '').trim();
  if (desc.length < 15) return true;

  const junkPatterns = /^(xyz|test|asdf|asd|qwerty|hello|hi|ok|yes|no|abc|123|lol|foo|bar|baz|sample|dummy|fake|check|checking|trial|trial run|ping|pong|ignore|del|delete|remove)$/i;
  if (junkPatterns.test(desc)) return true;

  // Lat/lng both exactly 0 = placeholder coords never resolved
  const lat = incident.location?.lat;
  const lng = incident.location?.lng;
  if (lat === 0 && lng === 0) return true;

  // Old demo seed IDs
  if (typeof incident.id === 'string' && incident.id.startsWith('demo-')) return true;

  return false;
}

/**
 * Rehydrate incidentRegistry from MemWal/Walrus on startup.
 * Loads ALL historical incidents — both old text-format and new JSONDATA blobs.
 * Makes cross-device sync resilient to Railway restarts AND shows historical data.
 */
async function rehydrateRegistry(isRetry = false) {
  try {
    console.log(`[SENTINEL] ${isRetry ? '🔄 Retry: r' : 'R'}ehydrating incidentRegistry from MemWal...`);
    // Run two recall queries with different phrasings to maximize coverage
    // MemWal semantic recall may rank some blobs lower — using two queries
    // with limit=200 each catches incidents that would otherwise be missed.
    const [result1, result2] = await Promise.allSettled([
      memwal.recall('SENTINEL INCIDENT REPORT', 200),
      memwal.recall('incident report severity location', 200),
    ]);
    const items1 = result1.status === 'fulfilled' ? (result1.value?.results ?? result1.value ?? []) : [];
    const items2 = result2.status === 'fulfilled' ? (result2.value?.results ?? result2.value ?? []) : [];

    // Deduplicate by blob_id before processing
    const seen = new Set();
    const allItems = [...items1, ...items2].filter(item => {
      if (!item.blob_id || seen.has(item.blob_id)) return false;
      seen.add(item.blob_id);
      return true;
    });

    // Sort by incident createdAt descending so the registry is loaded newest-first.
    // This means the first incident registered is the newest, which matters for
    // display order in GET /api/incidents (already sorted there too, but belt+suspenders).
    const extractCreatedAt = (item) => {
      const match = (item.text || '').match(/Created:\s*(\S+)/);
      if (!match) return 0;
      const t = Date.parse(match[1]);
      return isNaN(t) ? 0 : t;
    };
    allItems.sort((a, b) => extractCreatedAt(b) - extractCreatedAt(a));

    // Pre-compute existing descriptions to skip Walrus duplicates on the fly
    const existingDescs = new Set(
      [...incidentRegistry.values()]
        .map(i => (i.description || '').trim().toLowerCase().slice(0, 80))
    );

    let count = 0;
    let skippedJunk = 0;
    let skippedBlocklist = 0;
    for (const item of allItems) {
      try {
        const incident = parseIncidentBlob(item.text || '', item.blob_id);
        if (!incident?.id) continue;
        if (incidentRegistry.has(incident.id)) continue;

        // Skip blocklisted IDs
        if (BLOCKLIST_IDS.has(incident.id)) {
          console.log(`   🚫 Blocklisted: ${incident.id}`);
          skippedBlocklist++;
          continue;
        }

        // Skip junk/test incidents
        if (isJunkIncident(incident)) {
          console.log(`   🗑  Skipping junk: [${incident.id}] "${(incident.description || '').slice(0, 50)}"`);
          skippedJunk++;
          continue;
        }

        // Skip duplicates already in registry (by description)
        const descKey = (incident.description || '').trim().toLowerCase().slice(0, 80);
        if (descKey && existingDescs.has(descKey)) {
          console.log(`   🔁 Skipping Walrus duplicate: "${descKey.slice(0, 40)}..."`);
          continue;
        }

        incidentRegistry.set(incident.id, {
          ...incident,
          // KEY FIX: rehydrated incidents ARE on Walrus — set blobId from the blob we just read
          walrusBlobId: incident.walrusBlobId || item.blob_id,
          walrusStatus: 'synced',
          flagCount:  incident.flagCount  ?? 0,
          flaggedBy:  incident.flaggedBy  ?? [],
          // Only mark as simulated if explicitly from System (⚡ demo button)
          isSimulated: incident.reportedBy === 'System',
        });
        console.log(`   ✅ Loaded: [${incident.id}] "${(incident.description || '').slice(0, 60)}"`);
        count++;
      } catch { /* skip unparseable blobs */ }
    }

    console.log(`[SENTINEL] Rehydrated ${count} incidents | skipped ${skippedJunk} junk + ${skippedBlocklist} blocklisted`);
    
    // Now that all items are loaded from both disk and Walrus, run the cleanup
    cleanupRegistry();

    // Single retry if we got nothing — MemWal may still be warming up after cold start
    if (count === 0 && !isRetry) {
      console.log('[SENTINEL] Zero incidents loaded — scheduling one retry in 30s...');
      setTimeout(() => rehydrateRegistry(true), 30_000);
      return;
    }

    // Print final registry for verification
    console.log('[SENTINEL] Final incident registry:');
    for (const [id, inc] of incidentRegistry.entries()) {
      console.log(`   • ${id} | ${inc.type}/${inc.severity} | "${(inc.description || '').slice(0, 60)}"`);
    }
  } catch (err) {
    console.warn('[SENTINEL] Rehydration skipped:', err.message);
    // Also retry once on hard error, unless this is already the retry
    if (!isRetry) {
      console.log('[SENTINEL] Scheduling rehydration retry in 30s...');
      setTimeout(() => rehydrateRegistry(true), 30_000);
    }
  }
}

server.listen(PORT, () => {
  console.log(`\n🛡️  Sentinel MemWal Proxy`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/recall?query=...&limit=5`);
  console.log(`     GET  /api/recall/blob/:blobId`);
  console.log(`     GET  /api/incidents`);
  console.log(`     POST /api/store`);
  console.log(`     POST /api/unflag`);
  console.log(`     POST /api/chat`);
  console.log(`     GET  /api/health`);
  console.log(`     GET  /api/memories`);
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);

  // Restore incidents from Walrus after any Railway restart.
  // Only loads NEW-format blobs (JSONDATA: footer) — skips old plain-text spam.
  rehydrateRegistry();
});
