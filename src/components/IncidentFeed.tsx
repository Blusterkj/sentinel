// src/components/IncidentFeed.tsx

import React from 'react';
import ReactDOM from 'react-dom';
import { useNow } from '../hooks/useNow';
import { Clock, MapPin, AlertTriangle, CheckCircle, ExternalLink, X, Share, ChevronRight, ChevronDown, Loader2, Download, AlertCircle } from 'lucide-react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAuthStore } from '../lib/authStore';
import { Transaction } from '@mysten/sui/transactions';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Incident, IncidentType } from '../types/incident';
import { SeverityBadge, getSeverityColor } from './SeverityBadge';
import { PROXY_URL } from '../lib/api';


interface IncidentFeedProps {
  incidents: Incident[];
  onSelectIncident?: (incident: Incident) => void;
  selectedId?: string;
  criticalFilter?: boolean;
  activeFilter?: boolean;
  myReportsFilter?: boolean;
  onResolveIncident?: (id: string) => void;
  onFlagIncident?: (updated: Incident) => void;
  hideHeader?: boolean;
}

const TYPE_ICONS: Record<IncidentType, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌩️',
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

// Accept a pre-computed `now` so all cards share one interval tick
function formatRelativeTime(timestamp: string, now: number): string {
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getSafetyMessage(type: string, severity: string): string {
  const t = type?.toLowerCase();
  if (t === 'sos' || t === 'panic') return '🚨 User needs immediate help — call 112 or assist now';
  if (t === 'medical') return '🏥 Call emergency services immediately (112)';
  if (t === 'fire') return '🔥 Stay clear — evacuate the area immediately';
  if (t === 'crime') return '🚔 Do not approach — contact police immediately';
  if (t === 'accident') return '🚑 Clear the road — emergency services needed';
  if (t === 'natural' || t === 'natural disaster') return '⛈️ Move to higher ground / safe shelter now';
  if (severity?.toLowerCase() === 'critical') return '🚨 Critical situation — take immediate action';
  return '⚠️ Stay alert and exercise caution in this area';
}

// ── Flag as Spam button ──────────────────────────────
interface FlagButtonProps {
  incident: Incident;
  onFlagIncident?: (updated: Incident) => void;
  variant?: 'feed' | 'modal'; // 'modal' = full-size matching Share button
}

const FlagButton: React.FC<FlagButtonProps> = ({ incident, onFlagIncident, variant = 'feed' }) => {
  const account = useCurrentAccount();
  const { address: inAppAddress } = useAuthStore();
  const walletAddress = account?.address || inAppAddress;

  // Initialize from incident.flaggedByMe so modal and feed share the same flag state
  const [localFlagged, setLocalFlagged] = React.useState<boolean | null>(
    incident.flaggedByMe !== undefined ? incident.flaggedByMe : null
  );
  const [localCount, setLocalCount] = React.useState(incident.flagCount ?? 0);
  const [busy, setBusy] = React.useState(false);

  // Sync count when incident prop updates (e.g. after WS push), but don't override localFlagged
  React.useEffect(() => {
    if (localFlagged === null) {
      setLocalCount(incident.flagCount ?? 0);
    }
  }, [incident.flagCount, localFlagged]);

  if (!walletAddress) return null;

  const hasFlagged = localFlagged !== null ? localFlagged : false;

  const handleFlag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    // Optimistic update
    const nextFlagged = !hasFlagged;
    setLocalFlagged(nextFlagged);
    setLocalCount((c) => nextFlagged ? c + 1 : Math.max(0, c - 1));
    try {
      const res = await fetch(`${PROXY_URL}/api/unflag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: incident.id, walletAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.incident) {
          setLocalCount(data.incident.flagCount ?? localCount);
          // Propagate flaggedByMe so any new FlagButton instance initializes correctly
          onFlagIncident?.({
            ...data.incident as Incident,
            flaggedByMe: nextFlagged,
          });
        }
      }
    } catch {
      // Revert on error
      setLocalFlagged(hasFlagged);
      setLocalCount((c) => nextFlagged ? Math.max(0, c - 1) : c + 1);
    } finally {
      setBusy(false);
    }
  };

  if (hasFlagged) {
    const modalStyle: React.CSSProperties = variant === 'modal' ? {
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '8px', padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a',
      borderRadius: '8px', color: '#4ade80', fontSize: '13px', fontWeight: 600,
      cursor: busy ? 'not-allowed' : 'pointer', transition: 'color 0.2s',
    } : {
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px',
      marginBottom: '6px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '5px',
      background: 'transparent', color: '#444', fontSize: '10px', fontWeight: 500,
      cursor: busy ? 'not-allowed' : 'pointer', transition: 'color 0.15s', letterSpacing: '0.01em',
    };
    return (
      <button onClick={handleFlag} disabled={busy} style={modalStyle}>
        {variant === 'modal'
          ? <><CheckCircle size={14} /> Flagged ({localCount})</>
          : <><span style={{ fontSize: '10px' }}>✓</span><span>Flagged ({localCount})</span></>}
      </button>
    );
  }

  const modalUnflaggedStyle: React.CSSProperties = variant === 'modal' ? {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: '8px', color: '#ccc', fontSize: '13px', fontWeight: 600,
    cursor: busy ? 'not-allowed' : 'pointer', transition: 'color 0.2s',
  } : {
    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px',
    marginBottom: '6px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '5px',
    background: 'transparent', color: '#555', fontSize: '10px', fontWeight: 500,
    cursor: busy ? 'not-allowed' : 'pointer', transition: 'color 0.15s', letterSpacing: '0.01em',
  };

  return (
    <button
      onClick={handleFlag}
      disabled={busy}
      style={modalUnflaggedStyle}
      onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.color = variant === 'modal' ? '#fff' : '#888'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = variant === 'modal' ? '#ccc' : '#555'; }}
    >
      {variant === 'modal'
        ? <><span>🚩</span> Flag as Spam ({localCount})</>
        : <><span style={{ fontSize: '10px' }}>🚩</span><span>Flag as Spam ({localCount})</span></>}
    </button>
  );
};

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents,
  onSelectIncident,
  selectedId,
  criticalFilter,
  activeFilter,
  myReportsFilter,
  onResolveIncident,
  onFlagIncident,
  hideHeader = false,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const modalAccount = useCurrentAccount();
  const { address: modalInAppAddress } = useAuthStore();
  const [modalIncident, setModalIncident] = React.useState<Incident | null>(null);
  const [showProof, setShowProof] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const [walrusFetchState, setWalrusFetchState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [walrusData, setWalrusData] = React.useState<string | null>(null);
  const [walrusFetchError, setWalrusFetchError] = React.useState<string | null>(null);
  const [markedFalseAlarm, setMarkedFalseAlarm] = React.useState<string | null>(null);

  const isOwner = React.useMemo(() => {
    if (!modalIncident) return false;
    const reporter = (modalIncident.reportedBy || modalIncident.reporter || '').toLowerCase();
    const externalMatch = modalAccount?.address?.toLowerCase() === reporter;
    const inAppMatch = modalInAppAddress?.toLowerCase() === reporter;
    return modalIncident.createdByMe || externalMatch || inAppMatch;
  }, [modalIncident, modalAccount, modalInAppAddress]);

  // Listen for external requests to open or close the incident modal
  React.useEffect(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent<Incident>;
      if (customEvent.detail) {
        setModalIncident(customEvent.detail);
        setShowProof(false);
        setIsCopied(false);
        setWalrusFetchState('idle');
        setWalrusData(null);
        setWalrusFetchError(null);
      }
    };
    const handleCloseModal = () => {
      setModalIncident(null);
      setShowProof(false);
    };
    window.addEventListener('openIncidentModal', handleOpenModal);
    window.addEventListener('closeIncidentModal', handleCloseModal);
    return () => {
      window.removeEventListener('openIncidentModal', handleOpenModal);
      window.removeEventListener('closeIncidentModal', handleCloseModal);
    };
  }, [modalAccount, modalInAppAddress]);

  React.useEffect(() => {
    if (criticalFilter && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [criticalFilter]);

  let displayedIncidents = incidents;
  const now = useNow(); // one interval for all cards
  if (criticalFilter) {
    displayedIncidents = displayedIncidents.filter((i) => i.severity === 'critical');
  }
  if (activeFilter) {
    displayedIncidents = displayedIncidents.filter((i) => i.status === 'active');
  }
  if (myReportsFilter) {
    const address = modalAccount?.address || modalInAppAddress;
    displayedIncidents = displayedIncidents.filter((i) => {
      if (i.createdByMe) return true;
      if (address && (
        (i.reportedBy && i.reportedBy.toLowerCase() === address.toLowerCase()) ||
        (i.reporter && i.reporter.toLowerCase() === address.toLowerCase())
      )) return true;
      return false;
    });
  }

  return (
    <div className="h-full flex flex-col" style={{ overflow: 'hidden' }}>
      {/* Header — hidden when used inside BottomSheet (which has its own header) */}
      {!hideHeader && (
      <div
        style={{
          padding: '16px 20px',
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
      )}

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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...displayedIncidents]
              .sort(
                (a, b) =>
                  new Date(b.timestamp ?? b.createdAt).getTime() -
                  new Date(a.timestamp ?? a.createdAt).getTime()
              )
              .map((incident, idx) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  now={now}
                  isSelected={selectedId === incident.id}
                  onClick={() => {
                    onSelectIncident?.(incident);
                    setModalIncident(incident);
                    setShowProof(false);
                    setIsCopied(false);
                    setWalrusFetchState('idle');
                    setWalrusData(null);
                    setWalrusFetchError(null);
                  }}
                  animDelay={idx * 50}
                  onFlagIncident={onFlagIncident}
                />
              ))}
          </div>
        )}
      </div>

      {modalIncident && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(4px)'
        }}
          onClick={() => window.dispatchEvent(new CustomEvent('closeIncidentModal'))}
        >
          <div className="animate-in fade-in zoom-in-95 duration-200 ease-out" style={{
            background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '16px',
            width: '100%', maxWidth: '480px', maxHeight: '90vh', position: 'relative', overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
          }}
            onClick={e => e.stopPropagation()}
          >
            {/* Map Header */}
            <div style={{ width: '100%', height: '140px', background: '#1a1a1a', position: 'relative' }}>
              <a 
                href={`https://www.google.com/maps?q=${modalIncident.location.lat},${modalIncident.location.lng}`}
                target="_blank" 
                rel="noreferrer"
                style={{ display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
              >
                <MapContainer
                  center={[modalIncident.location.lat, modalIncident.location.lng]}
                  zoom={15}
                  style={{ height: '100%', width: '100%', background: '#0d1117' }}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  keyboard={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />
                  {(() => {
                    const color = getSeverityColor(modalIncident.severity);
                    const customIcon = L.divIcon({
                      html: `<div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: ${color}33;
                        border: 2px solid ${color};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        box-shadow: 0 0 20px ${color}99;
                        backdrop-filter: blur(4px);
                      ">${TYPE_ICONS[modalIncident.type]}</div>`,
                      className: '', // Prevents default leaflet styling
                      iconSize: [32, 32],
                      iconAnchor: [16, 16],
                    });
                    return (
                      <Marker
                        position={[modalIncident.location.lat, modalIncident.location.lng]}
                        icon={customIcon}
                      />
                    );
                  })()}
                </MapContainer>
              </a>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, #0d0d0d, transparent)', pointerEvents: 'none' }} />
              <button onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('closeIncidentModal')); }} className="hover:rotate-90 hover:scale-110 transition-transform duration-200" style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Header Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{TYPE_ICONS[modalIncident.type]}</span>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {TYPE_LABELS[modalIncident.type]}
                    {modalIncident.status === 'resolved' && markedFalseAlarm !== modalIncident.id && (
                      <span title="Resolved"><CheckCircle size={18} color="#22c55e" strokeWidth={2.5} /></span>
                    )}
                    {modalIncident.status === 'resolved' && markedFalseAlarm === modalIncident.id && (
                      <span title="Marked as False Alarm"><AlertCircle size={18} color="#eab308" strokeWidth={2.5} /></span>
                    )}
                  </h2>
                  <SeverityBadge severity={modalIncident.severity} pulse={true} />
                </div>
                <div style={{ fontSize: '13px', color: '#888', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <Clock size={12} style={{ marginTop: '3px', flexShrink: 0 }} /> 
                    <span>{formatRelativeTime(modalIncident.timestamp ?? modalIncident.createdAt, now)}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={12} style={{ marginTop: '3px', flexShrink: 0 }} /> 
                    <span>{modalIncident.location.address}</span>
                  </span>
                </div>
              </div>

              {/* Warning Banner */}
              {(modalIncident.severity === 'critical' || modalIncident.severity === 'high') ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>
                  {getSafetyMessage(modalIncident.type, modalIncident.severity)}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '8px', color: '#eab308', fontSize: '14px', fontWeight: 600 }}>
                  {getSafetyMessage(modalIncident.type, modalIncident.severity)}
                </div>
              )}

              {/* Description */}
              <p style={{ fontSize: '15px', color: '#ddd', lineHeight: 1.6, margin: 0 }}>
                {modalIncident.description}
              </p>

              {/* Action buttons — stable fixed layout, no reflow on state change */}
              {/* Row 1: Share + Flag */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => {
                    const mapLink = `https://www.google.com/maps?q=${modalIncident.location.lat},${modalIncident.location.lng}`;
                    const text = `${TYPE_LABELS[modalIncident.type]} at ${modalIncident.location.address}\n\nLocation: ${mapLink}`;
                    if (navigator.share) {
                      navigator.share({ title: 'Sentinel Alert', text }).catch(console.error);
                    } else {
                      navigator.clipboard.writeText(text);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: isCopied ? '#4ade80' : '#ccc', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'color 0.2s', whiteSpace: 'nowrap' }}
                >
                  {isCopied ? <><CheckCircle size={14} /> Copied</> : <><Share size={14} /> Share</>}
                </button>

                {/* Flag as Spam — full-size modal variant, no wrapper div */}
                <FlagButton
                  incident={modalIncident}
                  variant="modal"
                  onFlagIncident={(updated) => {
                    onFlagIncident?.(updated);
                    setModalIncident((prev) => prev ? { ...prev, flagCount: updated.flagCount, flaggedByMe: updated.flaggedByMe } : prev);
                  }}
                />
              </div>

              {/* Row 2: Resolve + False Alarm (only when applicable) */}
              {isOwner && (
                <>
                  {modalIncident.status === 'active' && onResolveIncident && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <button
                        onClick={() => { onResolveIncident(modalIncident.id); setModalIncident({ ...modalIncident, status: 'resolved' }); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        <CheckCircle size={14} /> Resolve
                      </button>
                      <button
                        onClick={() => {
                          onResolveIncident(modalIncident.id);
                          setMarkedFalseAlarm(modalIncident.id);
                          setModalIncident({ ...modalIncident, status: 'resolved' });
                        }}
                        className="bg-yellow-900/40 text-yellow-400 border border-yellow-800 hover:bg-yellow-900/60 transition-all duration-200"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        ⚠️ Resolve as False Alarm
                      </button>
                    </div>
                  )}
                  {/* False alarm UI moved to header */}
                </>
              )}

              {/* Blockchain Proof (Collapsible) */}
              {(modalIncident.walrusBlobId || modalIncident.suiTxDigest) ? (
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px', marginTop: '4px' }}>
                  <button 
                    onClick={() => setShowProof(!showProof)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    {showProof ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {modalIncident.walrusBlobId ? '⬡ Verified on Walrus Blockchain' : '⛓ Verified on Sui'}
                  </button>
                  
                  {showProof && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#111', borderRadius: '8px', border: '1px solid #1a1a1a', fontSize: '12px', color: '#888' }}>
                      {/* Walrus Blob ID + Fetch button */}
                      {modalIncident.walrusBlobId && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span>Blob ID:</span>
                            <span style={{ fontFamily: 'monospace', color: '#a78bfa', fontSize: '11px' }}>
                              {modalIncident.walrusBlobId.slice(0, 12)}...{modalIncident.walrusBlobId.slice(-8)}
                            </span>
                          </div>

                          {/* View on WalrusScan */}
                          <a 
                            href={`https://walruscan.com/testnet/blob/${modalIncident.walrusBlobId}`}
                            target="_blank" 
                            rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a78bfa', textDecoration: 'none', marginBottom: '10px', fontSize: '12px' }}
                          >
                            <ExternalLink size={12} /> View on WalrusScan
                          </a>

                          {/* Fetch from Walrus Aggregator */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setWalrusFetchState('loading');
                              setWalrusData(null);
                              setWalrusFetchError(null);
                              try {
                                  let blobIdToFetch = modalIncident.walrusBlobId;
                                  let res = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobIdToFetch}`);
                                  
                                  if (!res.ok) {
                                    if (res.status === 404) {
                                      const ageMs = Date.now() - new Date(modalIncident.createdAt || modalIncident.timestamp).getTime();
                                      if (ageMs > 5 * 60 * 1000) {
                                        // Auto-heal: blob expired, reblob it!
                                        setWalrusFetchError('Blob expired — re-uploading to Walrus...');
                                        const reblobRes = await fetch(`${PROXY_URL}/api/reblob`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ incidentId: modalIncident.id })
                                        });
                                        const reblobData = await reblobRes.json();
                                        if (reblobData.success && reblobData.newBlobId) {
                                          blobIdToFetch = reblobData.newBlobId;
                                          setModalIncident({ ...modalIncident, walrusBlobId: blobIdToFetch });
                                          
                                          // Retry fetch with new blob
                                          res = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobIdToFetch}`);
                                          if (!res.ok) {
                                            throw new Error('Blob not yet propagated to all nodes — please try again in 30 seconds');
                                          }
                                        } else {
                                          throw new Error(reblobData.error || 'Failed to re-upload blob');
                                        }
                                      } else {
                                        throw new Error('Blob not yet propagated to all nodes — please try again in 30 seconds');
                                      }
                                    } else if (res.status === 403) {
                                      throw new Error('Access restricted on this node — try View on WalrusScan instead');
                                    } else {
                                      throw new Error(`HTTP ${res.status} — try View on WalrusScan instead`);
                                    }
                                  }
                                  
                                  const text = await res.text();
                                  setWalrusData(text);
                                  setWalrusFetchState('done');
                                  setWalrusFetchError(null);
                                } catch (err: any) {
                                  const msg = err?.message || '';
                                  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
                                    setWalrusFetchError('Network error — check your connection');
                                  } else {
                                    setWalrusFetchError(msg || 'Unknown error — try View on WalrusScan instead');
                                  }
                                  setWalrusFetchState('error');
                                }
                            }}
                            disabled={walrusFetchState === 'loading'}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '8px',
                              background: 'rgba(139, 92, 246, 0.08)',
                              border: '1px solid rgba(139, 92, 246, 0.25)',
                              borderRadius: '6px',
                              color: '#a78bfa',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: walrusFetchState === 'loading' ? 'wait' : 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {walrusFetchState === 'loading' ? (
                              <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Fetching from Walrus…</>
                            ) : walrusFetchState === 'done' ? (
                              <><CheckCircle size={12} /> Data verified — fetched from Walrus</>
                            ) : (
                              <><Download size={12} /> Fetch raw data from Walrus</>
                            )}
                          </button>

                          {/* Display fetched data */}
                          {walrusFetchState === 'done' && walrusData && (
                            <pre style={{
                              marginTop: '10px',
                              padding: '10px',
                              background: '#0a0a0a',
                              border: '1px solid rgba(139, 92, 246, 0.2)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              color: '#ccc',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              maxHeight: '180px',
                              overflowY: 'auto',
                              lineHeight: '1.5',
                              fontFamily: 'monospace',
                            }}>
                              {(() => {
                                try { return JSON.stringify(JSON.parse(walrusData), null, 2); }
                                catch { return walrusData; }
                              })()}
                            </pre>
                          )}

                          {walrusFetchState === 'error' && walrusFetchError && (
                            <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '11px' }}>
                              {walrusFetchError}
                            </div>
                          )}
                        </>
                      )}

                      {/* Sui Explorer link — only for real transactions */}
                      {modalIncident.suiTxDigest && (
                        <>
                          {modalIncident.walrusBlobId && <div style={{ height: '1px', background: '#1a1a1a', margin: '10px 0' }} />}
                          <a href={`https://suiscan.xyz/testnet/tx/${modalIncident.suiTxDigest}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', textDecoration: 'none', fontSize: '12px' }}>
                            <ExternalLink size={12} /> View transaction on Sui Explorer
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#444' }}>⏳ Blockchain verification pending</span>
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

interface IncidentCardProps {
  incident: Incident;
  isSelected: boolean;
  onClick: () => void;
  animDelay: number;
  now: number;
  onFlagIncident?: (updated: Incident) => void;
}

const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  isSelected: _isSelected,
  onClick,
  animDelay,
  now,
  onFlagIncident,
}) => {
  const isHigh = incident.severity === 'high';
  const isCritical = incident.severity === 'critical';
  const highlightColor = isCritical ? '#ef4444' : isHigh ? '#f97316' : null;

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [resolving, setResolving] = React.useState(false);
  const [resolvedLocal, setResolvedLocal] = React.useState(incident.status === 'resolved');

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

  return (
    <div
      onClick={onClick}
      className={`fade-in-up transition-all duration-300 hover:-translate-y-1 hover:bg-white/5 border border-transparent border-b-white/5 ${
        isCritical ? 'hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:border-red-500/30' : 
        isHigh ? 'hover:shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:border-orange-500/30' : 
        'hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:border-blue-500/20'
      }`}
      style={{
        animationDelay: `${animDelay}ms`,
        padding: '14px 10px',
        borderRadius: '8px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '4px',
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
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: (incident.suiTxDigest || incident.walrusBlobId) ? '6px' : '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0, paddingRight: '8px' }}>
          <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>
            {TYPE_ICONS[incident.type]}
          </span>
          <span
            style={{ 
              fontSize: '13px', 
              fontWeight: 600, 
              color: '#ddd', 
              lineHeight: '1.3',
              wordBreak: 'break-word',
            }}
          >
            {TYPE_LABELS[incident.type]}
          </span>
        </div>
        <SeverityBadge severity={incident.severity} size="sm" pulse />
      </div>

      {/* Row 2: Verification Badges */}
      {(incident.suiTxDigest || incident.walrusBlobId) && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {incident.suiTxDigest && (
            <span style={{
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
          {!incident.suiTxDigest && incident.walrusBlobId && (
            <span style={{
              fontSize: '10px',
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#a78bfa',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              padding: '2px 6px',
              borderRadius: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              ⬡ Verified on Walrus
            </span>
          )}
        </div>
      )}

      {/* Description */}
      <p
        style={{
          fontSize: '12px',
          color: '#888',
          lineHeight: '1.5',
          marginBottom: '8px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {incident.description}
      </p>

      {/* Actions: Flag + Resolve status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <FlagButton incident={incident} onFlagIncident={onFlagIncident} />

        {resolvedLocal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '11px', fontWeight: 600, background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            <CheckCircle size={11} /> Resolved
          </div>
        ) : (
          account?.address === incident.reportedBy && incident.suiObjectId && (
            <button 
              onClick={handleResolve}
              disabled={resolving}
              style={{ 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid rgba(34, 197, 94, 0.3)', 
                color: '#22c55e', 
                fontSize: '11px', 
                fontWeight: 600, 
                padding: '2px 6px', 
                borderRadius: '4px',
                cursor: resolving ? 'not-allowed' : 'pointer'
              }}
            >
              {resolving ? '...' : 'Resolve'}
            </button>
          )
        )}
      </div>

      {/* Row 3: location + time */}
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
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {incident.location.address || 'Unknown location'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={11} color="#555" />
          <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
            {formatRelativeTime(incident.timestamp || incident.createdAt || '', now)}
          </span>
        </div>
      </div>
    </div>
  );
};
