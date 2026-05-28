import React from 'react';
import { useCurrentAccount, ConnectButton } from '@mysten/dapp-kit';
import { motion } from 'framer-motion';
import { Logo } from './Logo';

export const WalletGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useCurrentAccount();

  if (account) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-md"
      style={{
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div 
        className="relative flex flex-col items-center gap-6 bg-[#151515] rounded-2xl border border-[#2a2a2a] shadow-2xl max-w-md w-full mx-4 text-center"
        style={{ padding: '48px 32px 48px 32px' }}
      >
        <Logo size={48} />
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Wallet Required</h2>
          <p className="text-[#888] text-sm">
            Connect your Sui wallet to access this feature
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
          <ConnectButton />
          
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'underline',
              cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#666'; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
};
