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

// In-memory incident registry — keyed by incident ID.
// NOTE: Deliberately in-memory. Railway restarts / crashes clear this map.
// That is acceptable for the hackathon demo. Do NOT add file/DB persistence here.
const incidentRegistry = new Map();

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
const PACKAGE_ID = '0xd871fbe56f82f958db58978f13aaa777a714284a971a6075b6498604a3e92c7e';
const suiClient = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' });

// Load keypair from Sui keystore
function loadKeypair() {
  const keystorePath = `${os.homedir()}/.sui/sui_config/sui.keystore`;
  const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
  const keypair = Ed25519Keypair.fromSecretKey(fromBase64(keystore[0]).slice(1));
  return keypair;
}

async function anchorOnSui(blobId) {
  try {
    const keypair = loadKeypair();
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::incident_registry::record_incident`,
      arguments: [tx.pure.string(blobId)],
    });
    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEvents: true },
    });
    console.log('   ✅ [Sui] Anchored blob on-chain:', result.digest);
    return result.digest;
  } catch (err) {
    console.error('   ❌ [Sui] Anchor failed (non-blocking):', err.message);
    return null;
  }
}

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
      'POST /api/chat-memory/save',
      'GET  /api/chat-memory/load',
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
    // ── Step 1: Store directly on Walrus publisher (public, verifiable on Walruscan)
    const walrusResult = await storeOnWalrusPublisher(cleanIncident);
    const walrusBlobId = walrusResult.blobId;
    console.log(`   ✅ Walrus publisher → blob: ${walrusBlobId}`);

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
    const txDigest = await anchorOnSui(blobId);

    // Persist in in-memory registry for cross-device sync
    // Include walrusBlobId so the JSONDATA footer in future blobs is self-contained
    const storedIncident = {
      ...incident,
      walrusBlobId: blobId,
      walrusStatus: 'synced',
      suiTxDigest: txDigest || undefined,
      flagCount: 0,
      flaggedBy: [],
    };
    incidentRegistry.set(incident.id, storedIncident);

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

    res.json({ success: true, blobId, tx_digest: txDigest, createdAt: incident.createdAt });
  } catch (err) {
    console.error(`   ❌ Store failed:`, err.message || err);
    res.status(502).json({ success: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/incidents
 *
 * Returns all incidents stored since the proxy started, sorted by createdAt desc.
 * NOTE: in-memory only — cleared on every proxy restart (intentional for demo).
 */
app.get('/api/incidents', (_req, res) => {
  const list = [...incidentRegistry.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  console.log(`   🗑️  Deleted incident: ${id}`);
  broadcast({ type: 'INCIDENT_DELETED', incidentId: id });
  res.json({ success: true });
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
  const { message, history = [], currentIncidents = [] } = req.body;
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

    // Sort descending: most recently stored incident first
    const sorted = [...recalled.results].sort(
      (a, b) => extractTimestamp(b.text) - extractTimestamp(a.text)
    );

    // Cap at 10 freshest results injected into the context
    const topN = sorted.slice(0, 10);

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

  // Step 2: Call Groq with system prompt + recalled context + live context + conversation
  let liveContext = '';
  if (currentIncidents && currentIncidents.length > 0) {
    const activeCount = currentIncidents.filter(i => i.status === 'active').length;
    const resolvedCount = currentIncidents.filter(i => i.status === 'resolved').length;
    liveContext = `\n\n## LIVE INCIDENT STATE (REAL-TIME DASHBOARD DATA)\nCurrently, there are ${activeCount} active incidents and ${resolvedCount} resolved incidents. Pay close attention to whether an incident is marked as "active" or "resolved".\n\n${
      currentIncidents.map(i => `- [${i.status.toUpperCase()}] ${i.type} at ${i.location.address} (Severity: ${i.severity}) - "${i.description}"`).join('\n')
    }`;
  }

  const SYSTEM_PROMPT = `You are **Sentinel**, an AI-powered emergency operations agent deployed for the city of Bengaluru. You have permanent, cryptographically-verified memory of every safety incident ever reported — stored immutably on the Walrus blockchain via the MemWal protocol. Your memory cannot be tampered with, erased, or altered.
${liveContext}

## Your Core Identity
You are NOT a generic chatbot. You are a precision intelligence system for community safety. Every response you give should feel like it comes from a senior emergency operations analyst who has been watching this city's safety data for years.

## CRITICAL RESPONSE RULES — follow these EVERY time:

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

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: augmentedUserMessage },
    ];

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: SYSTEM_PROMPT,
      messages,
    });

    console.log(`   ✅ Agent responded (${result.text.length} chars)`);
    res.json({ response: result.text });
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
  try {
    const aggRes = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`);
    if (!aggRes.ok) {
      return res.status(aggRes.status).json({ found: false, status: aggRes.status });
    }
    const data = await aggRes.text();
    res.json({ found: true, blobId, size: data.length, data: data.slice(0, 500) });
  } catch (err) {
    res.status(502).json({ found: false, error: err.message || String(err) });
  }
});

/**
 * POST /api/chat-memory/save
 *
 * Persists a user's AgentChat conversation history to MemWal.
 * Body: { userId, messages: AgentMessage[] }
 * Uses a fixed key tag "CHAT_HISTORY:{userId}" so we can retrieve it deterministically.
 * Non-blocking — failure is silently swallowed on the client side.
 */
app.post('/api/chat-memory/save', async (req, res) => {
  const { userId, messages } = req.body;
  if (!userId || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, error: 'userId and messages[] are required' });
  }

  // Only persist real messages (strip welcome message with id 'welcome')
  const toSave = messages.filter((m) => m.id !== 'welcome');
  if (toSave.length === 0) {
    return res.json({ success: true, skipped: true });
  }

  // Format: tagged text blob so recall can find it by userId
  const text = `CHAT_HISTORY:${userId}\n${JSON.stringify(toSave)}`;

  console.log(`\n💬 Chat-memory save: userId=${userId.slice(0, 10)}… (${toSave.length} messages)`);

  try {
    const result = await memwal.rememberAndWait(text, undefined, {
      pollIntervalMs: 2000,
      timeoutMs: 60000,
    });
    console.log(`   ✅ Chat-memory saved → blob: ${result.blob_id}`);
    res.json({ success: true, blobId: result.blob_id });
  } catch (err) {
    console.warn(`   ⚠️  Chat-memory save failed (non-blocking):`, err.message || err);
    // Return 200 so the client doesn't surface this as an error
    res.json({ success: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/chat-memory/load?userId=...
 *
 * Retrieves the most recent chat history for a user from MemWal.
 * Searches by "CHAT_HISTORY:{userId}" tag and returns the closest match.
 * Returns: { found: boolean, messages: AgentMessage[] }
 */
app.get('/api/chat-memory/load', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'Missing ?userId= parameter' });
  }

  const query = `CHAT_HISTORY:${userId}`;
  console.log(`\n💬 Chat-memory load: userId=${String(userId).slice(0, 10)}…`);

  try {
    const result = await memwal.recall(query, 10);
    const items = result.results ?? result ?? [];

    // Find the item most likely to be THIS user's chat history
    // The tag is exact so the nearest semantic match should be their blob
    const match = items.find((item) =>
      item.text && item.text.startsWith(`CHAT_HISTORY:${userId}`)
    );

    if (!match) {
      console.log(`   ℹ️  No chat history found for userId=${String(userId).slice(0, 10)}…`);
      return res.json({ found: false, messages: [] });
    }

    // Strip the tag header, parse the JSON array
    const jsonStr = match.text.replace(`CHAT_HISTORY:${userId}\n`, '');
    let messages = [];
    try {
      messages = JSON.parse(jsonStr);
      if (!Array.isArray(messages)) messages = [];
    } catch {
      console.warn(`   ⚠️  Failed to parse chat history JSON for ${String(userId).slice(0, 10)}…`);
      return res.json({ found: false, messages: [] });
    }

    console.log(`   ✅ Loaded ${messages.length} messages for userId=${String(userId).slice(0, 10)}…`);
    res.json({ found: true, messages });
  } catch (err) {
    console.error(`   ❌ Chat-memory load failed:`, err.message || err);
    // Return 200 + empty so client silently falls back to empty chat
    res.json({ found: false, messages: [], error: err.message || String(err) });
  }
});

// ─── Start ───────────────────────────────────────────────────
const server = createServer(app);
wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, { ws, lat: null, lng: null });
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

        incidentRegistry.set(incident.id, {
          ...incident,
          // KEY FIX: rehydrated incidents ARE on Walrus — set blobId from the blob we just read
          walrusBlobId: incident.walrusBlobId || item.blob_id,
          walrusStatus: 'synced',
          flagCount:  incident.flagCount  ?? 0,
          flaggedBy:  incident.flaggedBy  ?? [],
        });
        console.log(`   ✅ Loaded: [${incident.id}] "${(incident.description || '').slice(0, 60)}"`);
        count++;
      } catch { /* skip unparseable blobs */ }
    }

    console.log(`[SENTINEL] Rehydrated ${count} incidents | skipped ${skippedJunk} junk + ${skippedBlocklist} blocklisted`);

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
  console.log(`     POST /api/chat-memory/save`);
  console.log(`     GET  /api/chat-memory/load`);
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);

  // Restore incidents from Walrus after any Railway restart.
  // Only loads NEW-format blobs (JSONDATA: footer) — skips old plain-text spam.
  rehydrateRegistry();
});
