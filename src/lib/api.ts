// src/lib/api.ts
// Single source of truth for the proxy base URL.
//
// Priority:
//   1. VITE_PROXY_URL env var (set in Vercel dashboard or .env.production)
//   2. Hardcoded Railway production URL (fallback so production always works
//      even if the env var is missing from the Vercel build)
//   3. localhost:3333 only used when running locally AND the env var is absent

const RAILWAY_HTTP = 'https://sentinel-proxy-production.up.railway.app';
const RAILWAY_WSS  = 'wss://sentinel-proxy-production.up.railway.app';

const isLocalhost =
  typeof window !== 'undefined' && window.location.hostname.includes('localhost');

export const PROXY_URL: string =
  import.meta.env.VITE_PROXY_URL ||
  (isLocalhost ? 'http://localhost:3333' : RAILWAY_HTTP);

export const WS_URL: string =
  import.meta.env.VITE_WS_URL ||
  (isLocalhost ? 'ws://localhost:3333' : RAILWAY_WSS);
