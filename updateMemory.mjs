import fs from 'fs';

const filePath = 'c:/Users/blust/sentinel/src/pages/Memory.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  `import React, { useState, useMemo, useEffect } from 'react';`,
  `import React, { useState, useMemo, useEffect } from 'react';\nimport { useCurrentAccount } from '@mysten/dapp-kit';\nimport { useAuthStore } from '../lib/authStore';`
);

// 2. Rewrite the Memory component (up to the Sub-components section)
const componentStart = `export const Memory: React.FC<MemoryProps> = ({ incidents: _unused }) => {`;
const componentEnd = `// ─── Sub-components ─────────────────────────────────────────`;

const newComponent = `export const Memory: React.FC<MemoryProps> = ({ incidents }) => {
  const account = useCurrentAccount();
  const { address: inAppAddress } = useAuthStore();
  const wallet = account?.address ?? inAppAddress ?? null;

  const [activeTab, setActiveTab] = useState<'incidents' | 'agent'>('incidents');
  const [memories, setMemories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [proxyOnline, setProxyOnline] = useState<boolean | null>(null);

  // Check proxy health on mount
  useEffect(() => {
    fetch(\`\${PROXY_URL}/api/health\`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setProxyOnline(true))
      .catch(() => setProxyOnline(false));
  }, []);

  // Fetch agent memories if tab is active and wallet is connected
  useEffect(() => {
    if (activeTab === 'agent' && wallet) {
      fetch(\`\${PROXY_URL}/api/memories?wallet=\${wallet}\`)
        .then(res => res.json())
        .then(data => setMemories(data.memories || []))
        .catch(console.error);
    } else {
      setMemories([]);
    }
  }, [activeTab, wallet]);

  // Combine data based on active tab
  const activeData = useMemo(() => {
    if (activeTab === 'incidents') {
      return incidents
        .filter(i => !!i.walrusBlobId)
        .map(i => ({
          type: 'incident',
          blobId: i.walrusBlobId,
          timestamp: new Date(i.createdAt).getTime(),
          summary: \`[\${i.severity.toUpperCase()}] \${i.type} at \${i.location.address}: \${i.description}\`,
        }));
    }
    return memories.map(m => ({ ...m, type: 'agent' }));
  }, [activeTab, incidents, memories]);

  // Sorted newest first
  const sorted = useMemo(
    () => [...activeData].sort((a, b) => b.timestamp - a.timestamp),
    [activeData]
  );

  // Filtered
  const filtered = useMemo(() => {
    return sorted.filter((m) => {
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
          <span>Verification proxy offline — run <code style={{ background: '#1a1a1a', padding: '1px 6px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10px' }}>npm run proxy</code> to enable live on-chain recall</span>
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

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: '#111', padding: '4px', borderRadius: '24px', border: '1px solid #222' }}>
          <button
            onClick={() => setActiveTab('incidents')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'incidents' ? '#222' : 'transparent',
              color: activeTab === 'incidents' ? '#fff' : '#888',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Incidents
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'agent' ? '#222' : 'transparent',
              color: activeTab === 'agent' ? '#fff' : '#888',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Agent Conversations
          </button>
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
          value={totalBytes > 1024 ? \`\${(totalBytes / 1024).toFixed(1)} KB\` : \`\${totalBytes} B\`}
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

        {/* Mobile-responsive wrapper for filters + count */}
        <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
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

`;

const cStartIndex = content.indexOf(componentStart);
const cEndIndex = content.indexOf(componentEnd);

if (cStartIndex !== -1 && cEndIndex !== -1) {
  content = content.substring(0, cStartIndex) + newComponent + content.substring(cEndIndex);
}

// 3. Update MemoryEntry
content = content.replace(
  `{/* Row 1: Title/Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>Agent Conversation</span>
        </div>`,
  `{/* Row 1: Title/Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>{memory.type === 'incident' ? 'Incident Report' : 'Agent Conversation'}</span>
        </div>`
);

content = content.replace(
  `<div
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
        💬
      </div>`,
  `<div
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
        {memory.type === 'incident' ? '🚨' : '💬'}
      </div>`
);

fs.writeFileSync(filePath, content);
console.log('Successfully updated Memory.tsx');
