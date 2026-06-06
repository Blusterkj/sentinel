// src/components/AuthModal.tsx
// Platform-aware authentication modal for web (desktop + mobile web).
// NEVER rendered on APK — APK uses KeyBackupScreen instead.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ConnectButton } from '@mysten/dapp-kit';
import { Copy, Check, Eye, EyeOff, AlertTriangle, Wallet, Key, X, ChevronLeft } from 'lucide-react';
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

// ─── Shared Slush Trigger ────────────────────────────────────────────────────

const SlushButton: React.FC<{ id: string }> = ({ id }) => (
  <div style={{ position: 'relative' }}>
    <button
      id={id}
      onClick={() => {
        const hidden = document.getElementById(`hidden-connect-${id}`);
        if (hidden) hidden.querySelector('button')?.click();
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '13px 16px',
        background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
        border: 'none', borderRadius: '12px',
        color: '#fff', fontSize: '15px', fontWeight: 700,
        cursor: 'pointer', transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
    >
      <img src="/slush-logo.svg" width={26} height={26} alt="Slush" style={{ borderRadius: '6px' }} />
      Connect with Slush
    </button>
    <div
      id={`hidden-connect-${id}`}
      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
      aria-hidden="true"
    >
      <ConnectButton />
    </div>
  </div>
);

// ─── Shared In-App Wallet Panel ──────────────────────────────────────────────

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
        <CreateWalletView onBack={() => setView('menu')} onClose={onClose} setInAppAuth={setInAppAuth} />
      )}
      {view === 'import' && (
        <ImportWalletView onBack={() => setView('menu')} onClose={onClose} setInAppAuth={setInAppAuth} />
      )}
    </div>
  );
};

const InAppMenu: React.FC<{ onSelect: (v: InAppView) => void }> = ({ onSelect }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <button
      id="auth-create-wallet-btn"
      onClick={() => onSelect('create')}
      style={btnStyle('#2563eb')}
      onMouseEnter={(e) => hoverIn(e, '#1d4ed8')}
      onMouseLeave={(e) => hoverOut(e, '#2563eb')}
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
      Import Existing Wallet
    </button>
  </div>
);

// ─── Create Wallet View ──────────────────────────────────────────────────────

const CreateWalletView: React.FC<{
  onBack: () => void;
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}> = ({ onBack, onClose, setInAppAuth }) => {
  const [generated, setGenerated] = useState<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setLoading(true);
    generateWallet().then(setGenerated).finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(
      `Recovery Phrase:\n${generated.mnemonic}\n\nPrivate Key:\n${generated.privateKey}\n\nAddress:\n${generated.address}`
    );
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button onClick={onBack} style={backBtnStyle}>
        <ChevronLeft size={14} /> Back
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#555', padding: '20px' }}>Generating wallet…</div>
      ) : generated ? (
        <>
          <div>
            <p style={fieldLabelStyle}>Recovery Phrase</p>
            <textarea
              readOnly
              id="wallet-mnemonic-display"
              value={generated.mnemonic}
              rows={3}
              style={{ ...keyTextareaStyle, color: '#e2e8f0', background: '#0d1117', borderColor: '#2d3748' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ ...fieldLabelStyle, margin: 0 }}>Private Key</p>
              <button
                onClick={() => setShowKey((v) => !v)}
                style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#555', cursor: 'pointer', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <textarea
              readOnly
              id="wallet-key-display"
              value={showKey ? generated.privateKey : '•'.repeat(52)}
              rows={2}
              style={keyTextareaStyle}
            />
          </div>

          <button id="copy-wallet-key-btn" onClick={handleCopy} style={copyBtnStyle}>
            {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>

          <div style={warningBoxStyle}>
            <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '12px', color: '#f59e0b', lineHeight: '1.5' }}>
              Save this — <strong>you cannot recover your wallet without it.</strong>
            </span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '4px' }}>
            <input
              id="saved-key-checkbox"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ accentColor: '#3b82f6', width: '16px', height: '16px', flexShrink: 0 }}
            />
            <span style={{ fontSize: '13px', color: '#ccc' }}>I've saved my recovery phrase</span>
          </label>

          <button
            id="confirm-wallet-btn"
            onClick={handleConfirm}
            disabled={!confirmed}
            style={{
              ...btnStyle(confirmed ? '#2563eb' : '#1f2937'),
              opacity: confirmed ? 1 : 0.5,
              cursor: confirmed ? 'pointer' : 'not-allowed',
            }}
          >
            <Wallet size={16} />
            Continue
          </button>
        </>
      ) : null}
    </div>
  );
};

// ─── Import Wallet View ──────────────────────────────────────────────────────

const ImportWalletView: React.FC<{
  onBack: () => void;
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}> = ({ onBack, onClose, setInAppAuth }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    // Strip ALL whitespace + invisible Unicode chars that mobile keyboards add
    const trimmed = key.replace(/[\s\u200B\u200C\u200D\uFEFF]/g, '');
    if (!trimmed) { setError('Paste your private key first.'); return; }
    if (trimmed.startsWith('0x')) { setError("That's an address, not a private key."); return; }
    setLoading(true);
    setError('');
    try {
      const wallet = importWallet(trimmed);
      await saveWallet(wallet.privateKey);
      setInAppAuth(wallet.address, wallet.privateKey);
      onClose();
    } catch (e: any) {
      console.error('[ImportWallet] failed:', e?.message, '| key prefix:', trimmed.slice(0, 20));
      setError('Invalid private key — must start with suiprivkey1');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button onClick={onBack} style={backBtnStyle}>
        <ChevronLeft size={14} /> Back
      </button>

      <textarea
        id="import-key-input"
        value={key}
        onChange={(e) => { setKey(e.target.value); setError(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!loading && key.trim()) handleImport();
          }
        }}
        placeholder="Paste private key (suiprivkey1…)"
        rows={3}
        style={keyTextareaStyle}
      />

      {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{error}</p>}

      <button
        id="import-wallet-submit-btn"
        onClick={handleImport}
        disabled={loading || !key.trim()}
        style={{
          ...btnStyle('#2563eb'),
          opacity: loading || !key.trim() ? 0.45 : 1,
          cursor: loading || !key.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        <Key size={16} />
        {loading ? 'Importing…' : 'Import Wallet'}
      </button>
    </div>
  );
};

// ─── Shared modal inner content ──────────────────────────────────────────────

interface ModalProps {
  onClose: () => void;
  setInAppAuth: (address: string, privateKey: string) => void;
}

const ModalContent: React.FC<ModalProps & { slushId: string }> = ({ onClose, setInAppAuth, slushId }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
    {/* Header */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
      <Logo size={44} />
      <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: '0 0 2px', letterSpacing: '0.04em' }}>
        SENTINEL
      </h2>
      <p style={{ color: '#4b5563', fontSize: '12px', margin: 0 }}>Sign in to continue</p>
    </div>

    {/* Slush — primary */}
    <SlushButton id={slushId} />

    {/* Divider */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
      <div style={{ flex: 1, height: '1px', background: '#1e1e1e' }} />
      <span style={{ color: '#374151', fontSize: '12px' }}>or use in-app wallet</span>
      <div style={{ flex: 1, height: '1px', background: '#1e1e1e' }} />
    </div>

    {/* In-App Wallet */}
    <InAppWalletPanel onClose={onClose} setInAppAuth={setInAppAuth} />
  </div>
);

// ─── Desktop Modal ───────────────────────────────────────────────────────────

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
        width: '100%', maxWidth: '400px', margin: '0 16px',
        background: '#0e0e0e', border: '1px solid #1c1c1c',
        borderRadius: '18px', padding: '28px 24px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
        position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}
    >
      <button
        id="auth-modal-close"
        onClick={onClose}
        style={closeBtnStyle}
      >
        <X size={15} />
      </button>
      <ModalContent onClose={onClose} setInAppAuth={setInAppAuth} slushId="desktop-slush" />
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
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
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
        background: '#0e0e0e', borderTop: '1px solid #1c1c1c',
        borderRadius: '22px 22px 0 0',
        padding: '16px 20px 36px',
        boxShadow: '0 -20px 80px rgba(0,0,0,0.8)',
        position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}
    >
      {/* Drag handle */}
      <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#2a2a2a', margin: '0 auto 20px' }} />
      <button id="auth-sheet-close" onClick={onClose} style={closeBtnStyle}>
        <X size={15} />
      </button>
      <ModalContent onClose={onClose} setInAppAuth={setInAppAuth} slushId="mobile-slush" />
    </motion.div>
  </motion.div>
);

// ─── Style helpers ────────────────────────────────────────────────────────────

const btnStyle = (bg: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '8px', width: '100%', padding: '12px 16px',
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

const fieldLabelStyle: React.CSSProperties = {
  color: '#4b5563', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
};

const keyTextareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: '#0d0d0d', border: '1px solid #222',
  borderRadius: '8px', color: '#ccc', fontSize: '12px',
  fontFamily: 'monospace', resize: 'none', boxSizing: 'border-box',
};

const copyBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'transparent', border: '1px solid #222',
  borderRadius: '7px', color: '#6b7280', fontSize: '12px',
  padding: '7px 12px', cursor: 'pointer', width: '100%',
  justifyContent: 'center',
};

const warningBoxStyle: React.CSSProperties = {
  display: 'flex', gap: '8px', alignItems: 'flex-start',
  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)',
  borderRadius: '8px', padding: '10px 12px',
};

const backBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  background: 'transparent', border: 'none',
  color: '#6b7280', fontSize: '12px', cursor: 'pointer',
  padding: '0', marginBottom: '4px',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute', top: '14px', right: '14px',
  background: 'transparent', border: 'none',
  color: '#4b5563', cursor: 'pointer', padding: '6px',
  borderRadius: '6px', display: 'flex', alignItems: 'center',
};
