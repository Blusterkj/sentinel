// src/lib/memwal.ts
// MemWal client singleton — all incidents are remembered/recalled through this

import { MemWal } from '@mysten-incubation/memwal';
import type { Incident } from '../types/incident';

let client: MemWal | null = null;

export function getMemWalClient(): MemWal {
  if (!client) {
    const key = import.meta.env.VITE_MEMWAL_KEY;
    const accountId = import.meta.env.VITE_MEMWAL_ACCOUNT_ID;
    const serverUrl = import.meta.env.VITE_MEMWAL_SERVER_URL || 'https://relayer.memwal.ai';

    if (!key || !accountId) {
      throw new Error(
        'MemWal not configured. Set VITE_MEMWAL_KEY and VITE_MEMWAL_ACCOUNT_ID in your .env file.'
      );
    }

    client = MemWal.create({
      key,
      accountId,
      serverUrl,
      namespace: 'sentinel',
    });
  }
  return client;
}

/**
 * Format an incident into the text that gets stored on Walrus.
 */
export function formatIncidentText(incident: Incident): string {
  return `
SENTINEL INCIDENT REPORT
ID: ${incident.id}
Timestamp: ${incident.timestamp}
Type: ${incident.type.replace('_', ' ').toUpperCase()}
Severity: ${incident.severity.toUpperCase()}
Location: ${incident.location.address} (lat: ${incident.location.lat}, lng: ${incident.location.lng})
Description: ${incident.description}
Reported By: ${incident.reportedBy}
Status: ${incident.status}
  `.trim();
}

/**
 * Store an incident permanently on Walrus via MemWal (fire-and-forget).
 * Returns the job_id from the accepted background task.
 */
export async function storeIncident(incident: Incident): Promise<string> {
  const memwal = getMemWalClient();
  const text = formatIncidentText(incident);
  const accepted = await memwal.remember(text);
  return accepted.job_id;
}

/**
 * Store an incident and WAIT for the blob to be fully written.
 * Returns the real Walrus blob_id.
 */
export async function storeIncidentAndWait(
  incident: Incident,
  timeoutMs = 60000
): Promise<string> {
  const memwal = getMemWalClient();
  const text = formatIncidentText(incident);
  const result = await memwal.rememberAndWait(text, undefined, {
    pollIntervalMs: 1500,
    timeoutMs,
  });
  return result.blob_id;
}

/**
 * Wait for a remember job to complete (optional — use after storeIncident)
 */
export async function waitForStore(jobId: string): Promise<void> {
  const memwal = getMemWalClient();
  await memwal.waitForRememberJob(jobId);
}

/**
 * Recall similar incidents from MemWal memory.
 * Returns array of { text, distance, blob_id } results.
 */
export async function recallNearbyIncidents(
  query: string,
  limit = 5
): Promise<Array<{ text: string; distance: number; blob_id: string }>> {
  const memwal = getMemWalClient();
  const result = await memwal.recall(query, limit);
  return result.results.map((r) => ({
    text: r.text,
    distance: r.distance,
    blob_id: r.blob_id,
  }));
}

/**
 * Check MemWal server health
 */
export async function checkHealth(): Promise<{ status: string }> {
  const memwal = getMemWalClient();
  const result = await memwal.health();
  return result;
}
