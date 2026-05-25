// src/hooks/useWalrusSeeding.ts
// Handles loading real Walrus blob IDs from the seed script output,
// falling back to localStorage cache, then live seeding as last resort.

import { useState, useEffect, useCallback, useRef } from 'react';
import { storeIncidentAndWait } from '../lib/memwal';
import type { Incident } from '../types/incident';

const STORAGE_KEY = 'sentinel_seeded';
const BLOB_MAP_KEY = 'sentinel_blob_map';

export interface SeedingState {
  /** Whether seeding is currently in progress */
  isSeeding: boolean;
  /** Current progress: number of incidents processed so far */
  progress: number;
  /** Total incidents to seed */
  total: number;
  /** Whether seeding has completed (success or all attempted) */
  isDone: boolean;
  /** Number of successfully synced incidents */
  successCount: number;
  /** Number of failed incidents */
  failedCount: number;
  /** Error message if the whole process failed to start */
  error: string | null;
  /** Manually trigger re-seeding (clears localStorage flag) */
  reseed: () => void;
}

/**
 * Load the blob ID map from localStorage.
 */
function loadBlobMapFromStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BLOB_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save blob ID mappings to localStorage for caching.
 */
function saveBlobMapToStorage(map: Record<string, string>): void {
  localStorage.setItem(BLOB_MAP_KEY, JSON.stringify(map));
}

/**
 * Try loading blob-map.json from /blob-map.json (produced by seed-walrus.mjs).
 */
async function loadBlobMapFromFile(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/blob-map.json');
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/**
 * Get all stored blob mappings (for external use).
 */
export function getBlobMap(): Record<string, string> {
  return loadBlobMapFromStorage();
}

/**
 * Hook that loads real Walrus blob IDs for all incidents.
 * 
 * Priority:
 *  1. public/blob-map.json (from `node seed-walrus.mjs`)
 *  2. localStorage cache (from previous browser seeding)
 *  3. Live browser seeding via MemWal (may fail due to CORS)
 */
export function useWalrusSeeding(
  incidents: Incident[],
  updateIncident: (id: string, updates: Partial<Incident>) => void
): SeedingState {
  const [isSeeding, setIsSeeding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const seedingRef = useRef(false);
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;

  const seed = useCallback(async () => {
    // Prevent double-invocation from React StrictMode
    if (seedingRef.current) return;
    seedingRef.current = true;

    const currentIncidents = incidentsRef.current;

    // ── Strategy 1: Load from blob-map.json (seed script output) ──
    const fileBlobMap = await loadBlobMapFromFile();
    if (Object.keys(fileBlobMap).length > 0) {
      // Cache in localStorage too
      saveBlobMapToStorage(fileBlobMap);
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());

      let synced = 0;
      for (const inc of currentIncidents) {
        if (fileBlobMap[inc.id]) {
          updateIncident(inc.id, {
            walrusBlobId: fileBlobMap[inc.id],
            walrusStatus: 'synced',
          });
          synced++;
        }
      }
      setSuccessCount(synced);
      setFailedCount(currentIncidents.length - synced);
      setIsDone(true);
      return;
    }

    // ── Strategy 2: Load from localStorage cache ──
    const alreadySeeded = localStorage.getItem(STORAGE_KEY);
    if (alreadySeeded) {
      const storageBlobMap = loadBlobMapFromStorage();
      let synced = 0;
      for (const inc of currentIncidents) {
        if (storageBlobMap[inc.id]) {
          updateIncident(inc.id, {
            walrusBlobId: storageBlobMap[inc.id],
            walrusStatus: 'synced',
          });
          synced++;
        }
      }
      setSuccessCount(synced);
      setIsDone(true);
      return;
    }

    // ── Strategy 3: Live browser seeding ──
    setIsSeeding(true);
    setProgress(0);
    setError(null);

    let successes = 0;
    let failures = 0;

    for (let i = 0; i < currentIncidents.length; i++) {
      const incident = currentIncidents[i];
      setProgress(i + 1);

      // Mark as syncing
      updateIncident(incident.id, { walrusStatus: 'syncing' });

      try {
        const blobId = await storeIncidentAndWait(incident, 90000);

        // Save the real blob ID
        const currentMap = loadBlobMapFromStorage();
        currentMap[incident.id] = blobId;
        saveBlobMapToStorage(currentMap);

        updateIncident(incident.id, {
          walrusBlobId: blobId,
          walrusStatus: 'synced',
        });
        successes++;
        setSuccessCount(successes);
      } catch (err) {
        console.warn(`Failed to seed incident ${incident.id}:`, err);
        updateIncident(incident.id, { walrusStatus: 'failed' });
        failures++;
        setFailedCount(failures);

        // Small delay before retrying next to give relayer time
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Small delay between requests to be gentle on the relayer
      if (i < currentIncidents.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Mark seeding as complete
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setIsSeeding(false);
    setIsDone(true);
  }, [updateIncident]);

  useEffect(() => {
    seed();
  }, [seed]);

  const reseed = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BLOB_MAP_KEY);
    seedingRef.current = false;
    setIsDone(false);
    setProgress(0);
    setSuccessCount(0);
    setFailedCount(0);
    seed();
  }, [seed]);

  return {
    isSeeding,
    progress,
    total: incidents.length,
    isDone,
    successCount,
    failedCount,
    error,
    reseed,
  };
}
