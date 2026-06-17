// src/pages/Memory.tsx
// On-chain memory visualizer — shows Walrus-stored incident memories

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useAuthStore } from '../lib/authStore';
import type { Incident } from '../types/incident';
import {
  Database,
  Search,
  Clock,
  HardDrive,
  Activity,
  Hexagon,
  CheckCircle,
  Layers,
  Loader2,
  AlertCircle,
  Eye,
  X,
  ShieldCheck,
  ArrowRightLeft,
  ChevronDown,
} from 'lucide-react';

import { PROXY_URL, WS_URL } from '../lib/api';
import { SeverityBadge } from '../components/SeverityBadge';


interface MemoryProps {
  incidents: Incident[];
}

// Truncate a blob ID for display
function truncateBlobId(blobId: string): string {
  if (blobId.length <= 16) return blobId;
  return `${blobId.slice(0, 10)}…${blobId.slice(-6)}`;
}



function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CustomSelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: React.ReactNode }[];
  minWidth?: string;
}> = ({ value, onChange, options, minWidth = '140px' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div style={{ position: 'relative', minWidth }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.03)',
          border: isOpen ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          padding: '6px 12px',
          color: '#eee',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          outline: 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>{selectedOption?.label}</span>
        <ChevronDown size={14} color="#888" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '100%',
              minWidth: '160px',
              background: 'rgba(20, 20, 20, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.8)',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setIsOpen(false);
                  setTimeout(() => onChange(opt.value), 10);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  background: opt.value === value ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                  color: opt.value === value ? '#c4b5fd' : '#ccc',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (opt.value !== value) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌩️',
  other: '⚠️',
};

const TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Emergency',
  fire: 'Fire',
  crime: 'Crime',
  accident: 'Accident',
  natural_disaster: 'Natural Disaster',
  other: 'Other',
};

export const Memory: React.FC<MemoryProps> = ({ incidents }) => {
  const account = useCurrentAccount();
  const { address: inAppAddress } = useAuthStore();
  const wallet = account?.address ?? inAppAddress ?? null;

  const [activeTab, setActiveTab] = useState<'incidents' | 'agent'>('incidents');
  const [memories, setMemories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'severity'>('newest');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [proxyOnline, setProxyOnline] = useState<boolean | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);

  // Check proxy health on mount
  useEffect(() => {
    fetch(`${PROXY_URL}/api/incidents`, { method: 'GET' })
      .then((r) => r.ok ? r.json() : Promise.reject(`Status: ${r.status}`))
      .then(() => setProxyOnline(true))
      .catch((err) => {
        setProxyOnline(false);
        setProxyError(err?.message || String(err));
      });
  }, []);

  // Named fetch so the WS listener can re-invoke it without duplicating logic
  const fetchMemories = useCallback(() => {
    if (!wallet) return;
    fetch(`${PROXY_URL}/api/memories?wallet=${wallet}`)
      .then(res => res.json())
      .then(data => setMemories(data.memories || []))
      .catch(console.error);
  }, [wallet]);

  // Fetch agent memories if tab is active and wallet is connected
  useEffect(() => {
    if (activeTab === 'agent' && wallet) {
      fetchMemories();
    } else {
      setMemories([]);
    }
  }, [activeTab, wallet, fetchMemories]);

  // WebSocket listener — re-fetches memories when the proxy confirms a new one
  // is saved for this wallet, with a 1500ms debounce to let the aggregator catch up
  useEffect(() => {
    let ws: WebSocket;
    let debounceTimer: ReturnType<typeof setTimeout>;

    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'NEW_MEMORY_SAVED' &&
            data.walletAddress === wallet &&
            activeTab === 'agent'
          ) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(fetchMemories, 1500);
          }
        } catch { /* ignore malformed messages */ }
      };
    } catch { /* WebSocket not available (SSR/test) */ }

    return () => {
      clearTimeout(debounceTimer);
      ws?.close();
    };
  }, [wallet, activeTab, fetchMemories]);

  // Combine data based on active tab
  const activeData = useMemo(() => {
    if (activeTab === 'incidents') {
      return incidents
        .filter(i => !!i.walrusBlobId)
        .map(i => ({
          type: 'incident',
          blobId: i.walrusBlobId,
          timestamp: new Date(i.createdAt || Date.now()).getTime(),
          summary: `[${i.severity.toUpperCase()}] ${i.type} at ${i.location.address}: ${i.description}`,
          rawIncident: i,
        }));
    }
    return memories.map(m => ({ ...m, type: 'agent' }));
  }, [activeTab, incidents, memories]);

  // Sorted data based on sortOption
  const sorted = useMemo(() => {
    const data = [...activeData];
    
    if (sortOption === 'newest') {
      return data.sort((a, b) => b.timestamp - a.timestamp);
    } 
    if (sortOption === 'oldest') {
      return data.sort((a, b) => a.timestamp - b.timestamp);
    }
    if (sortOption === 'severity') {
      const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return data.sort((a, b) => {
        const rankA = (a.rawIncident && severityRank[a.rawIncident.severity]) || 0;
        const rankB = (b.rawIncident && severityRank[b.rawIncident.severity]) || 0;
        if (rankA !== rankB) return rankB - rankA;
        return b.timestamp - a.timestamp; // fallback to newest
      });
    }
    return data;
  }, [activeData, sortOption]);

  // Filtered
  const filtered = useMemo(() => {
    return sorted.filter((m) => {
      // Type filter for incidents
      if (activeTab === 'incidents' && typeFilter !== 'all') {
        if (!m.rawIncident || m.rawIncident.type !== typeFilter) return false;
      }
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          m.summary.toLowerCase().includes(q) || m.blobId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sorted, searchQuery]);

  // Stats
  const totalBytes = activeData.length * 1024; // Rough estimate 1KB per memory
  const oldestTs = sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp).toISOString() : null;
  const newestTs = sorted.length > 0 ? new Date(sorted[0].timestamp).toISOString() : null;

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
          <span>Proxy offline: {proxyError}</span>
        </div>
      )}
      {/* Page header */}
      <div
        className="mobile-header-strip"
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #1a1a1a',
          background: 'transparent',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database size={16} color="#8b5cf6" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
            On-Chain Memory Explorer
          </span>
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
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        <StatCard
          icon={<Layers size={14} color="#3b82f6" />}
          label="Total Memories"
          value={String(activeData.length)}
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
          value={totalBytes >= 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${totalBytes} B`}
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
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            padding: '8px 16px',
            transition: 'background 0.2s',
          }}
        >
          <Search size={14} color="#888" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by location, type, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#eee',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Tab Switcher Toggle */}
        <button
          onClick={() => setActiveTab(prev => prev === 'incidents' ? 'agent' : 'incidents')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            fontSize: '12px',
            fontWeight: 600,
          }}
          title="Toggle Memory View"
        >
          <ArrowRightLeft size={14} />
          <span className="hidden md:inline">{activeTab === 'incidents' ? 'Incidents' : 'Agent Convos'}</span>
        </button>

        {/* Result count */}
        <span className="flex-shrink-0 whitespace-nowrap" style={{
          fontSize: '12px',
          color: '#888',
          fontFamily: 'monospace',
          padding: '3px 12px',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.03)',
        }}>
          {filtered.length} / {activeData.length}
        </span>

        {/* Filters Group */}
        <div className="md:ml-auto" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeTab === 'incidents' && (
            <CustomSelect
              value={typeFilter}
              onChange={setTypeFilter}
              minWidth="140px"
              options={[
                { value: 'all', label: 'All Types' },
                ...Object.entries(TYPE_LABELS).map(([k, v]) => ({
                  value: k,
                  label: <>{TYPE_ICONS[k]} {v}</>
                }))
              ]}
            />
          )}

          {/* Sort Dropdown */}
          <CustomSelect
            value={sortOption}
            onChange={(val) => setSortOption(val as any)}
            minWidth="130px"
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'severity', label: 'Highest Severity' }
            ]}
          />
        </div>
      </div>

      {/* Memory entries */}
      <div className="px-5 pt-6 pb-[20px] md:pb-6 mobile-list-scroll mobile-memory-list" style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
        {activeTab === 'agent' && !wallet ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#888',
              fontSize: '13px',
            }}
          >
            Connect your wallet to view your agent conversation history.
          </div>
        ) : filtered.length === 0 ? (
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
            {filtered.map((memory, index) => (
              <MemoryEntry key={memory.blobId} memory={memory} index={index} isLast={index === filtered.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────

const MemoryEntry: React.FC<{ memory: any; index: number; isLast?: boolean }> = ({ memory, index, isLast }) => {
  const blobId = memory.blobId;
  const [hovered, setHovered] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [proofData, setProofData] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (showProof) {
      setShowProof(false);
      return;
    }
    setShowProof(true);
    setProofLoading(true);
    setProofError(null);
    try {
      if (!blobId) throw new Error("No Walrus Blob ID available for this memory.");

      // Fetch from aggregator
      const aggregators = [
        `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`,
        `https://wal-aggregator-testnet.staketab.org/v1/blobs/${blobId}`,
        `https://walrus-testnet-aggregator.nodeinfra.com/v1/blobs/${blobId}`,
      ];
      for (const url of aggregators) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const text = await r.text();
            setProofData(text);
            return;
          }
        } catch { /* try next */ }
      }

      throw new Error('Blob not found on any Walrus aggregator.');
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setProofError('Network error connecting to Walrus aggregator.');
      } else {
        setProofError(err.message || 'Failed to fetch memory from Walrus.');
      }
    } finally {
      setProofLoading(false);
    }
  };

  return (
    <>
    <div
      className={`group relative fade-in-up transition-all duration-300 border border-transparent ${isLast ? '' : 'border-b-white/5'} hover:-translate-y-1 hover:bg-[rgba(139,92,246,0.08)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.15)] hover:border-transparent`}
      style={{
        borderRadius: '8px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        animationDelay: `${index * 30}ms`,
        marginBottom: isLast ? '0' : '4px',
        overflow: 'hidden',
        cursor: memory.type === 'incident' && memory.rawIncident ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (memory.type === 'incident' && memory.rawIncident) {
          window.history.pushState({}, '', '/dashboard');
          window.dispatchEvent(new Event('popstate'));
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('selectIncident', { detail: memory.rawIncident })
            );
          }, 200);
        }
      }}
    >
      {/* Left accent bar on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-[rgba(139,92,246,0.6)] transition-colors duration-300" />
      {/* Type icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: memory.type === 'incident' ? 'rgba(255,255,255,0.03)' : '#1a1a1a',
          border: memory.type === 'incident' ? '1px solid rgba(255,255,255,0.05)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {memory.type === 'incident' && memory.rawIncident ? TYPE_ICONS[memory.rawIncident.type] || '⚠️' : '💬'}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {memory.type === 'incident' && memory.rawIncident ? (
          <>
            {/* Incident Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <SeverityBadge severity={memory.rawIncident.severity} size="sm" pulse={memory.rawIncident.severity === 'critical'} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#ddd' }}>
                {TYPE_LABELS[memory.rawIncident.type] || 'Incident Report'}
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: '#aaa',
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                marginBottom: '6px',
              }}
            >
              {memory.rawIncident.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#666', marginBottom: '8px' }}>
              📍 {memory.rawIncident.location.address}
            </div>
          </>
        ) : (
          <>
            {/* Agent Conversation Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>Agent Conversation</span>
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
              {memory.summary}
            </p>
          </>
        )}

        {/* Blob ID row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>
      </div>

      {/* Right Column: Time + Verify button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', flexShrink: 0, paddingLeft: '8px' }}>
        <span
          style={{
            fontSize: '10px',
            color: '#555',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            marginTop: '2px',
          }}
        >
          {timeAgo(new Date(memory.timestamp).toISOString())}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); handleVerify(); }}
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
          title="Verify on-chain memory via Walrus recall"
        >
          {showProof ? <X size={11} /> : <Eye size={11} />}
          {showProof ? 'Close' : 'Verify'}
        </button>
    </div>
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
            Walrus
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
            <span>Recalling from Walrus…</span>
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
            Data retrieved from Walrus decentralized storage
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
      background: 'linear-gradient(145deg, rgba(26, 26, 26, 0.9), rgba(12, 12, 12, 0.95))',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      padding: '24px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minHeight: '110px',
      justifyContent: 'center',
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
