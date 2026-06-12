import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { DemoTrigger } from './DemoTrigger';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useAuthStore } from '../lib/authStore';
import { clearWallet } from '../lib/inAppWallet';
import { AuthModal } from './AuthModal';
import { Wallet, ChevronDown, LogOut, Copy, Check, User } from 'lucide-react';

interface MobileHeaderProps {
  onActivate?: () => void;
  actionVisible?: boolean;
  onSimulate?: () => void;
  onHide?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onActivate,
  actionVisible,
  onSimulate,
  onHide,
}) => {
  const account = useCurrentAccount();
  const { mutate: disconnectDappKit } = useDisconnectWallet();
  const { address: inAppAddress, clearAuth } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isConnected = !!(account || inAppAddress);
  const displayAddress = account?.address ?? inAppAddress ?? '';
  const isInApp = !!(inAppAddress && !account);

  // Close dropdown on outside tap
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDisconnect = async () => {
    setShowDropdown(false);
    if (account) {
      disconnectDappKit();
    }
    if (inAppAddress) {
      await clearWallet();
      clearAuth();
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div
        className="flex md:hidden"
        style={{
          height: '48px',
          background: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          zIndex: 2000,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <DemoTrigger onActivate={onActivate ?? (() => {})}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Logo size={22} />
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.1em' }}>SENTINEL</span>
          </div>
        </DemoTrigger>
        {actionVisible && (
          <button
            onClick={() => { onSimulate?.(); onHide?.(); }}
            style={{
              marginLeft: '8px',
              padding: '3px 8px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#aaa',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              flexShrink: 0,
            }}
          >
            ⚡
          </button>
        )}

        {isConnected ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Address chip — tap to open dropdown */}
            <button
              id="mobile-wallet-chip"
              onClick={() => setShowDropdown((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#111', border: `1px solid ${showDropdown ? '#444' : '#222'}`,
                borderRadius: '6px', padding: '5px 10px',
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
                <path d="M12 2L20 8.5V15.5L12 22L4 15.5V8.5L12 2Z" fill="#6fbcf0"/>
                <path d="M12 6L17 9.5V14.5L12 18L7 14.5V9.5L12 6Z" fill="white" opacity="0.4"/>
              </svg>
              <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                {displayAddress.slice(0, 6)}…{displayAddress.slice(-4)}
              </span>
              <ChevronDown
                size={12}
                color="#666"
                style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  id="mobile-wallet-dropdown"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: '#111', border: '1px solid #222',
                    borderRadius: '10px', padding: '6px',
                    minWidth: '180px', zIndex: 300,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Full address */}
                  <div style={{
                    padding: '8px 10px 6px',
                    borderBottom: '1px solid #1e1e1e',
                    marginBottom: '4px',
                  }}>
                    <p style={{ color: '#555', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                      {isInApp ? 'In-App Wallet' : 'Connected Wallet'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <p style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', margin: 0, wordBreak: 'break-all' }}>
                        {displayAddress.slice(0, 10)}…{displayAddress.slice(-6)}
                      </p>
                      <button
                        onClick={handleCopy}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                        title="Copy Address"
                      >
                        {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} color="#888" />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="mobile-dropdown-activity"
                    onClick={() => {
                      setShowDropdown(false);
                      window.history.pushState({}, '', '/activity');
                      window.dispatchEvent(new Event('popstate'));
                    }}
                    style={dropdownBtnStyle}
                  >
                    <User size={14} />
                    My Activity
                  </button>

                  {/* Disconnect */}
                  <button
                    id="mobile-dropdown-disconnect"
                    onClick={handleDisconnect}
                    style={{ ...dropdownBtnStyle, color: '#ef4444' }}
                  >
                    <LogOut size={14} />
                    Disconnect
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
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

const dropdownBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  width: '100%', padding: '9px 10px',
  background: 'transparent', border: 'none',
  borderRadius: '7px', color: '#ccc',
  fontSize: '13px', cursor: 'pointer',
  textAlign: 'left', transition: 'background 0.1s',
};
