// src/pages/Agent.tsx
// AI Agent chat page

import React from 'react';
import { AgentChat } from '../components/AgentChat';
import { Brain, Database, Network } from 'lucide-react';
import type { Incident } from '../types/incident';

export const Agent: React.FC<{ incidents?: Incident[] }> = ({ incidents = [] }) => {
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
        style={{
          padding: '16px 180px 16px 24px',
          borderBottom: '1px solid #1a1a1a',
          background: '#0d0d0d',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Brain size={16} color="#8b5cf6" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
            AI Memory Agent
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <TechBadge icon={<Database size={10} />} label="MemWal" color="#8b5cf6" />
          <TechBadge icon={<Network size={10} />} label="Walrus" color="#3b82f6" />
        </div>
      </div>

      {/* Chat — fills rest of space */}
      <div style={{ flex: 1, overflow: 'hidden', paddingTop: '24px' }}>
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
