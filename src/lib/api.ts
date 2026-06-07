// src/lib/api.ts
// Single source of truth for the proxy base URL.
//
// Priority:
//   1. VITE_PROXY_URL env var (set in Vercel dashboard or .env.production)
//   2. Hardcoded Railway production URL (fallback so production always works
//      even if the env var is missing from the Vercel build)
//   3. localhost:3333 only used when running locally AND the env var is absent

const RAILWAY_URL = 'https://sentinel-proxy.up.railway.app';

export const PROXY_URL: string =
  import.meta.env.VITE_PROXY_URL ||
  (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
    ? RAILWAY_URL
    : 'http://localhost:3333');
