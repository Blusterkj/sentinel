// src/types/incident.ts

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentType =
  | 'medical'
  | 'fire'
  | 'crime'
  | 'accident'
  | 'natural_disaster'
  | 'other';

export type WalrusStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Incident {
  id: string;
  type: IncidentType;
  severity: Severity;
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  timestamp: string;
  /** Server-generated ISO timestamp — source of truth for "X ago" display */
  createdAt?: string;
  reportedBy: string;
  status: 'active' | 'resolved';
  /** Real Walrus blob ID — set after successful MemWal storage */
  walrusBlobId?: string;
  /** Walrus sync status */
  walrusStatus?: WalrusStatus;
  /** Sui testnet transaction digest for on-chain anchoring */
  suiTxDigest?: string;
  /** Sui object ID of the created Incident contract */
  suiObjectId?: string;
  /** Wallet address of the reporter */
  reporter?: string;
  /** Whether the current user created this incident in this session */
  createdByMe?: boolean;
  /** Number of spam flags on this incident (social signal only, never auto-hides) */
  flagCount?: number;
  /** Whether the current user (wallet) has flagged this incident this session */
  flaggedByMe?: boolean;
  /** Wallet addresses that flagged this incident — only present on detailed response, not in list */
  flaggedBy?: string[];
  /** True for seed/simulated/system-generated incidents — excluded from My Activity */
  isSimulated?: boolean;
  /**
   * Optimistic-UI upload state — only present on locally-submitted incidents before
   * the proxy confirms storage. Never set by the server.
   *   'pending'   — fire-and-forget POST in flight
   *   'confirmed' — proxy returned a blobId (nothing extra shown on card)
   *   'failed'    — POST failed; a retry icon is shown on the card
   */
  uploadStatus?: 'pending' | 'confirmed' | 'failed';
  /** Server-assigned serial sequence number — never trust client-provided values */
  sequenceNumber?: number;
  /** Server-assigned ISO timestamp — authoritative source of truth */
  serverTimestamp?: string;
}

export interface RecalledMemory {
  text: string;
  distance: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
