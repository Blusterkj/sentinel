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
