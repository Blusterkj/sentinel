// src/components/DemoButton.tsx
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Incident } from '../types/incident';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3333';

const INCIDENTS = [
  { type: 'fire' as const,            severity: 'critical' as const, description: 'Fire reported at a commercial building. Smoke visible from street level.',            address: 'MG Road, Bengaluru',          lat: 12.9716, lng: 77.5946 },
  { type: 'medical' as const,         severity: 'high' as const,     description: 'Person unconscious near bus stop. Ambulance requested by bystanders.',               address: 'Connaught Place, Delhi',       lat: 28.6315, lng: 77.2167 },
  { type: 'accident' as const,        severity: 'medium' as const,   description: 'Two-vehicle collision at intersection. Minor injuries reported.',                     address: 'Banjara Hills, Hyderabad',     lat: 17.4126, lng: 78.4483 },
  { type: 'crime' as const,           severity: 'high' as const,     description: 'Chain snatching reported. Suspects fled on motorcycle.',                              address: 'Salt Lake, Kolkata',           lat: 22.5726, lng: 88.4319 },
  { type: 'natural_disaster' as const, severity: 'critical' as const, description: 'Waterlogging reported on main road. Vehicles stranded.',                             address: 'Andheri West, Mumbai',         lat: 19.1136, lng: 72.8697 },
  { type: 'fire' as const,            severity: 'high' as const,     description: 'Gas leak and fire in residential building. Residents evacuating.',                    address: 'Anna Nagar, Chennai',          lat: 13.0827, lng: 80.2707 },
];

export async function buildSimulatedIncident(): Promise<Incident> {
  const { v4: uuidv4 } = await import('uuid');
  const pick = INCIDENTS[Math.floor(Math.random() * INCIDENTS.length)];
  const incident: Incident = {
    id: uuidv4(),
    type: pick.type,
    severity: pick.severity,
    description: pick.description,
    location: { lat: pick.lat, lng: pick.lng, address: pick.address },
    timestamp: new Date().toISOString(),
    reportedBy: 'System',
    status: 'active',
    createdByMe: false,
    walrusStatus: 'pending',
  };
  try {
    const res = await fetch(`${PROXY_URL}/api/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
    });
    const data = await res.json();
    if (data.success && data.blobId) {
      incident.walrusBlobId = data.blobId;
      incident.walrusStatus = 'synced';
      try {
        const blobMap = JSON.parse(localStorage.getItem('sentinel_blob_map') || '{}');
        blobMap[incident.id] = data.blobId;
        localStorage.setItem('sentinel_blob_map', JSON.stringify(blobMap));
      } catch {}
    }
  } catch {}
  return incident;
}

interface DemoButtonProps {
  visible: boolean;
  onSimulate: (incident: Incident) => void;
  onHide: () => void;
}

export const DemoButton: React.FC<DemoButtonProps> = ({ visible, onSimulate, onHide }) => {
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    const incident = await buildSimulatedIncident();
    onSimulate(incident);
    onHide();
    setToast('Incident submitted to Walrus');
    setTimeout(() => setToast(''), 2000);
    setBusy(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        className="floating-action-secondary"
        style={{
          position: 'fixed',
          bottom: 'var(--fab-bottom, 80px)',
          right: 'var(--fab-right, 24px)',
          zIndex: 9998,
          padding: '6px 12px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#aaa',
          fontSize: '12px',
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.01em',
          opacity: busy ? 0.6 : 1,
          transition: 'opacity 0.15s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        ⚡ Simulate
      </button>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '8px 16px',
            background: '#111',
            border: '1px solid #22c55e44',
            borderRadius: '8px',
            color: '#22c55e',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          ✓ {toast}
        </div>
      )}
    </>
  );
};
