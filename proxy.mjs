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

/**
 * POST /api/store
 *
 * Stores an incident on Walrus via MemWal. Returns the real blob ID.
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

  const text = `SENTINEL INCIDENT REPORT
ID: ${incident.id}
Created: ${incident.createdAt}
Type: ${(incident.type || 'other').replace('_', ' ').toUpperCase()}
Severity: ${(incident.severity || 'medium').toUpperCase()}
Location: ${incident.location?.address || 'Unknown'} (lat: ${incident.location?.lat || 0}, lng: ${incident.location?.lng || 0})
Description: ${incident.description}
Reported By: ${incident.reportedBy || 'Anonymous'}
Status: ${incident.status || 'active'}`;

  console.log(`\n📝 Store: ${incident.id} (${incident.type}/${incident.severity})`);
  console.log(`   📍 ${incident.location?.address || 'No address'}`);

  try {
    const result = await memwal.rememberAndWait(text, undefined, {
      pollIntervalMs: 2000,
      timeoutMs: 120000,
    });
    console.log(`   ✅ Stored → blob: ${result.blob_id}`);
    const txDigest = await anchorOnSui(result.blob_id);

    // Persist in in-memory registry for cross-device sync
    const storedIncident = {
      ...incident,
      walrusBlobId: result.blob_id,
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

    res.json({ success: true, blobId: result.blob_id, tx_digest: txDigest, createdAt: incident.createdAt });
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

  // Step 1: Recall relevant incidents from Walrus
  let recalledContext = '';
  try {
    const recalled = await memwal.recall(message, 5);
    console.log(`   🔍 Recalled ${recalled.results.length} incidents from Walrus`);
    for (const r of recalled.results) {
      console.log(`      dist: ${r.distance.toFixed(3)}  text: ${r.text.slice(0, 60)}…`);
    }
    if (recalled.results.length > 0) {
      recalledContext = `\n\n## RECALLED INCIDENT DATA FROM WALRUS BLOCKCHAIN\nThe following ${recalled.results.length} incidents were retrieved from your on-chain Walrus memory via semantic search. Use this data to answer the user's question with specific facts:\n\n` +
        recalled.results.map((r, i) => `### Memory ${i + 1} (similarity: ${(1 - r.distance).toFixed(2)})\n${r.text}`).join('\n\n');
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
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);
});
