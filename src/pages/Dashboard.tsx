// src/pages/Dashboard.tsx
// Main dashboard: map + live incident feed

import React, { useState, useEffect } from 'react';
import { Map } from '../components/Map';
import { IncidentFeed } from '../components/IncidentFeed';
import type { Incident } from '../types/incident';
import { AlertTriangle, Activity, Link as LinkIcon } from 'lucide-react';
import { SeverityBadge } from '../components/SeverityBadge';
import { NearbyAlerts } from '../components/NearbyAlerts';

interface DashboardProps {
  incidents: Incident[];
  seeding?: {
    isSeeding: boolean;
    progress: number;
    total: number;
    isDone: boolean;
    successCount: number;
    failedCount: number;
  };
  criticalFilter: boolean;
  setCriticalFilter: (val: boolean) => void;
  activeFilter: boolean;
  setActiveFilter: (val: boolean) => void;
  onResolveIncident?: (id: string) => void;
  onDeleteIncident?: (id: string) => void;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bangalore, India

export const Dashboard: React.FC<DashboardProps> = ({ 
  incidents, 
  criticalFilter,
  setCriticalFilter,
  activeFilter,
  setActiveFilter,
  onResolveIncident,
  onDeleteIncident
}) => {
  const [myReportsFilter, setMyReportsFilter] = useState(false);
  const [center, setCenter] = useState<[number, number]>(() => {
    if (incidents.length > 0) {
      const centerLat = incidents.reduce((sum, i) => sum + i.location.lat, 0) / incidents.length;
      const centerLng = incidents.reduce((sum, i) => sum + i.location.lng, 0) / incidents.length;
      return [centerLat, centerLng];
    }
    return DEFAULT_CENTER;
  });
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [locationObtained, setLocationObtained] = useState(false);

  // Still fetch location for nearby alerts, but don't recenter the map
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationObtained(true),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Stats
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
  const activeCount = incidents.filter((i) => i.status === 'active').length;
  const verifiedCount = incidents.filter((i) => !!i.suiTxDigest).length;
  const myReportsCount = incidents.filter((i) => i.createdByMe).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          padding: '10px 20px',
          background: '#0d0d0d',
          borderBottom: '1px solid #1a1a1a',
          flexShrink: 0,
        }}
      >
        {activeFilter ? (
          <StatPill
            icon={<Activity size={12} color="#3b82f6" />}
            label="Showing active only · ×"
            value=""
            color="#3b82f6"
            pulse={false}
            onClick={() => setActiveFilter(false)}
          />
        ) : (
          <StatPill
            icon={<Activity size={12} color="#3b82f6" />}
            label="Active"
            value={String(activeCount)}
            color="#3b82f6"
            onClick={() => setActiveFilter(true)}
          />
        )}
        {criticalFilter ? (
          <StatPill
            icon={<AlertTriangle size={12} color="#ef4444" />}
            label="Showing critical only · ×"
            value=""
            color="#ef4444"
            pulse={false}
            onClick={() => setCriticalFilter(false)}
          />
        ) : criticalCount > 0 ? (
          <StatPill
            icon={<AlertTriangle size={12} color="#ef4444" />}
            label="Critical"
            value={String(criticalCount)}
            color="#ef4444"
            pulse={true}
            onClick={() => setCriticalFilter(true)}
          />
        ) : null}
        {myReportsFilter ? (
          <StatPill
            icon={<span style={{ fontSize: '12px' }}>👤</span>}
            label="Showing my reports · ×"
            value=""
            color="#a855f7"
            pulse={false}
            onClick={() => setMyReportsFilter(false)}
          />
        ) : myReportsCount > 0 ? (
          <StatPill
            icon={<span style={{ fontSize: '12px' }}>👤</span>}
            label="My Reports"
            value={String(myReportsCount)}
            color="#a855f7"
            onClick={() => setMyReportsFilter(true)}
          />
        ) : null}
        <StatPill
          icon={<span style={{ fontSize: '12px' }}>📍</span>}
          label="Total"
          value={String(incidents.length)}
          color="#888"
        />
        <StatPill
          icon={<LinkIcon size={12} color="#22c55e" />}
          label="Verified On-Chain"
          value={String(verifiedCount)}
          color="#22c55e"
        />
        {!locationObtained && (
          <span style={{ fontSize: '11px', color: '#444', marginLeft: 'auto' }}>
            Allow location for accurate centering
          </span>
        )}
      </div>

      {/* Main area: map + feed */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <NearbyAlerts />
          <Map
            incidents={incidents}
            center={center}
            onIncidentClick={setSelectedIncident}
          />

          {/* Selected incident overlay */}
          {selectedIncident && (
            <div
              className="fade-in-up"
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(17, 17, 17, 0.95)',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                padding: '14px 18px',
                backdropFilter: 'blur(12px)',
                minWidth: '320px',
                maxWidth: '420px',
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px',
                }}
              >
                <SeverityBadge severity={selectedIncident.severity} pulse />
                <button
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '0',
                  }}
                >
                  ×
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', marginBottom: '8px' }}>
                {selectedIncident.description}
              </p>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
                {selectedIncident.location.address} ·{' '}
                {new Date(selectedIncident.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>

        {/* Feed sidebar */}
        <div
          style={{
            width: '320px',
            borderLeft: '1px solid #1a1a1a',
            background: '#0d0d0d',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <IncidentFeed
            incidents={incidents}
            onSelectIncident={(i) => {
              setSelectedIncident(i);
              setCenter([i.location.lat, i.location.lng]);
            }}
            selectedId={selectedIncident?.id}
            criticalFilter={criticalFilter}
            activeFilter={activeFilter}
            myReportsFilter={myReportsFilter}
            onResolveIncident={onResolveIncident}
            onDeleteIncident={onDeleteIncident}
          />
        </div>
      </div>
    </div>
  );
};

const StatPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
  onClick?: () => void;
}> = ({ icon, label, value, color, pulse, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '5px 12px',
      background: `${color}10`,
      border: `1px solid ${color}25`,
      borderRadius: '20px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s',
    }}
  >
    {icon}
    <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
    <span
      style={{
        fontSize: '13px',
        fontWeight: 700,
        color: color,
        fontFamily: 'monospace',
        ...(pulse && Number(value) > 0
          ? { textShadow: `0 0 10px ${color}` }
          : {}),
      }}
    >
      {value}
    </span>
  </div>
);
