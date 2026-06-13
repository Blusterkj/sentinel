// src/components/IncidentForm.tsx
// Form to report a new incident — stores it in MemWal and shows pattern analysis

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Search,
  CheckCircle,
  Link,
  Radio,
  Shield,
} from 'lucide-react';
import type { Incident, IncidentType, Severity } from '../types/incident';
import { v4 as uuidv4 } from 'uuid';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useAuthStore } from '../lib/authStore';
import { PROXY_URL } from '../lib/api';



interface IncidentFormProps {
  onIncidentSubmitted: (incident: Incident) => void;
}

const INCIDENT_TYPES: { value: IncidentType; label: string; icon: string }[] = [
  { value: 'medical', label: 'Medical Emergency', icon: '🏥' },
  { value: 'fire', label: 'Fire', icon: '🔥' },
  { value: 'crime', label: 'Crime', icon: '🚨' },
  { value: 'accident', label: 'Accident', icon: '💥' },
  { value: 'natural_disaster', label: 'Natural Disaster', icon: '🌩️' },
  { value: 'other', label: 'Other', icon: '⚠️' },
];

const SEVERITIES: { value: Severity; label: string; desc: string; color: string }[] = [
  { value: 'low', label: 'Low', desc: 'Minor, no immediate danger', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', desc: 'Requires attention soon', color: '#eab308' },
  { value: 'high', label: 'High', desc: 'Immediate response needed', color: '#f97316' },
  { value: 'critical', label: 'Critical', desc: 'Life-threatening, need immediate action', color: '#ef4444' },
];

type FormState = 'idle' | 'locating' | 'submitting' | 'done' | 'error';

export const IncidentForm: React.FC<IncidentFormProps> = ({ onIncidentSubmitted }) => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const { address: inAppAddress } = useAuthStore();
  // Use whichever wallet is active — dapp-kit takes precedence
  const walletAddress = account?.address ?? inAppAddress ?? undefined;
  const [type, setType] = useState<IncidentType>('other');
  const [hoveredType, setHoveredType] = useState<IncidentType | null>(null);
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  const [submittedIncident, setSubmittedIncident] = useState<Incident | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forward geocode: search for an address and get coordinates
  const searchAddress = async (query: string) => {
    if (query.trim().length < 2) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      setAddressSuggestions(data);
      // Always force-show the dropdown when search completes
      if (data.length > 0) {
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error('Address search error:', err);
      setAddressSuggestions([]);
    }
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    // Debounce the search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchAddress(value), 400);
  };

  const selectSuggestion = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setAddress(suggestion.display_name);
    setCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };





  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser.');
      return;
    }
    setFormState('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        // Reverse geocode with Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          setAddress(data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setFormState('idle');
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setFormState('error');
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description.');
      return;
    }

    const incidentCoords = coords || { lat: 0, lng: 0 };

    let incident: Incident = {
      id: uuidv4(),
      type,
      severity,
      description: description.trim(),
      location: {
        lat: incidentCoords.lat,
        lng: incidentCoords.lng,
        address: address || 'Location not set',
      },
      timestamp: new Date().toISOString(),
      reportedBy: walletAddress || 'Anonymous',
      reporter: walletAddress || undefined,
      status: 'active',
      createdByMe: true,
    };

    setFormState('submitting');
    setError('');

    try {
      // Store on Walrus via the proxy (bypasses CORS)
      let txDigest: string | null = null;
      let suiObjectId: string | undefined = undefined;

      const storeRes = await fetch(`${PROXY_URL}/api/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      });
      const storeData = await storeRes.json();
      const blobId = storeData?.blobId ?? null;

      if (!blobId) {
        throw new Error('Walrus store failed: no blobId returned');
      }

      if (storeData.createdAt) {
        incident = { ...incident, createdAt: storeData.createdAt };
      }

      // Step B & C — Sui on-chain anchor (only when dapp-kit wallet connected)
      if (account) {
        try {
          const tx = new Transaction();
          tx.moveCall({
            target: `${import.meta.env.VITE_PACKAGE_ID}::sentinel::create_incident`,
            arguments: [
              tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
              tx.pure.vector('u8', Array.from(new TextEncoder().encode(incident.description))),
              tx.object('0x6'), // Clock object ID on Sui
            ],
          });
          const txResult = await signAndExecute({ transaction: tx });
          txDigest = txResult.digest;

          try {
            const txRes = await suiClient.waitForTransaction({
              digest: txDigest,
              options: { showObjectChanges: true },
            });
            if (txRes.objectChanges) {
               const createdObj = txRes.objectChanges.find((c: any) => c.type === 'created' && c.objectType.includes('sentinel::Incident'));
               if (createdObj && 'objectId' in createdObj) {
                 suiObjectId = createdObj.objectId;
               }
            }
          } catch (e) {
            console.warn("Could not fetch object changes", e);
          }
        } catch (txErr) {
          console.warn('Sui anchor failed (non-blocking, Walrus store succeeded):', txErr);
        }
      }

      // Save blob ID mapping to localStorage so Memory page picks it up
      try {
        const blobMap = JSON.parse(localStorage.getItem('sentinel_blob_map') || '{}');
        blobMap[incident.id] = blobId;
        localStorage.setItem('sentinel_blob_map', JSON.stringify(blobMap));
      } catch {}

      // Apply blob ID to incident before registering
      const storedIncident: Incident = {
        ...incident,
        walrusBlobId: blobId,
        walrusStatus: 'synced',
        suiTxDigest: txDigest || undefined,
        suiObjectId: suiObjectId || undefined,
        reporter: walletAddress,
      };

      setSubmittedIncident(storedIncident);
      onIncidentSubmitted(storedIncident);
      setFormState('done');
    } catch (err) {
      console.error('Submit error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to store incident.';
      setError(msg);
      setFormState('error');
    }
  };

  const handleReset = () => {
    setType('other');
    setSeverity('medium');
    setDescription('');
    setAddress('');
    setCoords(null);
    setFormState('idle');
    setError('');
    setSubmittedIncident(null);
  };

  if (formState === 'done' && submittedIncident) {
    return (
      <div className="fade-in-up" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Success banner */}
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <CheckCircle2 size={24} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#e5e5e5', marginBottom: '6px' }}>
              Incident stored on Walrus
            </p>
            <p style={{ fontSize: '13px', color: '#888', lineHeight: '1.5' }}>
              Your report has been permanently recorded on the Walrus blockchain via MemWal.
              The AI agent now has full context of this incident.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {submittedIncident.walrusBlobId && (
                <a
                  href={`https://walruscan.com/testnet/blob/${submittedIncident.walrusBlobId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#a78bfa', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                >
                  <ExternalLink size={12} />
                  View on Walrus
                </a>
              )}
              {submittedIncident.suiTxDigest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${submittedIncident.suiTxDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                >
                  <ExternalLink size={12} />
                  View on Sui Explorer
                </a>
              )}
            </div>
          </div>
        </div>

        {/* What Happens Next — pipeline timeline */}
        <PipelineTimeline hasSuiAnchor={!!submittedIncident.suiTxDigest} />

        {/* Incident Impact Card */}
        <IncidentImpactCard incident={submittedIncident} />

        <button
          onClick={handleReset}
          style={{ width: '100%', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', color: '#3b82f6', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Report Another Incident
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: '24px 24px 12px 24px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden' }}
      className="mobile-report-form"
    >
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#e5e5e5',
            marginBottom: '6px',
          }}
        >
          Report Incident
        </h2>
        <p style={{ fontSize: '13px', color: '#666' }}>
          Your report will be stored permanently on Walrus and immediately analyzed by the AI agent.
        </p>
      </div>

      {/* Incident Type */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '10px', letterSpacing: '0.05em' }}
        >
          INCIDENT TYPE
        </label>
        <div className="mobile-type-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {INCIDENT_TYPES.map((t) => {
            const isSelected = type === t.value;
            const isHovered = hoveredType === t.value;
            const isActive = isSelected || isHovered;
            
            const TYPE_ACCENTS: Record<string, string> = {
              medical: '#a78bfa',
              fire: '#f97316',
              crime: '#ef4444',
              accident: '#facc15',
              natural_disaster: '#60a5fa',
              other: '#f59e0b',
            };
            const accentColor = TYPE_ACCENTS[t.value];

            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                onMouseEnter={() => setHoveredType(t.value as IncidentType)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  padding: isActive ? '8px 8px 10px 8px' : '10px 8px',
                  borderRadius: '8px',
                  borderBottom: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderLeft: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRight: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderTop: isActive ? `3px solid ${accentColor}` : (isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)'),
                  background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'linear-gradient(145deg, rgba(26, 26, 26, 0.9), rgba(12, 12, 12, 0.95))',
                  color: isSelected ? '#3b82f6' : '#888',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isHovered ? 'scale(1.03) translateY(-2px)' : 'scale(1) translateY(0)',
                  boxShadow: isHovered ? '0 12px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)' : (isSelected ? 'none' : '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)'),
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <span style={{ fontSize: '20px' }}>{t.icon}</span>
                {t.value === 'natural_disaster' ? 'Natural Disaster' : t.label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '10px', letterSpacing: '0.05em' }}
        >
          SEVERITY LEVEL
        </label>
        <div className="mobile-severity-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value)}
              className="hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
              style={{
                flex: 1,
                padding: '12px 10px',
                borderRadius: '8px',
                border: severity === s.value
                  ? `1px solid ${s.color}60`
                  : '1px solid rgba(255, 255, 255, 0.12)',
                background: severity === s.value
                  ? `${s.color}12`
                  : 'linear-gradient(145deg, rgba(26, 26, 26, 0.9), rgba(12, 12, 12, 0.95))',
                boxShadow: severity === s.value
                  ? 'none'
                  : '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center' as const,
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: severity === s.value ? s.color : '#555',
                  marginBottom: '3px',
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: '10px', color: '#555', lineHeight: '1.3' }}>
                {s.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '10px', letterSpacing: '0.05em' }}
        >
          DESCRIPTION
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what is happening. Include as much detail as possible — the AI agent will use this for pattern analysis."
          rows={4}
          required
          style={{
            width: '100%',
            background: '#0d0d0d',
            border: '1px solid #1f1f1f',
            borderRadius: '8px',
            color: '#e5e5e5',
            fontSize: '13px',
            padding: '12px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            lineHeight: '1.5',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(59, 130, 246, 0.4)')}
          onBlur={(e) => (e.target.style.borderColor = '#1f1f1f')}
        />
      </div>

      {/* Location */}
      <div style={{ marginBottom: '24px' }}>
        <label
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '10px', letterSpacing: '0.05em' }}
        >
          LOCATION
        </label>
        <div style={{ position: 'relative' }}>
          <div className="mobile-location-row" style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder={formState === 'locating' ? '📍 Locating...' : 'Type your city, area or address to search...'}
              style={{
                flex: 1,
                background: '#0d0d0d',
                border: '1px solid #1f1f1f',
                borderRadius: '8px',
                color: '#e5e5e5',
                fontSize: '13px',
                padding: '10px 12px',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                if (addressSuggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#1f1f1f';
                // Delay hiding so click on suggestion registers
                setTimeout(() => setShowSuggestions(false), 300);
              }}
            />
            <button
              type="button"
              onClick={() => searchAddress(address)}
              style={{
                padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                color: '#3b82f6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <Search size={14} />
              Search
            </button>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={formState === 'locating'}
              className="hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
              style={{
                padding: '10px 14px',
                background: coords ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                border: coords ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                color: coords ? '#22c55e' : '#3b82f6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {formState === 'locating' ? (
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
              ) : (
                <MapPin size={14} />
              )}
              GPS
            </button>
          </div>

          {/* Address search suggestions dropdown */}
          {showSuggestions && addressSuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: '#111',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                overflow: 'hidden',
                zIndex: 50,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              {addressSuggestions.map((s, i) => (
                <div
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                  style={{
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#ccc',
                    cursor: 'pointer',
                    borderBottom: i < addressSuggestions.length - 1 ? '1px solid #1a1a1a' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ marginRight: '8px' }}>📍</span>
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
        {coords && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#555',
              fontFamily: 'monospace',
            }}
          >
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit — WalletGuard already ensures the user is authenticated */}
      <div className="mobile-submit-area">
        <button
          type="submit"
          id="submit-incident-btn"
          disabled={formState === 'submitting' || formState === 'locating'}
          className="hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(59,130,246,0.3)] transition-all duration-300"
          style={{
            width: '100%',
            padding: '14px',
            background: formState === 'submitting' ? '#1a1a1a' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            borderRadius: '10px',
            color: formState === 'submitting' ? '#666' : '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: formState === 'submitting' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          {formState === 'submitting' ? (
            <><Loader2 className="animate-spin w-4 h-4 mr-2" />Storing on Walrus…</>
          ) : (
            <><Send size={16} />Submit to Walrus</>
          )}
        </button>
      </div>
    </form>
  );
};

// ─── Pipeline Timeline ────────────────────────────────────────────────────────
const PIPELINE_STEPS: { icon: (active: boolean) => React.ReactNode; label: string; sub: string; color: string }[] = [
  { icon: (a) => <CheckCircle size={22} color={a ? '#22c55e' : '#333'} strokeWidth={2} />, label: 'Stored on Walrus',  sub: 'Your report is permanently recorded', color: '#22c55e' },
  { icon: (a) => <Link      size={22} color={a ? '#a78bfa' : '#333'} strokeWidth={2} />, label: 'Anchored on Sui',   sub: 'Immutable proof written on-chain',    color: '#a78bfa' },
  { icon: (a) => <Radio     size={22} color={a ? '#38bdf8' : '#333'} strokeWidth={2} />, label: 'Broadcasting',       sub: 'Nearby users are being alerted',      color: '#38bdf8' },
];

const PipelineTimeline: React.FC<{ hasSuiAnchor: boolean }> = () => {
  const [visible, setVisible] = React.useState([false, false, false]);
  useEffect(() => {
    PIPELINE_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setVisible((prev) => { const next = [...prev]; next[i] = true; return next; });
      }, i * 220);
    });
  }, []);

  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.08em', marginBottom: '14px', textTransform: 'uppercase' }}>What happens next</p>

      {/* Desktop: horizontal */}
      <div className="pipeline-desktop" style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {PIPELINE_STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <div style={{ flex: 1, background: '#111', border: `1px solid ${visible[i] ? step.color + '50' : '#1f1f1f'}`, borderRadius: '10px', padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center', opacity: visible[i] ? 1 : 0, transform: visible[i] ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.35s ease, transform 0.35s ease, border-color 0.35s' }}>
              <div style={{ lineHeight: 1, display: 'flex' }}>{step.icon(visible[i])}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: visible[i] ? step.color : '#555' }}>{step.label}</div>
              <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.3' }}>{step.sub}</div>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                <div style={{ width: '16px', height: '1px', background: '#2a2a2a' }} />
                <span style={{ fontSize: '10px', color: '#333' }}>▶</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="pipeline-mobile" style={{ display: 'none', flexDirection: 'column', gap: 0 }}>
        {PIPELINE_STEPS.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
            {i < PIPELINE_STEPS.length - 1 && (
              <div style={{ position: 'absolute', left: '17px', top: '40px', bottom: '-4px', width: '2px', background: 'repeating-linear-gradient(to bottom, #2a2a2a 0, #2a2a2a 4px, transparent 4px, transparent 8px)' }} />
            )}
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${step.color}15`, border: `2px solid ${visible[i] ? step.color + '80' : '#222'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: visible[i] ? 1 : 0.3, transition: 'opacity 0.35s, border-color 0.35s' }}>
              {step.icon(visible[i])}
            </div>
            <div style={{ paddingBottom: '16px', paddingTop: '4px', opacity: visible[i] ? 1 : 0, transform: visible[i] ? 'translateX(0)' : 'translateX(6px)', transition: 'opacity 0.35s, transform 0.35s' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: visible[i] ? step.color : '#555' }}>{step.label}</div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{step.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .pipeline-desktop { display: none !important; }
          .pipeline-mobile  { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

// ─── Incident Impact Card ─────────────────────────────────────────────────────
const IncidentImpactCard: React.FC<{ incident: Incident }> = ({ incident }) => {
  const shortBlob = incident.walrusBlobId ? incident.walrusBlobId.slice(0, 10) + '…' : null;

  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <Radio size={16} color="#38bdf8" />,
      label: 'Users Notified',
      value: <span style={{ color: '#38bdf8', fontWeight: 600 }}>Nearby users alerted</span>,
    },
    {
      icon: <Shield size={16} color="#a78bfa" />,
      label: 'Stored Permanently',
      value: shortBlob ? (
        <a href={`https://walruscan.com/testnet/blob/${incident.walrusBlobId}`} target="_blank" rel="noopener noreferrer"
          style={{ color: '#a78bfa', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
          Verified on Walrus&nbsp;<span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#666' }}>({shortBlob})</span>
          <ExternalLink size={10} />
        </a>
      ) : <span style={{ color: '#22c55e', fontWeight: 700 }}>Verified on Walrus</span>,
    },
    {
      icon: <Link size={16} color="#a78bfa" />,
      label: 'On-Chain Record',
      value: incident.suiTxDigest ? (
        <a href={`https://suiscan.xyz/testnet/tx/${incident.suiTxDigest}`} target="_blank" rel="noopener noreferrer"
          style={{ color: '#a78bfa', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
          Live on Sui Testnet <ExternalLink size={10} />
        </a>
      ) : <span style={{ color: '#22c55e', fontWeight: 700 }}>Live on Sui Testnet</span>,
    },
  ];

  return (
    <div style={{ background: '#0e0e0e', border: '1px solid #1f1f1f', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Incident Impact</p>
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < rows.length - 1 ? '1px solid #141414' : 'none', minHeight: '44px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>{row.icon}</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>{row.label}</span>
          </div>
          <div style={{ fontSize: '12px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
};
