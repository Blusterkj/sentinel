// src/components/IncidentForm.tsx
// Form to report a new incident — stores it in MemWal and shows pattern analysis

import React, { useState } from 'react';
import {
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  Brain,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { Incident, IncidentType, Severity } from '../types/incident';
import { v4 as uuidv4 } from 'uuid';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3333';


interface IncidentFormProps {
  onIncidentSubmitted: (incident: Incident) => void;
}

const INCIDENT_TYPES: { value: IncidentType; label: string; icon: string }[] = [
  { value: 'medical', label: 'Medical Emergency', icon: '🏥' },
  { value: 'fire', label: 'Fire', icon: '🔥' },
  { value: 'crime', label: 'Crime', icon: '🚨' },
  { value: 'accident', label: 'Accident', icon: '💥' },
  { value: 'natural_disaster', label: 'Natural Disaster', icon: '🌪️' },
  { value: 'other', label: 'Other', icon: '⚠️' },
];

const SEVERITIES: { value: Severity; label: string; desc: string; color: string }[] = [
  { value: 'low', label: 'Low', desc: 'Minor, no immediate danger', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', desc: 'Requires attention soon', color: '#eab308' },
  { value: 'high', label: 'High', desc: 'Immediate response needed', color: '#f97316' },
  { value: 'critical', label: 'Critical', desc: 'Life-threatening, need immediate action', color: '#ef4444' },
];

type FormState = 'idle' | 'locating' | 'submitting' | 'recalling' | 'done' | 'error';

export const IncidentForm: React.FC<IncidentFormProps> = ({ onIncidentSubmitted }) => {
  const [type, setType] = useState<IncidentType>('other');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  const [patternAnalysis, setPatternAnalysis] = useState<
    Array<{ text: string; distance: number }>
  >([]);
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

    const incident: Incident = {
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
      reportedBy: 'You',
      status: 'active',
      createdByMe: true,
    };

    setFormState('submitting');
    setError('');

    try {
      // Store on Walrus via the proxy (bypasses CORS)
      let blobId: string | null = null;
      let txDigest: string | null = null;
      try {
        const storeRes = await fetch(`${PROXY_URL}/api/store`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incident),
        });
        const storeData = await storeRes.json();
        if (storeData.success && storeData.blobId) {
          blobId = storeData.blobId;
          txDigest = storeData.tx_digest || null;
          // Save blob ID mapping to localStorage so Memory page picks it up
          try {
            const blobMap = JSON.parse(localStorage.getItem('sentinel_blob_map') || '{}');
            blobMap[incident.id] = blobId;
            localStorage.setItem('sentinel_blob_map', JSON.stringify(blobMap));
          } catch {}
        }
      } catch (storeErr) {
        console.warn('Proxy store failed (incident saved locally):', storeErr);
      }

      // Apply blob ID to incident before registering
      const storedIncident: Incident = {
        ...incident,
        walrusBlobId: blobId || undefined,
        walrusStatus: blobId ? 'synced' : 'pending',
        suiTxDigest: txDigest || undefined,
      };

      setSubmittedIncident(storedIncident);
      onIncidentSubmitted(storedIncident);

      // Now recall similar incidents for pattern analysis via proxy
      setFormState('recalling');
      try {
        const recallRes = await fetch(
          `${PROXY_URL}/api/recall?query=${encodeURIComponent(
            `${incident.type} incident near ${incident.location.address} severity ${incident.severity}`
          )}&limit=5`
        );
        if (recallRes.ok) {
          const recallData = await recallRes.json();
          setPatternAnalysis(recallData.results || []);
        }
      } catch (recallErr) {
        // Non-fatal — recall may fail; incident is already stored
        console.warn('Recall warning:', recallErr);
      }
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
    setPatternAnalysis([]);
    setSubmittedIncident(null);
  };

  if (formState === 'done' && submittedIncident) {
    return (
      <div className="fade-in-up" style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#a78bfa',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
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

        {/* Pattern Analysis */}
        {patternAnalysis.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px',
              }}
            >
              <Brain size={16} color="#8b5cf6" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5' }}>
                Agent Pattern Analysis
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: '#8b5cf6',
                  background: 'rgba(139, 92, 246, 0.12)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              >
                {patternAnalysis.length} similar recalled
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {patternAnalysis.map((mem, i) => (
                <div
                  key={i}
                  className="fade-in-up"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    background: '#111',
                    border: '1px solid #1f1f1f',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#555',
                        fontFamily: 'monospace',
                      }}
                    >
                      MEMORY #{i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#8b5cf6',
                        fontFamily: 'monospace',
                        background: 'rgba(139, 92, 246, 0.1)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      sim: {(1 - mem.distance).toFixed(2)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#999',
                      lineHeight: '1.5',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {mem.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {patternAnalysis.length === 0 && (
          <div
            style={{
              background: '#111',
              border: '1px solid #1f1f1f',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '24px',
              color: '#555',
            }}
          >
            <Brain size={16} />
            <span style={{ fontSize: '13px' }}>
              No similar historical incidents found. This may be a new pattern.
            </span>
          </div>
        )}

        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
            color: '#3b82f6',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Report Another Incident
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {INCIDENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: type === t.value ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #1f1f1f',
                background: type === t.value ? 'rgba(59, 130, 246, 0.1)' : '#111',
                color: type === t.value ? '#3b82f6' : '#888',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s',
                fontSize: '11px',
                fontWeight: type === t.value ? 600 : 400,
              }}
            >
              <span style={{ fontSize: '20px' }}>{t.icon}</span>
              {t.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '10px', letterSpacing: '0.05em' }}
        >
          SEVERITY LEVEL
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value)}
              style={{
                flex: 1,
                padding: '12px 10px',
                borderRadius: '8px',
                border: severity === s.value
                  ? `1px solid ${s.color}60`
                  : '1px solid #1f1f1f',
                background: severity === s.value
                  ? `${s.color}12`
                  : '#111',
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Type your city, area or address to search..."
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

      {/* Submit */}
      <button
        type="submit"
        id="submit-incident-btn"
        disabled={['submitting', 'recalling', 'locating'].includes(formState)}
        style={{
          width: '100%',
          padding: '14px',
          background:
            formState === 'submitting' || formState === 'recalling'
              ? '#1a1a1a'
              : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          border: 'none',
          borderRadius: '10px',
          color:
            formState === 'submitting' || formState === 'recalling' ? '#666' : '#fff',
          fontSize: '14px',
          fontWeight: 700,
          cursor:
            formState === 'submitting' || formState === 'recalling'
              ? 'not-allowed'
              : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'all 0.2s',
          letterSpacing: '0.02em',
        }}
      >
        {formState === 'submitting' && (
          <>
            <Loader2 className="animate-spin w-4 h-4 mr-2" />
            Storing on Walrus…
          </>
        )}
        {formState === 'recalling' && (
          <>
            <Brain size={16} />
            Agent recalling patterns…
          </>
        )}
        {!['submitting', 'recalling'].includes(formState) && (
          <>
            <Send size={16} />
            Submit to Walrus
          </>
        )}
      </button>

      <p
        style={{
          marginTop: '12px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#444',
        }}
      >
        Stored permanently on Walrus blockchain via MemWal
      </p>
    </form>
  );
};
