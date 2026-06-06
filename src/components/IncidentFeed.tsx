// src/components/IncidentFeed.tsx

import React from 'react';
import { Clock, MapPin, AlertTriangle, CheckCircle, ExternalLink, X, Share, ChevronRight, ChevronDown, Loader2, Download, ThumbsUp } from 'lucide-react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Incident, IncidentType } from '../types/incident';
import { SeverityBadge, getSeverityColor } from './SeverityBadge';

interface IncidentFeedProps {
  incidents: Incident[];
  onSelectIncident?: (incident: Incident) => void;
  selectedId?: string;
  criticalFilter?: boolean;
  activeFilter?: boolean;
  myReportsFilter?: boolean;
  onResolveIncident?: (id: string) => void;
  onDeleteIncident?: (id: string) => void;
  hideHeader?: boolean;
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

// ── Community Confirm helpers ────────────────────────────────
function getConfirmKey(incidentId: string, walletAddress: string) {
  return `confirm_${incidentId}_${walletAddress}`;
}
function getConfirmCountKey(incidentId: string) {
  return `confirmcount_${incidentId}`;
}
function useConfirmation(incidentId: string, walletAddress: string | undefined) {
  const [confirmed, setConfirmed] = React.useState(() => {
    if (!walletAddress) return false;
    return localStorage.getItem(getConfirmKey(incidentId, walletAddress)) === '1';
  });
  const [count, setCount] = React.useState(() => {
    return parseInt(localStorage.getItem(getConfirmCountKey(incidentId)) || '0', 10);
  });

  const toggle = React.useCallback(() => {
    if (!walletAddress) return;
    if (confirmed) {
      // Un-confirm
      localStorage.removeItem(getConfirmKey(incidentId, walletAddress));
      const newCount = Math.max(0, count - 1);
      localStorage.setItem(getConfirmCountKey(incidentId), String(newCount));
      setConfirmed(false);
      setCount(newCount);
    } else {
      // Confirm
      localStorage.setItem(getConfirmKey(incidentId, walletAddress), '1');
      const newCount = count + 1;
      localStorage.setItem(getConfirmCountKey(incidentId), String(newCount));
      setConfirmed(true);
      setCount(newCount);
    }
  }, [walletAddress, confirmed, incidentId, count]);

  return { confirmed, count, confirm: toggle };
}

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents,
  onSelectIncident,
  selectedId,
  criticalFilter,
  activeFilter,
  myReportsFilter,
  onResolveIncident,
  onDeleteIncident,
  hideHeader = false,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const modalAccount = useCurrentAccount();
  const [modalIncident, setModalIncident] = React.useState<Incident | null>(null);
  const [showProof, setShowProof] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const [walrusFetchState, setWalrusFetchState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [walrusData, setWalrusData] = React.useState<string | null>(null);
  const [walrusFetchError, setWalrusFetchError] = React.useState<string | null>(null);
  const [modalConfirmCount, setModalConfirmCount] = React.useState(0);
  const [modalConfirmed, setModalConfirmed] = React.useState(false);

  // Listen for external requests to open the incident modal (e.g. from Dashboard selectedIncident)
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
        // Load confirm state for this incident
        const addr = modalAccount?.address;
        if (addr) {
          setModalConfirmed(localStorage.getItem(getConfirmKey(customEvent.detail.id, addr)) === '1');
        } else {
          setModalConfirmed(false);
        }
        setModalConfirmCount(parseInt(localStorage.getItem(getConfirmCountKey(customEvent.detail.id)) || '0', 10));
      }
    };
    window.addEventListener('openIncidentModal', handleOpenModal);
    return () => window.removeEventListener('openIncidentModal', handleOpenModal);
  }, [modalAccount]);

  React.useEffect(() => {
    if (criticalFilter && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [criticalFilter]);

  let displayedIncidents = incidents;
  if (criticalFilter) {
    displayedIncidents = displayedIncidents.filter((i) => i.severity === 'critical');
  }
  if (activeFilter) {
    displayedIncidents = displayedIncidents.filter((i) => i.status === 'active');
  }
  if (myReportsFilter) {
    displayedIncidents = displayedIncidents.filter((i) => i.createdByMe);
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
                    setShowProof(false);
                    setIsCopied(false);
                    setWalrusFetchState('idle');
                    setWalrusData(null);
                    setWalrusFetchError(null);
                    // Load confirm state for this incident
                    const addr = modalAccount?.address;
                    if (addr) {
                      setModalConfirmed(localStorage.getItem(getConfirmKey(incident.id, addr)) === '1');
                    } else {
                      setModalConfirmed(false);
                    }
                    setModalConfirmCount(parseInt(localStorage.getItem(getConfirmCountKey(incident.id)) || '0', 10));
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
        }} onClick={() => { setModalIncident(null); setShowProof(false); }}>
          <div style={{
            background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '16px',
            width: '100%', maxWidth: '480px', position: 'relative', overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => { setModalIncident(null); setShowProof(false); }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{TYPE_ICONS[modalIncident.type]}</span>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>{TYPE_LABELS[modalIncident.type]}</h2>
                  <SeverityBadge severity={modalIncident.severity} />
                </div>
                <div style={{ fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {formatRelativeTime(modalIncident.timestamp)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {modalIncident.location.address}</span>
                </div>
              </div>

              {/* Warning Banner */}
              {(modalIncident.severity === 'critical' || modalIncident.severity === 'high') ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>
                  <AlertTriangle size={16} /> ⚠️ Stay clear of this area
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '8px', color: '#eab308', fontSize: '14px', fontWeight: 600 }}>
                  <AlertTriangle size={16} /> ℹ️ Be cautious in this area
                </div>
              )}

              {/* Description */}
              <p style={{ fontSize: '15px', color: '#ddd', lineHeight: 1.6, margin: 0 }}>
                {modalIncident.description}
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: isCopied ? '#4ade80' : '#ccc', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'color 0.2s' }}
                >
                  {isCopied ? (
                    <><CheckCircle size={14} /> Copied</>
                  ) : (
                    <><Share size={14} /> Share Incident</>
                  )}
                </button>

                {/* Modal Confirm button — hide on own incidents and resolved */}
                {modalAccount && modalAccount.address !== modalIncident.reporter && modalIncident.status !== 'resolved' && (
                  <button
                    onClick={() => {
                      if (!modalAccount?.address) return;
                      if (modalConfirmed) {
                        // Un-confirm
                        localStorage.removeItem(getConfirmKey(modalIncident.id, modalAccount.address));
                        const newCount = Math.max(0, modalConfirmCount - 1);
                        localStorage.setItem(getConfirmCountKey(modalIncident.id), String(newCount));
                        setModalConfirmed(false);
                        setModalConfirmCount(newCount);
                      } else {
                        // Confirm
                        localStorage.setItem(getConfirmKey(modalIncident.id, modalAccount.address), '1');
                        const newCount = modalConfirmCount + 1;
                        localStorage.setItem(getConfirmCountKey(modalIncident.id), String(newCount));
                        setModalConfirmed(true);
                        setModalConfirmCount(newCount);
                      }
                    }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: modalConfirmed ? 'rgba(59,130,246,0.15)' : '#1a1a1a', border: modalConfirmed ? '1px solid rgba(59,130,246,0.4)' : '1px solid #2a2a2a', borderRadius: '8px', color: modalConfirmed ? '#60a5fa' : '#ccc', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
                  >
                    <ThumbsUp size={14} />
                    <span>{modalConfirmed ? '✓ Confirmed' : 'Confirm'}</span>
                    <span style={{
                      background: modalConfirmed ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
                      color: modalConfirmed ? '#93c5fd' : '#888',
                      borderRadius: '10px',
                      padding: '0px 7px',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      minWidth: '20px',
                      textAlign: 'center',
                      lineHeight: '18px',
                    }}>
                      {modalConfirmCount}
                    </span>
                  </button>
                )}
                {modalIncident.createdByMe && modalIncident.status === 'active' && onResolveIncident && (
                  <button 
                    onClick={() => {
                      onResolveIncident(modalIncident.id);
                      setModalIncident({ ...modalIncident, status: 'resolved' });
                    }} 
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#22c55e', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.2s' }}
                  >
                    <CheckCircle size={14} /> Mark as Resolved
                  </button>
                )}
                {modalIncident.createdByMe && onDeleteIncident && (
                  <button 
                    onClick={() => {
                      onDeleteIncident(modalIncident.id);
                      setModalIncident(null);
                    }} 
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.2s' }}
                  >
                    <X size={14} /> Delete
                  </button>
                )}
              </div>

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
                                const res = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${modalIncident.walrusBlobId}`);
                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                const text = await res.text();
                                setWalrusData(text);
                                setWalrusFetchState('done');
                              } catch (err: any) {
                                setWalrusFetchError(err.message || 'Failed to fetch');
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
                              {walrusData}
                            </pre>
                          )}

                          {walrusFetchState === 'error' && walrusFetchError && (
                            <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '11px' }}>
                              Failed to fetch: {walrusFetchError}
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
  isSelected: _isSelected,
  onClick,
  animDelay,
}) => {
  const isHigh = incident.severity === 'high';
  const isCritical = incident.severity === 'critical';
  const highlightColor = isCritical ? '#ef4444' : isHigh ? '#f97316' : null;

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [resolving, setResolving] = React.useState(false);
  const [resolvedLocal, setResolvedLocal] = React.useState(incident.status === 'resolved');
  const { confirmed, count: confirmCount, confirm } = useConfirmation(incident.id, account?.address);

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
      className="fade-in-up"
      style={{
        animationDelay: `${animDelay}ms`,
        padding: '14px 4px',
        borderRadius: '0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
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
      {(incident.suiTxDigest || incident.walrusBlobId || confirmCount >= 3) && (
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
          {confirmCount >= 3 && (
            <span style={{
              fontSize: '10px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '2px 6px',
              borderRadius: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <ThumbsUp size={10} /> Community Verified
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

      {/* Community Confirm button — hide on own incidents and resolved */}
      {account && account.address !== incident.reporter && !resolvedLocal && (
        <button
          onClick={(e) => { e.stopPropagation(); confirm(); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px 3px 10px',
            marginBottom: '8px',
            border: confirmed
              ? '1px solid rgba(59,130,246,0.5)'
              : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            background: confirmed
              ? 'rgba(59,130,246,0.12)'
              : 'rgba(255,255,255,0.04)',
            color: confirmed ? '#60a5fa' : '#666',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <ThumbsUp size={11} />
          <span>{confirmed ? '✓ Confirmed' : 'Confirm'}</span>
          {/* Count badge */}
          <span style={{
            background: confirmed ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
            color: confirmed ? '#93c5fd' : '#555',
            borderRadius: '10px',
            padding: '0px 6px',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'monospace',
            minWidth: '18px',
            textAlign: 'center',
            lineHeight: '16px',
          }}>
            {confirmCount}
          </span>
        </button>
      )}

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
          {resolvedLocal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '11px', fontWeight: 600, background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              <CheckCircle size={11} /> Resolved
            </div>
          ) : (
            account?.address === incident.reporter && incident.suiObjectId && (
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
