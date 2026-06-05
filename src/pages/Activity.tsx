// src/pages/Activity.tsx
// Wallet Activity Feed — shows all incidents reported by the connected wallet

import React, { useMemo } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import type { Incident } from '../types/incident';
import { SeverityBadge, getSeverityColor } from '../components/SeverityBadge';
import {
  User,
  MapPin,
  Clock,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  Database,
  Activity as ActivityIcon,
  FileText,
  Loader2,
} from 'lucide-react';

interface ActivityProps {
  incidents: Incident[];
  onNavigateReport?: () => void;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌪️',
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

export const Activity: React.FC<ActivityProps> = ({ incidents, onNavigateReport }) => {
  const account = useCurrentAccount();
  const address = account?.address;

  const myIncidents = useMemo(
    () =>
      incidents
        .filter((i) => i.reporter === address || i.createdByMe)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [incidents, address]
  );

  const activeCount = myIncidents.filter((i) => i.status === 'active').length;
  const resolvedCount = myIncidents.filter((i) => i.status === 'resolved').length;
  const blobCount = myIncidents.filter((i) => !!i.walrusBlobId).length;

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : '';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Page header */}
      <div
        style={{
          padding: '14px 180px 14px 20px',
          borderBottom: '1px solid #1a1a1a',
          background: '#0d0d0d',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <User size={16} color="#8b5cf6" />
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
              My Incidents
            </span>
            {shortAddr && (
              <div style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace', marginTop: '2px' }}>
                {shortAddr}
              </div>
            )}
          </div>
        </div>
        {/* Wallet badge */}
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
              display: 'inline-block',
            }}
          />
          WALLET CONNECTED
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-5 md:px-6"
        style={{ background: '#0a0a0a', flexShrink: 0 }}
      >
        <StatCard
          icon={<FileText size={14} color="#8b5cf6" />}
          label="Total Reported"
          value={String(myIncidents.length)}
          color="#8b5cf6"
        />
        <StatCard
          icon={<ActivityIcon size={14} color="#3b82f6" />}
          label="Active"
          value={String(activeCount)}
          color="#3b82f6"
        />
        <StatCard
          icon={<CheckCircle size={14} color="#22c55e" />}
          label="Resolved"
          value={String(resolvedCount)}
          color="#22c55e"
        />
        <StatCard
          icon={<Database size={14} color="#a78bfa" />}
          label="Walrus Blobs"
          value={String(blobCount)}
          color="#a78bfa"
        />
      </div>

      {/* Incident list */}
      <div className="px-6 pt-2 pb-[120px] md:pb-6" style={{ flex: 1, overflowY: 'auto' }}>
        {myIncidents.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '280px',
              gap: '16px',
              color: '#444',
            }}
          >
            <AlertTriangle size={40} strokeWidth={1} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                You haven't reported any incidents yet
              </p>
              <p style={{ fontSize: '12px', color: '#3a3a3a' }}>
                Help your community by reporting what you see
              </p>
            </div>
            <button
              onClick={onNavigateReport}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
              }}
            >
              <AlertTriangle size={14} />
              Report Incident
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {myIncidents.map((incident, idx) => (
              <ActivityCard
                key={incident.id}
                incident={incident}
                index={idx}
                isLast={idx === myIncidents.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Activity Card ────────────────────────────────────────────
const ActivityCard: React.FC<{ incident: Incident; index: number; isLast?: boolean }> = ({
  incident,
  index,
  isLast,
}) => {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [resolving, setResolving] = React.useState(false);
  const [resolvedLocal, setResolvedLocal] = React.useState(incident.status === 'resolved');
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
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

  const color = getSeverityColor(incident.severity);
  const walrusScanUrl = incident.walrusBlobId
    ? `https://walruscan.com/testnet/blob/${incident.walrusBlobId}`
    : null;

  return (
    <div
      className="fade-in-up"
      style={{
        background: hovered ? 'rgba(255,255,255,0.025)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        padding: '16px 4px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        animationDelay: `${index * 30}ms`,
        transition: 'background 0.15s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        window.history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new Event('popstate'));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('selectIncident', { detail: incident }));
        }, 100);
      }}
    >
      {/* Type icon */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {TYPE_ICONS[incident.type] || '⚠️'}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
            {TYPE_LABELS[incident.type] || incident.type}
          </span>
          <SeverityBadge severity={incident.severity} size="sm" />
          {resolvedLocal ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#22c55e',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.25)',
                padding: '2px 7px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <CheckCircle size={10} /> Resolved
            </span>
          ) : (
            incident.suiObjectId && (
              <button
                onClick={handleResolve}
                disabled={resolving}
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: '#22c55e',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  cursor: resolving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {resolving ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                {resolving ? 'Resolving…' : 'Resolve'}
              </button>
            )
          )}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '10px',
              color: '#555',
              fontFamily: 'monospace',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={10} /> {timeAgo(incident.timestamp)}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '12px',
            color: '#777',
            lineHeight: '1.45',
            marginBottom: '7px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {incident.description}
        </p>

        {/* Footer row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: '#555',
            }}
          >
            <MapPin size={10} /> {incident.location.address}
          </span>

          {walrusScanUrl && (
            <a
              href={walrusScanUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#8b5cf6',
                textDecoration: 'none',
                fontFamily: 'monospace',
                fontWeight: 600,
                background: 'rgba(139,92,246,0.08)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(139,92,246,0.2)',
                flexShrink: 0,
              }}
            >
              <ExternalLink size={9} /> View on WalrusScan
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    style={{
      background: '#111',
      borderRadius: '12px',
      padding: '20px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {icon}
      <span style={{ fontSize: '11px', color: '#555', fontWeight: 500 }}>{label}</span>
    </div>
    <span
      style={{
        fontSize: '22px',
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
