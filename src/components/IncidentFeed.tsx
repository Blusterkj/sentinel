// src/components/IncidentFeed.tsx

import React from 'react';
import { Clock, MapPin, AlertTriangle, CheckCircle, Copy, ExternalLink, Brain, X } from 'lucide-react';
import type { Incident, IncidentType } from '../types/incident';
import { SeverityBadge } from './SeverityBadge';

interface IncidentFeedProps {
  incidents: Incident[];
  onSelectIncident?: (incident: Incident) => void;
  selectedId?: string;
  criticalFilter?: boolean;
}

const TYPE_ICONS: Record<IncidentType, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌪️',
  other: '⚠️',
};

const TYPE_LABELS: Record<IncidentType, string> = {
  medical: 'Medical Emergency',
  fire: 'Fire',
  crime: 'Crime',
  accident: 'Accident',
  natural_disaster: 'Natural Disaster',
  other: 'Other',
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents,
  onSelectIncident,
  selectedId,
  criticalFilter,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [modalIncident, setModalIncident] = React.useState<Incident | null>(null);

  React.useEffect(() => {
    if (criticalFilter && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [criticalFilter]);

  const displayedIncidents = criticalFilter
    ? incidents.filter((i) => i.severity === 'critical')
    : incidents;

  return (
    <div className="h-full flex flex-col" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1f1f1f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#e5e5e5' }}>
            Live Feed
          </span>
          {displayedIncidents.length > 0 && (
            <span
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '10px',
                padding: '1px 8px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {displayedIncidents.length}
            </span>
          )}
        </div>
        {/* Active count indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
          <span style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
            MONITORING
          </span>
        </div>
      </div>

      {/* Feed list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {displayedIncidents.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '12px',
              color: '#555',
            }}
          >
            <AlertTriangle size={32} />
            <span style={{ fontSize: '13px' }}>No incidents reported</span>
            <span style={{ fontSize: '11px', color: '#444', textAlign: 'center' }}>
              Incidents will appear here as they are reported
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...displayedIncidents]
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              )
              .map((incident, idx) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  isSelected={selectedId === incident.id}
                  onClick={() => {
                    onSelectIncident?.(incident);
                    setModalIncident(incident);
                  }}
                  animDelay={idx * 50}
                />
              ))}
          </div>
        )}
      </div>

      {modalIncident && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(4px)'
        }} onClick={() => setModalIncident(null)}>
          <div style={{
            background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '16px',
            width: '100%', maxWidth: '560px', padding: '24px', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalIncident(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>{TYPE_ICONS[modalIncident.type]}</span>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>{TYPE_LABELS[modalIncident.type]}</h2>
                <SeverityBadge severity={modalIncident.severity} />
              </div>
              <div style={{ fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(modalIncident.timestamp).toLocaleString()}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {modalIncident.location.address}</span>
              </div>
            </div>

            <div style={{ background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #1a1a1a' }}>
              <p style={{ fontSize: '14px', color: '#ddd', lineHeight: 1.6, margin: 0 }}>{modalIncident.description}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button onClick={() => navigator.clipboard.writeText(JSON.stringify(modalIncident, null, 2))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#ccc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <Copy size={14} /> Copy Details
              </button>
              {modalIncident.suiTxDigest ? (
                <a href={`https://suiscan.xyz/testnet/tx/${modalIncident.suiTxDigest}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#60a5fa', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                  <ExternalLink size={14} /> View on Sui Explorer
                </a>
              ) : (
                <button disabled style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#111', border: '1px solid #1a1a1a', borderRadius: '8px', color: '#555', fontSize: '13px', fontWeight: 600, cursor: 'not-allowed' }}>
                  Not Verified on Sui
                </button>
              )}
            </div>

            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Brain size={16} color="#8b5cf6" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5' }}>AI Agent Analysis</span>
              </div>
              {(() => {
                const similarCount = incidents.filter(i => i.type === modalIncident.type && i.id !== modalIncident.id).length;
                return (
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '13px', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>Threat Level:</strong> {modalIncident.severity.toUpperCase()} - Requires {modalIncident.severity === 'critical' ? 'immediate' : 'standard'} protocol execution.</li>
                <li><strong>Correlations:</strong> {similarCount} similar {modalIncident.type.replace('_', ' ')} incident{similarCount !== 1 ? 's' : ''} recorded in the system.</li>
                <li><strong>Recommendation:</strong> Dispatch nearest available {modalIncident.type === 'medical' ? 'EMS units' : 'response team'} and monitor area telemetry.</li>
              </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface IncidentCardProps {
  incident: Incident;
  isSelected: boolean;
  onClick: () => void;
  animDelay: number;
}

const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  isSelected,
  onClick,
  animDelay,
}) => {
  const isHigh = incident.severity === 'high';
  const isCritical = incident.severity === 'critical';
  const highlightColor = isCritical ? '#ef4444' : isHigh ? '#f97316' : null;
  const highlightBg = isCritical ? 'rgba(239, 68, 68, 0.05)' : isHigh ? 'rgba(249, 115, 22, 0.05)' : '#111';
  const highlightBorder = isCritical ? 'rgba(239, 68, 68, 0.25)' : isHigh ? 'rgba(249, 115, 22, 0.25)' : '#1f1f1f';

  return (
    <div
      onClick={onClick}
      className="fade-in-up"
      style={{
        animationDelay: `${animDelay}ms`,
        padding: '14px',
        borderRadius: '10px',
        border: isSelected
          ? '1px solid rgba(59, 130, 246, 0.5)'
          : highlightBorder,
        background: isSelected
          ? 'rgba(59, 130, 246, 0.08)'
          : highlightBg,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = '#1a1a1a';
          (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = highlightBg;
          (e.currentTarget as HTMLDivElement).style.borderColor = highlightBorder;
        }
      }}
    >
      {/* High severity left bar */}
      {highlightColor && (
        <div
          className="glow-high"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: highlightColor,
            borderRadius: '2px 0 0 2px',
          }}
        />
      )}

      {/* Row 1: type icon + label + severity */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>
            {TYPE_ICONS[incident.type]}
          </span>
          <span
            style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}
          >
            {TYPE_LABELS[incident.type]}
          </span>
          {incident.suiTxDigest && (
            <span style={{
              marginLeft: '6px',
              fontSize: '10px',
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              padding: '2px 6px',
              borderRadius: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              ⛓ Verified on Sui
            </span>
          )}
        </div>
        <SeverityBadge severity={incident.severity} size="sm" pulse />
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: '12px',
          color: '#888',
          lineHeight: '1.5',
          marginBottom: '10px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {incident.description}
      </p>

      {/* Row 3: location + time + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MapPin size={11} color="#555" />
          <span
            style={{
              fontSize: '11px',
              color: '#555',
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {incident.location.address || 'Unknown location'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {incident.status === 'resolved' ? (
            <CheckCircle size={11} color="#22c55e" />
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} color="#555" />
            <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
              {formatRelativeTime(incident.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
