// src/components/WalletGuard.tsx
// Guards protected routes — checks BOTH dapp-kit wallet AND in-app wallet.
// Shows AuthModal on web if neither is connected.
// On APK: wallet always exists after first launch (KeyBackupScreen handles onboarding).

import React, { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Capacitor } from '@capacitor/core';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../lib/authStore';
import { generateWallet, saveWallet } from '../lib/inAppWallet';
import { AuthModal } from './AuthModal';

export const WalletGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useCurrentAccount(); // dapp-kit
  const { address, setInAppAuth } = useAuthStore(); // in-app wallet
  const [showModal, setShowModal] = useState(false);

  // Either auth method is sufficient
  if (account || address) {
    return <>{children}</>;
  }

  // ── Not authenticated ────────────────────────────────────────────────────

  if (Capacitor.isNativePlatform()) {
    // APK should never reach here after first launch (App.tsx handles init).
    // Safety fallback: silently generate + save a wallet.
    (async () => {
      try {
        const wallet = await generateWallet();
        await saveWallet(wallet.privateKey);
        setInAppAuth(wallet.address, wallet.privateKey);
      } catch {
        // Ignore — will retry on next render
      }
    })();

    // Render nothing while generating
    return null;
  }

  // ── Web (desktop or mobile web) — show AuthModal ─────────────────────────

  return (
    <>
      {/* Dimmed placeholder so the user sees they need to auth */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,10,10,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setShowModal(true)}
        role="button"
        aria-label="Sign in to access this feature"
      >
        <div style={{
          background: '#151515', border: '1px solid #2a2a2a',
          borderRadius: '12px', padding: '20px 28px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 8px', fontSize: '15px' }}>
            Sign In Required
          </p>
          <p style={{ color: '#666', fontSize: '13px', margin: '0 0 14px' }}>
            Connect a wallet to access this feature
          </p>
          <button
            id="wallet-guard-signin-btn"
            onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
            style={{
              background: '#3b82f6', border: 'none',
              borderRadius: '8px', color: '#fff',
              fontSize: '13px', fontWeight: 600,
              padding: '9px 20px', cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <AuthModal onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
};
