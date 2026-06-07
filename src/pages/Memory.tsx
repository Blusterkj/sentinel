// src/pages/Memory.tsx
// On-chain memory visualizer — shows Walrus-stored incident memories

import React, { useState, useMemo, useEffect } from 'react';
import type { Incident, IncidentType, Severity } from '../types/incident';
import { SeverityBadge } from '../components/SeverityBadge';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  Database,
  Search,
  ExternalLink,
  Clock,
  HardDrive,
  Activity,
  Filter,
  Hexagon,
  CheckCircle,
  Layers,
  Loader2,
  AlertCircle,
  Eye,
  X,
  ShieldCheck,
} from 'lucide-react';

import { PROXY_URL } from '../lib/api';


interface MemoryProps {
  incidents: Incident[];
}

// Truncate a blob ID for display
function truncateBlobId(blobId: string): string {
  if (blobId.length <= 16) return blobId;
  return `${blobId.slice(0, 10)}…${blobId.slice(-6)}`;
}

const TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌩️',
  other: '⚠️',
};

const TYPE_LABELS: Record<string, string> = {
  medical: 'Medical',
  fire: 'Fire',
  crime: 'Crime',
  accident: 'Accident',
  natural_disaster: 'Natural Disaster',
  other: 'Other',
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function estimateSize(incident: Incident): number {
  // Rough estimate: JSON serialization byte size
  return new TextEncoder().encode(JSON.stringify(incident)).length;
}

export const Memory: React.FC<MemoryProps> = ({ incidents }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<IncidentType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [proxyOnline, setProxyOnline] = useState<boolean | null>(null);

  // Check proxy health on mount
  useEffect(() => {
    fetch(`${PROXY_URL}/api/health`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setProxyOnline(true))
      .catch(() => setProxyOnline(false));
  }, []);

  // Sorted newest first
  const sorted = useMemo(
    () => [...incidents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [incidents]
  );

  // Filtered
  const filtered = useMemo(() => {
    return sorted.filter((inc) => {
      if (typeFilter !== 'all' && inc.type !== typeFilter) return false;
      if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          inc.description.toLowerCase().includes(q) ||
          inc.location.address.toLowerCase().includes(q) ||
          inc.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sorted, typeFilter, severityFilter, searchQuery]);

  // Stats
  const totalBytes = incidents.reduce((sum, inc) => sum + estimateSize(inc), 0);
  const oldestTs = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : null;
  const newestTs = sorted.length > 0 ? sorted[0].timestamp : null;

  return (
    <div className="mobile-memory-outer" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Proxy offline warning */}
      {proxyOnline === false && (
        <div
          style={{
            padding: '8px 20px',
            background: 'rgba(245, 158, 11, 0.06)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: '#f59e0b',
            flexShrink: 0,
          }}
        >
          <AlertCircle size={12} />
          <span>Verification proxy offline — run <code style={{ background: '#1a1a1a', padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10px' }}>npm run proxy</code> to enable live on-chain recall</span>
        </div>
      )}
      {/* Page header */}
      <div
        className="mobile-header-strip"
        style={{
          padding: '16px 280px 16px 24px',
          borderBottom: '1px solid #1a1a1a',
          background: '#0d0d0d',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={16} color="#8b5cf6" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
            On-Chain Memory Explorer
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              color: '#22c55e',
              background: 'rgba(34, 197, 94, 0.08)',
              padding: '3px 10px',
              borderRadius: '20px',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
                animation: 'glow-pulse 2s ease-in-out infinite',
              }}
            />
            LIVE — synced to Walrus
          </div>
          <TechPill icon={<Hexagon size={10} />} label="Walrus Testnet" color="#8b5cf6" />
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="mobile-stat-grid-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          padding: '24px',
          background: '#0a0a0a',
          flexShrink: 0,
        }}
      >
        <StatCard
          icon={<Layers size={14} color="#3b82f6" />}
          label="Total Memories"
          value={String(incidents.length)}
          color="#3b82f6"
        />
        <StatCard
          icon={<Clock size={14} color="#8b5cf6" />}
          label="Oldest Memory"
          value={oldestTs ? timeAgo(oldestTs) : '—'}
          color="#8b5cf6"
        />
        <StatCard
          icon={<Activity size={14} color="#22c55e" />}
          label="Newest Memory"
          value={newestTs ? timeAgo(newestTs) : '—'}
          color="#22c55e"
        />
        <StatCard
          icon={<HardDrive size={14} color="#f59e0b" />}
          label="Storage Used"
          value={totalBytes > 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${totalBytes} B`}
          color="#f59e0b"
        />
      </div>

      {/* Filter bar */}
      <div
        className="mobile-filter-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        {/* Search */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            padding: '8px 16px',
            transition: 'background 0.2s',
          }}
        >
          <Search size={14} color="#888" />
          <input
            type="text"
            placeholder="Search by location, type, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#eee',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="#888" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as IncidentType | 'all')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#bbb',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
            }}
          >
            <option value="all" style={{ background: '#111' }}>All Types</option>
            <option value="medical" style={{ background: '#111' }}>Medical</option>
            <option value="fire" style={{ background: '#111' }}>Fire</option>
            <option value="crime" style={{ background: '#111' }}>Crime</option>
            <option value="accident" style={{ background: '#111' }}>Accident</option>
            <option value="natural_disaster" style={{ background: '#111' }}>Natural Disaster</option>
          </select>
        </div>

        {/* Severity filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#bbb',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
          }}
        >
          <option value="all" style={{ background: '#111' }}>All Severities</option>
          <option value="high" style={{ background: '#111' }}>High</option>
          <option value="medium" style={{ background: '#111' }}>Medium</option>
          <option value="low" style={{ background: '#111' }}>Low</option>
        </select>

        {/* Result count */}
        <span className="mobile-result-count" style={{
          fontSize: '12px',
          color: '#888',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          marginLeft: 'auto',
          padding: '3px 12px',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.03)',
        }}>
          {filtered.length} / {incidents.length} results
        </span>
      </div>

      {/* Memory entries */}
      <div className="px-5 pt-6 pb-[120px] md:pb-6 mobile-list-scroll mobile-memory-list" style={{ flex: 1, overflowY: 'auto', background: '#050505' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#444',
              fontSize: '13px',
            }}
          >
            No memories match your filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((incident, index) => (
              <MemoryEntry key={incident.id} incident={incident} index={index} isLast={index === filtered.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────

const MemoryEntry: React.FC<{ incident: Incident; index: number; isLast?: boolean }> = ({ incident, index, isLast }) => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [resolving, setResolving] = useState(false);
  const [resolvedLocal, setResolvedLocal] = useState(incident.status === 'resolved');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolvedLocal(incident.status === 'resolved');
  }, [incident.status]);

  const handleResolve = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!incident.suiObjectId) return;
    setResolving(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${import.meta.env.VITE_PACKAGE_ID}::sentinel::resolve_incident`,
        arguments: [tx.object(incident.suiObjectId)],
      });
      await signAndExecute({ transaction: tx });
      setResolvedLocal(true);
    } catch (err: any) {
      alert(`Error resolving: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  const blobId = incident.walrusBlobId;
  const walrusStatus = incident.walrusStatus || 'pending';
  const byteSize = estimateSize(incident);
  const typeIcon = TYPE_ICONS[incident.type] || '⚠️';
  const typeLabel = TYPE_LABELS[incident.type] || incident.type;
  const [hovered, setHovered] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [proofData, setProofData] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const isSynced = walrusStatus === 'synced' && !!blobId;
  const isSyncing = walrusStatus === 'syncing';
  const isFailed = walrusStatus === 'failed';

  const handleVerify = async () => {
    if (showProof) {
      setShowProof(false);
      return;
    }
    setShowProof(true);
    setProofLoading(true);
    setProofError(null);
    try {
      // Call the local proxy which does server-side MemWal recall (no CORS issues)
      const query = `${incident.type} ${incident.location.address} ${incident.severity}`;
      const res = await fetch(
        `${PROXY_URL}/api/recall?query=${encodeURIComponent(query)}&limit=5`
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Proxy returned ${res.status}`);
      }
      const data = await res.json();
      // Find the result matching this incident's blob ID or ID
      const match =
        data.results?.find((r: any) => r.blob_id === blobId) ||
        data.results?.find((r: any) => r.text?.includes(incident.id)) ||
        data.results?.[0];
      if (match?.text) {
        setProofData(match.text);
      } else {
        setProofError(`Recall returned ${data.results?.length || 0} results but none matched this blob.`);
      }
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setProofError('Proxy not running. Start it with: npm run proxy');
      } else {
        setProofError(err.message || 'Failed to recall memory from MemWal.');
      }
    } finally {
      setProofLoading(false);
    }
  };

  return (
    <>
    <div
      className="fade-in-up"
      style={{
        background: hovered ? 'rgba(255,255,255,0.025)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        transition: 'background 0.15s ease',
        animationDelay: `${index * 30}ms`,
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Type icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {typeIcon}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>{typeLabel}</span>
          <SeverityBadge severity={incident.severity} size="sm" />
          {resolvedLocal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '11px', fontWeight: 600, background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              <CheckCircle size={11} /> Resolved
            </div>
          ) : (
            account?.address === incident.reporter && incident.suiObjectId && (
              <button 
                onClick={handleResolve}
                disabled={resolving}
                style={{ 
                  background: 'rgba(34, 197, 94, 0.1)', 
                  border: '1px solid rgba(34, 197, 94, 0.3)', 
                  color: '#22c55e', 
                  fontSize: '11px', 
                  fontWeight: 600, 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  cursor: resolving ? 'not-allowed' : 'pointer'
                }}
              >
                {resolving ? '...' : 'Resolve'}
              </button>
            )
          )}
          <span
            style={{
              fontSize: '10px',
              color: '#555',
              fontFamily: 'monospace',
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {timeAgo(incident.timestamp)}
          </span>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: '#777',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            marginBottom: '6px',
          }}
        >
          📍 {incident.location.address}
        </p>

        {/* Blob ID row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSynced && blobId ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10px',
                  color: '#8b5cf6',
                  background: 'rgba(139, 92, 246, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                }}
              >
                <Hexagon size={8} />
                {truncateBlobId(blobId)}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  color: '#22c55e',
                  fontFamily: 'monospace',
                }}
              >
                <CheckCircle size={10} />
                Verified
              </div>
            </>
          ) : isSyncing ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                color: '#8b5cf6',
                fontFamily: 'monospace',
              }}
            >
              <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
              Syncing to Walrus…
            </div>
          ) : isFailed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                color: '#f59e0b',
                fontFamily: 'monospace',
              }}
            >
              <AlertCircle size={10} />
              Pending sync
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                color: '#555',
                fontFamily: 'monospace',
              }}
            >
              <Hexagon size={8} />
              Awaiting Walrus sync
            </div>
          )}

          <span style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace' }}>
            {byteSize} B
          </span>
        </div>
      </div>

      {/* Verify button — only active if we have a real blob ID */}
      {isSynced && blobId ? (
        <button
          onClick={handleVerify}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 12px',
            background: showProof ? 'rgba(34, 197, 94, 0.1)' : hovered ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.06)',
            border: showProof ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '6px',
            color: showProof ? '#22c55e' : '#8b5cf6',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          title="Verify on-chain memory via MemWal recall"
        >
          {showProof ? <X size={11} /> : <Eye size={11} />}
          {showProof ? 'Close' : 'Verify'}
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 12px',
            background: '#111',
            border: '1px solid #1f1f1f',
            borderRadius: '6px',
            color: '#444',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {isSyncing ? (
            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <ExternalLink size={11} />
          )}
          {isSyncing ? 'Syncing…' : 'Pending'}
        </div>
      )}
    </div>

    {/* On-chain proof panel */}
    {showProof && (
      <div
        className="fade-in-up"
        style={{
          margin: '0 16px 14px',
          background: '#0d0d0d',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '8px',
          padding: '14px',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <ShieldCheck size={13} color="#22c55e" />
          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '11px' }}>
            ON-CHAIN VERIFICATION
          </span>
          <span style={{ color: '#555', fontFamily: 'monospace', fontSize: '10px', marginLeft: 'auto' }}>
            via MemWal → SEAL → Walrus
          </span>
        </div>

        {/* Blob ID */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px',
          padding: '6px 10px', background: '#111', borderRadius: '6px', border: '1px solid #1a1a1a',
        }}>
          <Hexagon size={10} color="#8b5cf6" />
          <span style={{ color: '#888', fontFamily: 'monospace', fontSize: '10px' }}>Blob ID:</span>
          <span style={{ color: '#8b5cf6', fontFamily: 'monospace', fontSize: '10px', wordBreak: 'break-all' }}>
            {blobId}
          </span>
        </div>

        {/* Recalled content */}
        {proofLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', padding: '8px 0' }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Recalling from Walrus via MemWal…</span>
          </div>
        ) : proofError ? (
          <div style={{ color: '#f59e0b', padding: '8px 0', lineHeight: '1.5' }}>
            ⚠️ {proofError}
          </div>
        ) : proofData ? (
          <div>
            <div style={{ color: '#555', marginBottom: '6px', fontWeight: 600, fontSize: '10px', letterSpacing: '0.05em' }}>
              DECRYPTED ON-CHAIN DATA:
            </div>
            <pre style={{
              color: '#ccc', fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.6',
              background: '#111', padding: '10px', borderRadius: '6px', border: '1px solid #1a1a1a',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              maxHeight: '120px', overflowY: 'auto',
            }}>
              {proofData}
            </pre>
          </div>
        ) : null}

        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle size={10} color="#22c55e" />
          <span style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: '10px' }}>
            Data retrieved from Walrus decentralized storage via SEAL decryption
          </span>
        </div>
      </div>
    )}
  </>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    style={{
      background: '#111',
      border: 'none',
      borderRadius: '12px',
      padding: '24px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minHeight: '110px',
      justifyContent: 'center'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>{label}</span>
    </div>
    <span
      style={{
        fontSize: '28px',
        fontWeight: 700,
        color,
        fontFamily: 'monospace',
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </span>
  </div>
);

const TechPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
}> = ({ icon, label, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '10px',
      color,
      background: `${color}12`,
      padding: '2px 8px',
      borderRadius: '4px',
      border: `1px solid ${color}25`,
      fontFamily: 'monospace',
      fontWeight: 600,
    }}
  >
    {icon}
    {label}
  </div>
);
