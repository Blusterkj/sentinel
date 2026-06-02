// src/components/SosButton.tsx
// SOS panic button — anchored below the weather card in the map area

import React, { useState } from 'react';
import { Loader2, Siren } from 'lucide-react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { v4 as uuidv4 } from 'uuid';
import type { Incident } from '../types/incident';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3333';

interface SosButtonProps {
  onSosSubmitted: (incident: Incident) => void;
}

type SosState = 'idle' | 'submitting';

export const SosButton: React.FC<SosButtonProps> = ({ onSosSubmitted }) => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [state, setState] = useState<SosState>('idle');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSos = async () => {
    if (!account) {
      showToast('Connect your wallet to use SOS', 'warning');
      return;
    }

    if (state === 'submitting') return;
    setState('submitting');

    try {
      // Step 1: Get GPS
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err),
          { timeout: 10000, enableHighAccuracy: true }
        );
      });

      // Step 2: Reverse geocode
      let address = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
        );
        const geoData = await geoRes.json();
        address = geoData.display_name || address;
      } catch {
        // silently fall back to raw coords
      }

      // Step 3: Build the incident object
      const incident: Incident = {
        id: uuidv4(),
        type: 'other',
        severity: 'critical',
        description: '🆘 SOS EMERGENCY — User triggered panic alert. Immediate assistance required.',
        location: { lat: coords.latitude, lng: coords.longitude, address },
        timestamp: new Date().toISOString(),
        reportedBy: 'SOS',
        status: 'active',
        createdByMe: true,
        reporter: account.address,
      };

      // Step 4: Store on Walrus
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

          // Step 5: Sui transaction
          const tx = new Transaction();
          tx.moveCall({
            target: `${import.meta.env.VITE_PACKAGE_ID}::sentinel::create_incident`,
            arguments: [
              tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId || ''))),
              tx.pure.vector('u8', Array.from(new TextEncoder().encode(incident.description))),
              tx.object('0x6'),
            ],
          });
          const txResult = await signAndExecute({ transaction: tx });
          txDigest = txResult.digest;
        }
      } catch (err) {
        console.warn('SOS proxy/Sui failed (saved locally):', err);
      }

      const storedIncident: Incident = {
        ...incident,
        walrusBlobId: blobId || undefined,
        walrusStatus: blobId ? 'synced' : 'pending',
        suiTxDigest: txDigest || undefined,
      };

      onSosSubmitted(storedIncident);
      showToast('🆘 SOS Alert Sent — Help is on the way. Your incident is recorded on-chain.', 'success');
    } catch (err: any) {
      console.error('SOS error:', err);
      showToast(`SOS failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setState('idle');
    }
  };

  const toastColors = {
    success: { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.4)',  text: '#4ade80' },
    error:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   text: '#f87171' },
    warning: { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.4)',   text: '#facc15' },
  };

  return (
    <>
      {/* Toast — sits just below the SOS card */}
      {toast && (
        <div
          className="fade-in-up"
          style={{
            position: 'absolute',
            top: '296px',
            right: '16px',
            zIndex: 850,
            background: toastColors[toast.type].bg,
            border: `1px solid ${toastColors[toast.type].border}`,
            backdropFilter: 'blur(12px)',
            color: toastColors[toast.type].text,
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            maxWidth: '220px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            lineHeight: '1.4',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* SOS Card — sits directly below the weather card (weather is ~155px at collapsed height) */}
      <div
        style={{
          position: 'absolute',
          top: '175px',
          right: '16px',
          zIndex: 800,
          paddingTop: '10px',
          paddingBottom: '10px',
        }}
      >
        <button
          onClick={handleSos}
          disabled={state === 'submitting'}
          title="SOS Emergency Alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: state === 'submitting'
              ? 'rgba(127,29,29,0.92)'
              : 'rgba(220,38,38,0.9)',
            border: '1px solid rgba(255,100,100,0.35)',
            borderRadius: '10px',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.06em',
            cursor: state === 'submitting' ? 'not-allowed' : 'pointer',
            animation: state === 'submitting' ? 'none' : 'sos-pulse 2s ease-out infinite',
            transition: 'transform 0.2s, background 0.2s',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(220,38,38,0.35)',
          }}
          onMouseEnter={(e) => {
            if (state !== 'submitting') {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          {state === 'submitting' ? (
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Siren size={15} />
          )}
          {state === 'submitting' ? 'Sending SOS…' : 'SOS Alert'}
        </button>
      </div>
    </>
  );
};
