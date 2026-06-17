// src/pages/Agent.tsx
// AI Agent chat page

import React from 'react';
import { AgentChat } from '../components/AgentChat';
import { Brain, Database, Network, SquarePen } from 'lucide-react';
import type { Incident } from '../types/incident';
import { useAppStore } from '../store/appStore';
import { PROXY_URL } from '../lib/api';
import { useAuthStore } from '../lib/authStore';
import { useCurrentAccount } from '@mysten/dapp-kit';
export const Agent: React.FC<{ incidents?: Incident[] }> = ({ incidents = [] }) => {
  const { agentMessages, clearAgentMessages } = useAppStore();
  const { address: inAppAddress } = useAuthStore();
  const account = useCurrentAccount();
  const walletAddress = account?.address ?? inAppAddress ?? null;
  const [isClearing, setIsClearing] = React.useState(false);
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Page header strip */}
      <div
        className="mobile-header-strip"
        style={{
          padding: '9px 24px',
          borderBottom: '1px solid #1a1a1a',
          background: '#0d0d0d',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Brain size={16} color="#8b5cf6" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
          AI Memory Agent
        </span>
        <TechBadge icon={<Database size={10} />} label="MemWal" color="#8b5cf6" />
        <TechBadge icon={<Network size={10} />} label="Walrus" color="#3b82f6" />
        
        {/* New Conversation Button */}
        {agentMessages.length > 1 && (
          <button
            disabled={isClearing}
            aria-label="New conversation"
            onClick={async () => {
              if (isClearing) return;
              setIsClearing(true);
              // Clear locally first (instant feedback)
              clearAgentMessages();
              // Hit server → broadcasts AGENT_CHAT_CLEARED to same-wallet sessions
              // Memories are preserved on the Memory page (immutable on-chain records)
              try {
                const params = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : '';
                await fetch(`${PROXY_URL}/api/chat/reset${params}`, {
                  method: 'POST',
                });
              } catch { /* non-blocking */ }
              setIsClearing(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '6px',
              color: '#8b5cf6',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isClearing ? 'wait' : 'pointer',
              opacity: isClearing ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (isClearing) return;
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              if (isClearing) return;
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
            }}
          >
            <SquarePen size={12} />
            <span className="hidden sm:inline">{isClearing ? 'Starting…' : 'New Conversation'}</span>
          </button>
        )}
      </div>

      {/* Chat — fills rest of space */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AgentChat incidents={incidents} />
      </div>
    </div>
  );
};

const TechBadge: React.FC<{
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
