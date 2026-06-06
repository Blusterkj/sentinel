// src/components/AuthModal.tsx
// Platform-aware authentication modal for web (desktop + mobile web).
// NEVER rendered on APK — APK uses KeyBackupScreen instead.
//
// Desktop (≥768px):  Two sections — dapp-kit ConnectButton + In-App Wallet
// Mobile web (<768px): One section — In-App Wallet only (bottom sheet)

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ConnectButton } from '@mysten/dapp-kit';
import { Copy, Check, Eye, EyeOff, AlertTriangle, Wallet, Key, X } from 'lucide-react';
import { generateWallet, importWallet, saveWallet } from '../lib/inAppWallet';
import { useAuthStore } from '../lib/authStore';
import { Logo } from './Logo';

interface AuthModalProps {
  onClose: () => void;
}

type InAppView = 'menu' | 'create' | 'import';

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const { setInAppAuth } = useAuthStore();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktop ? (
    <DesktopModal onClose={onClose} setInAppAuth={setInAppAuth} />
  ) : (
    <MobileBottomSheet onClose={onClose} setInAppAuth={setInAppAuth} />
  );
};

// ─── Shared In-App Wallet Panel ─────────────────────────────────────────────

interface InAppPanelProps {
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}

const InAppWalletPanel: React.FC<InAppPanelProps> = ({ onClose, setInAppAuth }) => {
  const [view, setView] = useState<InAppView>('menu');

  return (
    <div>
      {view === 'menu' && <InAppMenu onSelect={setView} />}
      {view === 'create' && (
        <CreateWalletView onClose={onClose} setInAppAuth={setInAppAuth} />
      )}
      {view === 'import' && (
        <ImportWalletView onClose={onClose} setInAppAuth={setInAppAuth} />
      )}
    </div>
  );
};

const InAppMenu: React.FC<{ onSelect: (v: InAppView) => void }> = ({ onSelect }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <button
      id="auth-create-wallet-btn"
      onClick={() => onSelect('create')}
      style={btnStyle('#3b82f6')}
      onMouseEnter={(e) => hoverIn(e, '#2563eb')}
      onMouseLeave={(e) => hoverOut(e, '#3b82f6')}
    >
      <Wallet size={16} />
      Create New Wallet
    </button>
    <button
      id="auth-import-wallet-btn"
      onClick={() => onSelect('import')}
      style={btnStyle('#1f2937')}
      onMouseEnter={(e) => hoverIn(e, '#374151')}
      onMouseLeave={(e) => hoverOut(e, '#1f2937')}
    >
      <Key size={16} />
      Import Wallet
    </button>
  </div>
);

// ─── Create Wallet View ──────────────────────────────────────────────────────

const CreateWalletView: React.FC<{
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}> = ({ onClose, setInAppAuth }) => {
  const [generated, setGenerated] = useState<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const wallet = await generateWallet();
      setGenerated(wallet);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, []);

  const handleCopy = async () => {
    if (!generated) return;
    const text = `Recovery Phrase (Mnemonic):\n${generated.mnemonic}\n\nPrivate Key (bech32):\n${generated.privateKey}\n\nAddress:\n${generated.address}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (!generated || !confirmed) return;
    await saveWallet(generated.privateKey);
    setInAppAuth(generated.address, generated.privateKey);
    onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>
          Your new wallet has been generated:
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '16px' }}>Generating…</div>
        ) : generated ? (
          <>
            {/* Mnemonic — shown plaintext, this is what they back up */}
            <p style={{ color: '#555', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
              Recovery Phrase (12 words)
            </p>
            <textarea
              readOnly
              id="wallet-mnemonic-display"
              value={generated.mnemonic}
              rows={3}
              style={{ ...keyTextareaStyle, color: '#e2e8f0', background: '#0d1117', borderColor: '#2d3748' }}
            />

            {/* Private Key — label row with eye toggle inline */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 6px' }}>
              <p style={{ color: '#555', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Private Key (bech32)
              </p>
              <button
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? 'Hide key' : 'Show key'}
                style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#666', cursor: 'pointer', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <textarea
              readOnly
              id="wallet-key-display"
              value={
                showKey
                  ? generated.privateKey
                  : '\u2022'.repeat(60)
              }
              rows={2}
              style={keyTextareaStyle}
            />

            <button
              id="copy-wallet-key-btn"
              onClick={handleCopy}
              style={{ ...copyBtnStyle, marginTop: '8px' }}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy phrase + key to clipboard'}
            </button>

            <div style={warningBoxStyle}>
              <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '12px', color: '#f59e0b', lineHeight: '1.5' }}>
                Save this somewhere safe. <strong>You cannot recover your account without it.</strong>
              </span>
            </div>

            <label style={checkboxLabelStyle}>
              <input
                id="saved-key-checkbox"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ accentColor: '#3b82f6', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span style={{ fontSize: '13px', color: '#ccc' }}>I have saved my key</span>
            </label>

            <button
              id="confirm-wallet-btn"
              onClick={handleConfirm}
              disabled={!confirmed}
              style={{
                ...btnStyle(confirmed ? '#3b82f6' : '#1f2937'),
                marginTop: '4px',
                opacity: confirmed ? 1 : 0.5,
                cursor: confirmed ? 'pointer' : 'not-allowed',
              }}
            >
              <Wallet size={16} />
              Continue with this wallet
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

// ─── Import Wallet View ──────────────────────────────────────────────────────

const ImportWalletView: React.FC<{
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}> = ({ onClose, setInAppAuth }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please paste your private key.');
      return;
    }
    if (trimmed.startsWith('0x')) {
      setError('That\'s your wallet address, not your private key. Open your Sui wallet app → Settings → Export Private Key.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const wallet = importWallet(trimmed);
      await saveWallet(wallet.privateKey);
      setInAppAuth(wallet.address, wallet.privateKey);
      onClose();
    } catch {
      setError('Invalid private key. Make sure you copied it correctly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 4px' }}>Paste your private key:</p>
      <p style={{ color: '#555', fontSize: '11px', margin: '0 0 8px', lineHeight: '1.4' }}>
        Find it in your Sui wallet app → Settings → Export Private Key. Starts with <span style={{ color: '#8b5cf6', fontFamily: 'monospace' }}>suiprivkey1</span>
      </p>

      <textarea
        id="import-key-input"
        value={key}
        onChange={(e) => { setKey(e.target.value); setError(''); }}
        placeholder="suiprivkey1..."
        rows={3}
        style={keyTextareaStyle}
      />

      {error && (
        <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{error}</p>
      )}

      <button
        id="import-wallet-submit-btn"
        onClick={handleImport}
        disabled={loading || !key.trim()}
        style={{
          ...btnStyle('#3b82f6'),
          opacity: loading || !key.trim() ? 0.5 : 1,
          cursor: loading || !key.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        <Key size={16} />
        {loading ? 'Importing…' : 'Import Wallet'}
      </button>
    </div>
  );
};

// ─── Desktop Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}

const DesktopModal: React.FC<ModalProps> = ({ onClose, setInAppAuth }) => (
  <motion.div
    id="auth-modal-overlay"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    }}
  >
    <motion.div
      id="auth-modal-card"
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        width: '100%', maxWidth: '420px', margin: '0 16px',
        background: '#111', border: '1px solid #222',
        borderRadius: '16px', padding: '28px 24px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        position: 'relative',
      }}
    >
      {/* Close */}
      <button
        id="auth-modal-close"
        onClick={onClose}
        style={{ position: 'absolute', top: '16px', right: '16px', ...iconBtnStyle }}
      >
        <X size={16} />
      </button>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Logo size={48} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: '0 0 2px', letterSpacing: '0.05em' }}>SENTINEL</h2>
          <p style={{ color: '#555', fontSize: '12px', margin: 0, fontWeight: 500 }}>Sign in to your account</p>
        </div>
      </div>

      {/* Section 1 — Slush / dapp-kit (PRIMARY) */}
      <div style={{ marginBottom: '20px' }}>
        <p style={sectionLabelStyle}>Connect Slush Wallet</p>
        <div style={{ position: 'relative' }}>
          {/* Styled button the user sees */}
          <button
            id="desktop-slush-connect-btn"
            onClick={() => {
              const hidden = document.getElementById('hidden-dappkit-connect-btn');
              if (hidden) {
                const btn = hidden.querySelector('button');
                btn?.click();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '13px 16px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            {/* Slush logo — blue S */}
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="slushG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7dd3fc" />
                  <stop offset="100%" stopColor="#1d6fca" />
                </linearGradient>
              </defs>
              <path
                d="M 74 22 C 74 13, 62 8, 46 11 C 30 14, 18 26, 22 40 C 25 52, 44 56, 56 62 C 68 68, 80 76, 76 88 C 73 97, 60 102, 46 99 C 32 96, 22 86, 24 78"
                stroke="url(#slushG)"
                strokeWidth="15"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            Connect with Slush
          </button>
          {/* Hidden real ConnectButton — triggered programmatically */}
          <div
            id="hidden-dappkit-connect-btn"
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
            aria-hidden="true"
          >
            <ConnectButton />
          </div>
        </div>
        <p style={{ color: '#444', fontSize: '11px', textAlign: 'center', margin: '8px 0 0' }}>
          For Sui Wallet browser extension users
        </p>
      </div>

      {/* Divider */}
      <div style={dividerStyle}>
        <div style={dividerLineStyle} />
        <span style={dividerTextStyle}>or</span>
        <div style={dividerLineStyle} />
      </div>

      {/* Section 2 — In-App Wallet (SECONDARY) */}
      <div style={{ marginTop: '20px' }}>
        <p style={sectionLabelStyle}>Sentinel In-App Wallet</p>
        <InAppWalletPanel onClose={onClose} setInAppAuth={setInAppAuth} />
        <p style={{ color: '#444', fontSize: '11px', textAlign: 'center', margin: '10px 0 0' }}>
          No extension needed — works everywhere
        </p>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Mobile Bottom Sheet ─────────────────────────────────────────────────────

const MobileBottomSheet: React.FC<ModalProps> = ({ onClose, setInAppAuth }) => (
  <motion.div
    id="auth-modal-overlay-mobile"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
    }}
  >
    <motion.div
      id="auth-modal-sheet"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{
        width: '100%', maxWidth: '500px',
        background: '#111', borderTop: '1px solid #222',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 36px',
        boxShadow: '0 -16px 64px rgba(0,0,0,0.7)',
        position: 'relative',
      }}
    >
      {/* Drag handle */}
      <div style={{
        width: '40px', height: '4px', borderRadius: '2px',
        background: '#333', margin: '0 auto 20px',
      }} />

      {/* Close */}
      <button
        id="auth-sheet-close"
        onClick={onClose}
        style={{ position: 'absolute', top: '16px', right: '16px', ...iconBtnStyle }}
      >
        <X size={16} />
      </button>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <Logo size={32} />
        <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: 700, margin: 0 }}>Sign In to Sentinel</h2>
      </div>

      {/* In-App Wallet only — NO ConnectButton on mobile web */}
      <p style={{ ...sectionLabelStyle, textAlign: 'center', marginBottom: '16px' }}>
        Set up your wallet
      </p>
      <InAppWalletPanel onClose={onClose} setInAppAuth={setInAppAuth} />
    </motion.div>
  </motion.div>
);

// ─── Style helpers ────────────────────────────────────────────────────────────

const btnStyle = (bg: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '8px', width: '100%', padding: '11px 16px',
  background: bg, border: 'none', borderRadius: '10px',
  color: '#fff', fontSize: '14px', fontWeight: 600,
  cursor: 'pointer', transition: 'background 0.15s',
});

const hoverIn = (e: React.MouseEvent<HTMLButtonElement>, color: string) => {
  (e.currentTarget as HTMLButtonElement).style.background = color;
};
const hoverOut = (e: React.MouseEvent<HTMLButtonElement>, color: string) => {
  (e.currentTarget as HTMLButtonElement).style.background = color;
};



const keyTextareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: '#0d0d0d', border: '1px solid #2a2a2a',
  borderRadius: '8px', color: '#ccc', fontSize: '12px',
  fontFamily: 'monospace', resize: 'none', boxSizing: 'border-box',
};

const copyBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'transparent', border: '1px solid #2a2a2a',
  borderRadius: '7px', color: '#888', fontSize: '12px',
  padding: '6px 12px', cursor: 'pointer', width: '100%',
  justifyContent: 'center', transition: 'all 0.15s',
};

const warningBoxStyle: React.CSSProperties = {
  display: 'flex', gap: '8px', alignItems: 'flex-start',
  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: '8px', padding: '10px 12px', marginTop: '10px',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  cursor: 'pointer', marginTop: '12px',
};

const iconBtnStyle: React.CSSProperties = {
  position: 'absolute', top: '10px', right: '10px',
  background: 'transparent', border: 'none',
  color: '#666', cursor: 'pointer', padding: '6px',
  borderRadius: '6px', display: 'flex', alignItems: 'center',
};

const sectionLabelStyle: React.CSSProperties = {
  color: '#666', fontSize: '12px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  margin: '0 0 10px',
};

const dividerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
};
const dividerLineStyle: React.CSSProperties = {
  flex: 1, height: '1px', background: '#1e1e1e',
};
const dividerTextStyle: React.CSSProperties = {
  color: '#444', fontSize: '12px', fontWeight: 500,
  flexShrink: 0,
};
