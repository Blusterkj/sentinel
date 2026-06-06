// src/components/KeyBackupScreen.tsx
// Full-screen shown ONLY on APK first launch (Capacitor.isNativePlatform() === true).
// NEVER shown on web (desktop or mobile web).
//
// Flow:
//   1. App.tsx generates wallet on first APK launch
//   2. Renders this screen with the generated wallet data
//   3. User taps "I've saved it — Continue" → authStore set → normal app shown

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Eye, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

interface KeyBackupScreenProps {
  address: string;
  privateKey: string;
  mnemonic: string;
  onContinue: () => void;
}

export const KeyBackupScreen: React.FC<KeyBackupScreenProps> = ({
  address,
  privateKey,
  mnemonic,
  onContinue,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const backupText = `Recovery Phrase (Mnemonic):\n${mnemonic}\n\nPrivate Key (bech32):\n${privateKey}\n\nSui Address:\n${address}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(backupText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px', overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Logo size={44} />
          <h1 style={{
            color: '#fff', fontSize: '22px', fontWeight: 800,
            margin: 0, textAlign: 'center',
          }}>
            Your Wallet Was Created
          </h1>
          <p style={{ color: '#666', fontSize: '14px', margin: 0, textAlign: 'center' }}>
            A new Sui wallet was automatically generated for you.
          </p>
        </div>

        {/* Address */}
        <div style={cardStyle}>
          <p style={labelStyle}>Your Sui Address</p>
          <p style={{
            color: '#ccc', fontSize: '13px', fontFamily: 'monospace',
            wordBreak: 'break-all', margin: 0,
          }}>
            {address}
          </p>
        </div>

        {/* Private Key */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ ...labelStyle, margin: 0 }}>Private Key</p>
            <button
              id="toggle-key-visibility"
              onClick={() => setShowKey((v) => !v)}
              style={iconBtnStyle}
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? <EyeOff size={14} color="#888" /> : <Eye size={14} color="#888" />}
            </button>
          </div>
          <textarea
            id="backup-key-textarea"
            readOnly
            value={showKey ? privateKey : '•'.repeat(80)}
            rows={3}
            style={keyTextareaStyle}
          />
        </div>

        {/* Recovery Phrase — shown prominently, this is what to write down */}
        <div style={cardStyle}>
          <p style={{ ...labelStyle, color: '#22c55e' }}>✓ Recovery Phrase (12 words) — Write these down</p>
          <textarea
            id="backup-mnemonic-textarea"
            readOnly
            value={mnemonic}
            rows={3}
            style={{ ...keyTextareaStyle, color: '#e2e8f0', background: '#0d1117', borderColor: '#2d3748', fontSize: '13px' }}
          />
        </div>

        {/* Copy */}
        <button
          id="copy-backup-btn"
          onClick={handleCopy}
          style={copyBtnStyle}
        >
          {copied ? <Check size={15} color="#22c55e" /> : <Copy size={15} />}
          {copied ? 'Copied to clipboard!' : 'Copy all to clipboard'}
        </button>

        {/* Warning */}
        <div style={warningBoxStyle}>
          <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ color: '#f59e0b', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
            Save this. If you lose your device, you need this key to recover your account.{' '}
            <strong>We cannot recover it for you.</strong>
          </p>
        </div>

        {/* Confirmation */}
        <label style={checkboxLabelStyle}>
          <input
            id="backup-confirmed-checkbox"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ accentColor: '#22c55e', width: '18px', height: '18px', flexShrink: 0 }}
          />
          <span style={{ color: '#ccc', fontSize: '14px' }}>
            I've saved my private key in a safe place
          </span>
        </label>

        {/* Continue */}
        <motion.button
          id="backup-continue-btn"
          onClick={() => { if (confirmed) onContinue(); }}
          disabled={!confirmed}
          whileTap={confirmed ? { scale: 0.97 } : {}}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', padding: '14px', width: '100%',
            background: confirmed ? '#22c55e' : '#1a1a1a',
            border: 'none', borderRadius: '12px',
            color: confirmed ? '#000' : '#444',
            fontSize: '15px', fontWeight: 700,
            cursor: confirmed ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          <ShieldCheck size={17} />
          I've saved it — Continue
        </motion.button>
      </div>
    </motion.div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#111', border: '1px solid #1e1e1e',
  borderRadius: '12px', padding: '14px 16px',
};

const labelStyle: React.CSSProperties = {
  color: '#555', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: '8px',
};

const keyTextareaStyle: React.CSSProperties = {
  width: '100%', background: '#0d0d0d',
  border: '1px solid #1a1a1a', borderRadius: '8px',
  color: '#aaa', fontSize: '11px', fontFamily: 'monospace',
  padding: '10px', resize: 'none', boxSizing: 'border-box',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none',
  cursor: 'pointer', padding: '4px',
  display: 'flex', alignItems: 'center',
};

const copyBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '8px', padding: '11px',
  background: 'transparent', border: '1px solid #2a2a2a',
  borderRadius: '10px', color: '#888', fontSize: '13px',
  cursor: 'pointer', width: '100%', transition: 'all 0.15s',
};

const warningBoxStyle: React.CSSProperties = {
  display: 'flex', gap: '10px', alignItems: 'flex-start',
  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: '10px', padding: '12px 14px',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
  cursor: 'pointer',
};
