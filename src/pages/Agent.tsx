// src/pages/Agent.tsx
// AI Agent chat page

import React from 'react';
import { AgentChat } from '../components/AgentChat';
import { Brain, Database, Network, Trash2 } from 'lucide-react';
import type { Incident } from '../types/incident';
import { useAppStore } from '../store/appStore';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useAuthStore } from '../lib/authStore';
import { PROXY_URL } from '../lib/api';

export const Agent: React.FC<{ incidents?: Incident[] }> = ({ incidents = [] }) => {
  const { agentMessages, clearAgentMessages } = useAppStore();
  const account = useCurrentAccount();
  const { address: inAppAddress } = useAuthStore();
  const userId = account?.address ?? inAppAddress ?? null;
  
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
          padding: '16px 24px',
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
        
        {/* Clear Chat Button */}
        {agentMessages.length > 1 && (
          <button
            onClick={() => {
              clearAgentMessages();
              // Overwrite MemWal blob with empty history so it doesn't rehydrate on next load
              if (userId) {
                fetch(`${PROXY_URL}/api/chat-memory/save`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, messages: [], cleared: true, clearedAt: Date.now() }),
                }).catch(() => {});
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Clear Chat</span>
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
