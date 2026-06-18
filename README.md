# Sentinel — Next-Gen Community Safety Platform

**Sui Overflow 2026 · Walrus Track (DeepSurge)**

Sentinel turns hyperlocal incident reporting into a self-healing, cryptographically verifiable safety network. Every report a user files is pushed to decentralized Walrus storage and indexed on Sui, then fanned out as a real-time push alert to anyone within a 20km radius — so the community knows what's happening near them within seconds, with a public, tamper-proof record of what was reported and when.

**Live app:** [sentinelproduction.vercel.app](https://sentinelproduction.vercel.app)  
**Android APK:** [Download app-debug.apk](https://github.com/Blusterkj/sentinel/releases/download/v1.0.0/app-debug.apk)  
**Repo:** [github.com/blusterkj/sentinel](https://github.com/blusterkj/sentinel)

---

## Why this matters

Neighborhood safety information today is scattered across group chats, word of mouth, and local news that's often too slow to matter. Reports get lost, disputed, or quietly edited after the fact. Sentinel makes every incident report permanent, publicly auditable on Walrus, and instantly actionable — your neighbor gets a push notification while the situation is still relevant, not a headline the next morning.

## What makes Sentinel different

- **Dual-store architecture.** Every incident write goes to both MemWal (encrypted, agent-queryable memory) and the Walrus Testnet Publisher directly, returning a publicly verifiable blob ID you can check on Walruscan. Nothing is mocked — every blob ID in the app resolves to a real object on testnet.
- **Real-time radius alerting.** A WebSocket layer pushes nearby-incident alerts using Haversine distance filtering (5km for in-app, 20km for FCM push), with anonymous session IDs so alerting doesn't require an account.
- **On-chain proof, not just a database.** A Move smart contract deployed to Sui testnet anchors incident integrity. Incident detail views surface the blockchain proof without burying the human-readable report — proof is collapsed by default, the story is what's up front.
- **An AI agent with a public/private memory split.** The in-app agent (built on MemWal) keeps personal chat memory wallet-filtered and private, while incident memory functions as a public transparency ledger — toggled via separate tabs on the Memory page.
- **Cross-platform from one codebase.** Desktop users connect with a Slush wallet; mobile/APK users get an in-app Ed25519 keypair (BIP39-backed, stored via Capacitor Preferences) so there's no wallet app dependency to use Sentinel on a phone.

## Architecture

| Layer | Tech | Role |
|---|---|---|
| Frontend | Vite + React + TypeScript, Tailwind, Zustand, react-leaflet | UI, map rendering, client state with TTL-cached slices |
| AI agent | MemWal SDK + Gemini 2.5 Flash | Conversational agent, semantic recall, incident summarization |
| Proxy/backend | Express (`proxy.mjs`) on Railway | API gateway, FCM dispatch, Walrus publisher calls |
| Storage | Walrus Testnet (direct) + MemWal (encrypted) | Dual-write incident persistence with public verifiability |
| On-chain | Sui Move, testnet | Incident integrity contract |
| Push | Firebase Cloud Messaging | 20km radius alerts to subscribed devices |
| Mobile | Capacitor (Android) | Native APK with platform-aware geolocation and wallet flow |

**Smart contract (Sui testnet):**  
`0xe418ca986c677725f062657ad0751dd846165eb690cf7bff6b724f9e0ed1e539`

## Core features

- Incident reporting with map-based location, severity, and category
- Dual persistence to Walrus + MemWal with file-backed Railway volume storage (no data loss on restart)
- Real-time FCM push notifications within a 20km radius, plus in-app WebSocket alerts within 5km
- AI agent chat with public incident memory and private personal memory, browsable via Memory Explorer
- Wallet-based incident ownership and resolution (persists across refresh, tied to wallet address)
- Analytics dashboard (incident trends, category breakdown, resolution rates)
- Native Android APK with in-app wallet generation, no external wallet app required

## Running locally

```bash
git clone https://github.com/blusterkj/sentinel.git
cd sentinel
npm install
npm run dev      # frontend, http://localhost:5173
npm run proxy    # backend proxy, http://localhost:3333
```

You'll need a `GEMINI_API_KEY` and Railway-equivalent env vars for the proxy (FCM service account, Walrus publisher endpoint, MemWal credentials). See `.env.example` for the full list.

## Status

Working end to end on Sui testnet: report → Walrus + MemWal dual-write → on-chain proof → real-time radius alert → AI agent recall. 21 seed incidents are live and verifiable on Walruscan. Android APK build confirmed working with native geolocation and push notifications.

## Team / Built by

Built solo for Sui Overflow 2026 by [Kishan](https://github.com/blusterkj).
