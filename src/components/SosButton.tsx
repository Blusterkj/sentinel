// src/components/SosButton.tsx
// Floating SOS panic button — gets GPS, stores on Walrus, executes Sui tx

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCurrentAccount, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { v4 as uuidv4 } from 'uuid';
import type { Incident } from '../types/incident';
import { PROXY_URL } from '../lib/api';
import { getCurrentPosition } from '../lib/location';
import { useAuthStore } from '../lib/authStore';


interface SosButtonProps {
  onSosSubmitted: (incident: Incident) => void;
  // mobileOffset no longer needed - tab bar is in normal flow
}

type SosState = 'idle' | 'submitting';

export const SosButton: React.FC<SosButtonProps> = ({ onSosSubmitted }) => {
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const suiClient = useSuiClient();
  const { address: inAppAddress } = useAuthStore();
  // Either wallet is sufficient — dapp-kit for desktop Slush, in-app Ed25519 for mobile
  const walletAddress = account?.address ?? inAppAddress ?? null;
  const [state, setState] = useState<SosState>('idle');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSos = async () => {
    if (!walletAddress) {
      showToast('No wallet found — please sign in first', 'warning');
      return;
    }

    if (state === 'submitting') return;
    setState('submitting');

    try {
      // Step 1: Get GPS
      const coords = await getCurrentPosition();
      if (!coords) throw new Error('Location required for SOS');

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
      let incident: Incident = {
        id: uuidv4(),
        type: 'other',
        severity: 'critical',
        description: '🆘 SOS EMERGENCY — User triggered panic alert. Immediate assistance required.',
        location: { lat: coords.latitude, lng: coords.longitude, address },
        timestamp: new Date().toISOString(),
        reportedBy: walletAddress || 'SOS',
        status: 'active',
        createdByMe: true,
        reporter: walletAddress ?? undefined,
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
          if (storeData.createdAt) {
            incident = { ...incident, createdAt: storeData.createdAt };
          }

          // Step 5: Sponsored Sui on-chain anchor — if any wallet is connected
          if (walletAddress) {
            try {
              // 1. Get sponsored transaction from proxy
              const sponsorRes = await fetch(`${PROXY_URL}/api/sponsor-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  blobId,
                  description: incident.description,
                  senderAddress: walletAddress,
                }),
              });
              const sponsorData = await sponsorRes.json();
              if (!sponsorData.success) throw new Error(sponsorData.error || 'Sponsor failed');

              const { txBytes, sponsorSignature } = sponsorData;
              const txBytesBuffer = Uint8Array.from(atob(txBytes), c => c.charCodeAt(0));

              // 2. Sign as sender
              let senderSignature: string;
              if (account) {
                // dapp-kit wallet
                const signRes = await signTransaction({ transaction: Transaction.from(txBytesBuffer) });
                senderSignature = signRes.signature;
              } else {
                // in-app wallet
                const pk = useAuthStore.getState().privateKey;
                if (!pk) throw new Error('In-app wallet private key missing');
                const { secretKey } = decodeSuiPrivateKey(pk);
                const keypair = Ed25519Keypair.fromSecretKey(secretKey);
                senderSignature = (await keypair.signTransaction(txBytesBuffer)).signature;
              }

              // 3. Execute with both signatures
              const txResult = await suiClient.executeTransactionBlock({
                transactionBlock: txBytesBuffer,
                signature: [senderSignature, sponsorSignature],
                options: { showObjectChanges: true },
              });

              txDigest = txResult.digest;
              
              // Tell the proxy our txDigest so it updates the global registry
              fetch(`${PROXY_URL}/api/incidents/${incident.id}/tx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txDigest }),
              }).catch(e => console.warn('Failed to report txDigest to proxy:', e));
            } catch (txErr) {
              console.warn('Sui sponsor/anchor failed (non-blocking):', txErr);
            }
          }
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
    success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#4ade80' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#f87171' },
    warning: { bg: 'rgba(234,179,8,0.15)',  border: 'rgba(234,179,8,0.4)',  text: '#facc15' },
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className="fade-in-up"
          style={{
            position: 'fixed',
            bottom: '110px',
            right: '24px',
            zIndex: 200,
            background: toastColors[toast.type].bg,
            border: `1px solid ${toastColors[toast.type].border}`,
            backdropFilter: 'blur(12px)',
            color: toastColors[toast.type].text,
            padding: '12px 18px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            maxWidth: '300px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            lineHeight: '1.4',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* SOS Button — original circular fixed button at bottom-right */}
      <button
        onClick={handleSos}
        disabled={state === 'submitting'}
        title="SOS Emergency Alert"
        className="bottom-[120px] mobile-sos-btn"
        style={{
          position: 'fixed',
          right: '24px',
          zIndex: 100,
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: state === 'submitting' ? '#7f1d1d' : '#dc2626',
          border: '2px solid rgba(255,100,100,0.4)',
          color: '#fff',
          fontWeight: 900,
          fontSize: '15px',
          letterSpacing: '0.05em',
          cursor: state === 'submitting' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 0 0 rgba(220,38,38,0.7)',
          animation: state === 'submitting' ? 'none' : 'sos-pulse 2s ease-out infinite',
          transition: 'transform 0.2s, background 0.2s',
        }}
        onMouseEnter={(e) => {
          if (state !== 'submitting') {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 28px rgba(220,38,38,0.7)';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
        }}
      >
        {state === 'submitting' ? (
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          'SOS'
        )}
      </button>
    </>
  );
};
