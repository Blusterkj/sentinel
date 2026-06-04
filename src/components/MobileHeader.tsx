import React from 'react';
import { Shield } from 'lucide-react';
import { ConnectButton } from '@mysten/dapp-kit';

export const MobileHeader: React.FC = () => {
  return (
    <div
      className="flex md:hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: '#0a0a0a',
        borderBottom: '1px solid #1a1a1a',
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={20} color="#eab308" />
        <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.1em' }}>SENTINEL</span>
      </div>
      <div>
        <ConnectButton
          style={{
            fontSize: '13px',
            padding: '6px 12px',
            height: '32px',
            minHeight: '32px',
            borderRadius: '6px',
          }}
        />
      </div>
    </div>
  );
};
