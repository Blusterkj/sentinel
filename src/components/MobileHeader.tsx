import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Logo } from './Logo';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useAuthStore } from '../lib/authStore';
import { AuthModal } from './AuthModal';
import { Wallet } from 'lucide-react';

export const MobileHeader: React.FC = () => {
  const account = useCurrentAccount();
  const { address: inAppAddress } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  const isConnected = !!(account || inAppAddress);
  const displayAddress = account?.address ?? inAppAddress ?? '';

  return (
    <>
      <div
        className="flex md:hidden"
        style={{
          height: '48px',
          background: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          zIndex: 100,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Logo size={22} />
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.1em' }}>SENTINEL</span>
        </div>

        {isConnected ? (
          /* Connected — show address chip */
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#111', border: '1px solid #222',
            borderRadius: '6px', padding: '5px 10px',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: inAppAddress && !account ? '#8b5cf6' : '#22c55e',
              boxShadow: `0 0 6px ${inAppAddress && !account ? '#8b5cf6' : '#22c55e'}`,
            }} />
            <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
              {displayAddress.slice(0, 6)}…{displayAddress.slice(-4)}
            </span>
          </div>
        ) : (
          /* Not connected — show our AuthModal trigger, NOT dapp-kit ConnectButton */
          <button
            id="mobile-header-signin-btn"
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 600,
              padding: '6px 12px', height: '32px',
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: '6px', color: '#fff', cursor: 'pointer',
            }}
          >
            <Wallet size={14} />
            Sign In
          </button>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <AuthModal onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
};
