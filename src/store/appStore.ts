// src/store/appStore.ts
// Global cache store for all server-fetched data.
// Uses zustand/middleware persist so data survives route changes AND page refreshes.
// Each slice has its own TTL. Pages check isStale() on mount and revalidate in background.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Incident, AgentMessage } from '../types/incident';

// ─── Weather shape (matches WeatherStatus component in Dashboard.tsx) ─────────
export interface WeatherData {
  temp: number;
  code: number;
  city: string;
  humidity?: number;
  windSpeed?: number;
  aqi?: number;
  lat?: number;
  lon?: number;
}

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const TTL = {
  weather:    10 * 60 * 1000,  // 10 minutes
  incidents:   2 * 60 * 1000,  //  2 minutes
  analytics:   5 * 60 * 1000,  //  5 minutes
  memories:    5 * 60 * 1000,  //  5 minutes
  activity:    3 * 60 * 1000,  //  3 minutes
} as const;

// ─── Store interface ───────────────────────────────────────────────────────────
interface AppStore {
  // ── Weather ──────────────────────────────────────────────────────────────────
  weather: WeatherData | null;
  weatherFetchedAt: number | null;
  setWeather: (data: WeatherData) => void;
  isWeatherStale: () => boolean;

  // ── Incidents ─────────────────────────────────────────────────────────────────
  incidents: Incident[];
  incidentsFetchedAt: number | null;
  setIncidents: (data: Incident[]) => void;
  /** Call after report/resolve to force a fresh fetch on next Dashboard visit */
  clearIncidents: () => void;
  isIncidentsStale: () => boolean;

  // ── Analytics (computed stats derived from incidents — kept separate so
  //    the analytics page can independently decide to recompute) ─────────────────
  analyticsStats: {
    total: number;
    active: number;
    critical: number;
    resolved: number;
  } | null;
  analyticsFetchedAt: number | null;
  setAnalytics: (data: AppStore['analyticsStats']) => void;
  isAnalyticsStale: () => boolean;

  // ── Memories (Walrus blob list) ───────────────────────────────────────────────
  memories: Incident[];
  memoriesFetchedAt: number | null;
  setMemories: (data: Incident[]) => void;
  isMemoriesStale: () => boolean;

  // ── Activity (per-wallet incident list) ──────────────────────────────────────
  activity: Incident[];
  activityFetchedAt: number | null;
  setActivity: (data: Incident[]) => void;
  isActivityStale: () => boolean;

  // ── Map / Geolocation (persisted so dashboard doesn't jump on re-navigation) ─
  userLocation: [number, number] | null;
  setUserLocation: (loc: [number, number] | null) => void;

  // ── Agent Chat ───────────────────────────────────────────────────────────────
  agentMessages: AgentMessage[];
  setAgentMessages: (messages: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => void;
  clearAgentMessages: () => void;
}

// ─── Helper: is a timestamp older than a given TTL? ───────────────────────────
function isStale(fetchedAt: number | null, ttlMs: number): boolean {
  if (fetchedAt === null) return true;
  return Date.now() - fetchedAt > ttlMs;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Weather ──────────────────────────────────────────────────────────────
      weather: null,
      weatherFetchedAt: null,
      setWeather: (data) => set({ weather: data, weatherFetchedAt: Date.now() }),
      isWeatherStale: () => isStale(get().weatherFetchedAt, TTL.weather),

      // ── Incidents ────────────────────────────────────────────────────────────
      incidents: [],
      incidentsFetchedAt: null,
      setIncidents: (data) => set({ incidents: data, incidentsFetchedAt: Date.now() }),
      clearIncidents: () => set({ incidents: [], incidentsFetchedAt: null }),
      isIncidentsStale: () => isStale(get().incidentsFetchedAt, TTL.incidents),

      // ── Analytics ────────────────────────────────────────────────────────────
      analyticsStats: null,
      analyticsFetchedAt: null,
      setAnalytics: (data) => set({ analyticsStats: data, analyticsFetchedAt: Date.now() }),
      isAnalyticsStale: () => isStale(get().analyticsFetchedAt, TTL.analytics),

      // ── Memories ─────────────────────────────────────────────────────────────
      memories: [],
      memoriesFetchedAt: null,
      setMemories: (data) => set({ memories: data, memoriesFetchedAt: Date.now() }),
      isMemoriesStale: () => isStale(get().memoriesFetchedAt, TTL.memories),

      // ── Activity ─────────────────────────────────────────────────────────────
      activity: [],
      activityFetchedAt: null,
      setActivity: (data) => set({ activity: data, activityFetchedAt: Date.now() }),
      isActivityStale: () => isStale(get().activityFetchedAt, TTL.activity),

      // ── Map / Geolocation ─────────────────────────────────────────────────────
      userLocation: null,
      setUserLocation: (loc) => set({ userLocation: loc }),

      // 🤖 Agent Chat ───────────────────────────────────────────────────────────
      agentMessages: [{
        id: 'welcome',
        role: 'assistant',
        content: `I'm **Sentinel**, your AI community safety agent. I have permanent, cryptographically-verified memory of every incident ever reported in this system — stored on the Walrus blockchain via MemWal.\n\nAsk me anything: patterns, historical incidents, area status, triage recommendations, or emerging threats. My memory never fades.`,
        timestamp: new Date().toISOString(),
      }],
      setAgentMessages: (updater) => set((state) => ({
        agentMessages: typeof updater === 'function' ? updater(state.agentMessages) : updater
      })),
      clearAgentMessages: () => {
        // Tell AgentChat's mount-restore effect to skip one restore cycle —
        // user explicitly started a new conversation this session.
        // sessionStorage clears on tab/app close, so a fresh open always restores.
        sessionStorage.setItem('sentinel-skip-history-restore', 'true');
        set({
          agentMessages: [{
            id: 'welcome',
            role: 'assistant',
            content: `I'm **Sentinel**, your AI community safety agent. I have permanent, cryptographically-verified memory of every incident ever reported in this system — stored on the Walrus blockchain via MemWal.\n\nAsk me anything: patterns, historical incidents, area status, triage recommendations, or emerging threats. My memory never fades.`,
            timestamp: new Date().toISOString(),
          }]
        });
      },
    }),
    {
      name: 'sentinel-app-cache',
      // Only persist raw data + timestamps — never persist functions (not serialisable)
      partialize: (state) => ({
        weather:             state.weather,
        weatherFetchedAt:    state.weatherFetchedAt,
        incidents:           state.incidents,
        incidentsFetchedAt:  state.incidentsFetchedAt,
        analyticsStats:      state.analyticsStats,
        analyticsFetchedAt:  state.analyticsFetchedAt,
        memories:            state.memories,
        memoriesFetchedAt:   state.memoriesFetchedAt,
        activity:            state.activity,
        activityFetchedAt:   state.activityFetchedAt,
        userLocation:        state.userLocation,
        // NOTE: agentMessages intentionally excluded — persisted to MemWal, not localStorage
      }),
    }
  )
);
