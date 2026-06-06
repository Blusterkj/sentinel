// src/pages/Report.tsx
// Incident report page

import React from 'react';
import { IncidentForm } from '../components/IncidentForm';
import type { Incident } from '../types/incident';
import { Shield, Layers, Globe } from 'lucide-react';

interface ReportProps {
  onIncidentSubmitted: (incident: Incident) => void;
}

export const Report: React.FC<ReportProps> = ({ onIncidentSubmitted }) => {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#0a0a0a',
      }}
      className="pb-[140px] md:pb-8 mobile-report-page"
    >
      {/* Page header */}
      <div
        style={{
          padding: '32px 24px 0',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px',
          }}
        >
          <Shield size={20} color="#3b82f6" />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#3b82f6',
              letterSpacing: '0.1em',
              fontFamily: 'monospace',
            }}
          >
            SENTINEL REPORT
          </span>
        </div>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#e5e5e5',
            marginBottom: '8px',
            lineHeight: '1.2',
          }}
        >
          Report an Incident
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: '#666',
            lineHeight: '1.6',
            marginBottom: '28px',
          }}
        >
          Reports are stored permanently on the Walrus blockchain via MemWal.
          The AI agent will immediately analyze the incident against historical patterns.
        </p>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '28px',
            flexWrap: 'wrap',
          }}
        >
          <FeaturePill icon={<Globe size={12} />} label="Walrus Blockchain" color="#8b5cf6" />
          <FeaturePill icon={<Layers size={12} />} label="MemWal Memory" color="#3b82f6" />
          <FeaturePill icon={<Shield size={12} />} label="Encrypted Storage" color="#22c55e" />
        </div>

        <div
          style={{
            height: '1px',
            background: 'linear-gradient(to right, #1f1f1f, transparent)',
            marginBottom: '24px',
          }}
        />
      </div>

      {/* Form */}
      <IncidentForm onIncidentSubmitted={onIncidentSubmitted} />
    </div>
  );
};

const FeaturePill: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
}> = ({ icon, label, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: `${color}10`,
      border: `1px solid ${color}25`,
      borderRadius: '20px',
      color: color,
      fontSize: '11px',
      fontWeight: 600,
    }}
  >
    {icon}
    {label}
  </div>
);
