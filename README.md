# Sentinel — Community Safety Monitoring on Walrus

**Sui Overflow 2026 · Walrus Track**

A hyperlocal community safety monitoring system powered by an AI agent with permanent memory stored on the Walrus blockchain via MemWal.

## What It Does

1. **Report incidents** → stored permanently on Walrus via MemWal (`memwal.remember()`)
2. **AI pattern analysis** → agent recalls similar past incidents (`memwal.recall()`)
3. **Persistent agent** → chat with an AI that remembers every incident ever reported
4. **Live map** → severity-colored pins with pulsing animations for critical incidents

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS v4 |
| AI Memory | `@mysten-incubation/memwal` (Walrus) |
| AI Model | Gemini 2.5 Flash (via Google AI REST API) |
| Map | react-leaflet + Leaflet.js |
| Icons | lucide-react |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env` with your credentials:
```env
VITE_MEMWAL_KEY=<your Ed25519 delegate key hex>
VITE_MEMWAL_ACCOUNT_ID=<your MemWalAccount object ID>
VITE_MEMWAL_SERVER_URL=https://relayer.memwal.ai
GEMINI_API_KEY=<your Google AI API key>  # server-side (Railway env var)
VITE_GROQ_API_KEY=<unused, kept for reference>
```

### 3. Run
```bash
npm run dev
```

## Architecture

```
src/
├── lib/
│   ├── memwal.ts    <- MemWal singleton (remember/recall/health)
│   └── agent.ts     <- AI agent with withMemWal memory wrapper
├── components/
│   ├── Map.tsx          <- react-leaflet dark map + severity pins
│   ├── IncidentFeed.tsx <- Live scrolling incident cards
│   ├── IncidentForm.tsx <- Report form + pattern analysis
│   ├── AgentChat.tsx    <- Chat UI with suggestions
│   └── SeverityBadge.tsx
├── pages/
│   ├── Dashboard.tsx <- Map + stats + live feed
│   ├── Report.tsx    <- Incident report page
│   └── Agent.tsx     <- AI agent chat page
└── types/incident.ts
```
