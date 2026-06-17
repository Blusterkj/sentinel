import React from 'react';
import { Shield, Activity, Zap, Database, Brain, Hexagon } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

export const Landing: React.FC = () => {
  const navigate = () => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new Event('popstate'));
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 20 }
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', overflowX: 'hidden', overflowY: 'auto', backgroundColor: '#050505' }}>
      <div style={{ position: 'relative', minHeight: '100%', width: '100%', overflow: 'hidden' }}>
      
      
      {/* Premium Grid Background with Radial Mask */}
      <div 
        style={{ 
          position: 'absolute', inset: 0, 
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 80%)',
          pointerEvents: 'none'
        }} 
      />

      {/* Glowing Orbs */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', top: '0%', left: '10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{ position: 'absolute', bottom: '-10%', right: '5%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} 
      />

      {/* Extra floating orbs behind hero text */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.15, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', top: '15%', left: '35%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)', pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 20, 0], scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{ position: 'absolute', top: '25%', right: '25%', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)', pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ x: [0, 25, 0], y: [0, -15, 0], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        style={{ position: 'absolute', top: '10%', right: '15%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)', pointerEvents: 'none' }}
      />

      {/* Animated wavy SVG pattern - width 100vw prevents costly resize reflows during sidebar toggle */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', bottom: 0, pointerEvents: 'none', opacity: 0.08 }}>
        <svg viewBox="0 0 1440 500" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100vw', height: '100%' }} preserveAspectRatio="none">
          <motion.path
            d="M0,200 C240,100 480,300 720,200 C960,100 1200,300 1440,200 L1440,500 L0,500 Z"
            fill="url(#wave1)"
            animate={{ d: [
              'M0,200 C240,100 480,300 720,200 C960,100 1200,300 1440,200 L1440,500 L0,500 Z',
              'M0,250 C240,150 480,350 720,250 C960,150 1200,350 1440,250 L1440,500 L0,500 Z',
              'M0,200 C240,100 480,300 720,200 C960,100 1200,300 1440,200 L1440,500 L0,500 Z'
            ] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M0,280 C360,180 720,380 1080,280 C1260,230 1380,310 1440,280 L1440,500 L0,500 Z"
            fill="url(#wave2)"
            animate={{ d: [
              'M0,280 C360,180 720,380 1080,280 C1260,230 1380,310 1440,280 L1440,500 L0,500 Z',
              'M0,310 C360,210 720,410 1080,310 C1260,260 1380,340 1440,310 L1440,500 L0,500 Z',
              'M0,280 C360,180 720,380 1080,280 C1260,230 1380,310 1440,280 L1440,500 L0,500 Z'
            ] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <defs>
            <linearGradient id="wave1" x1="0" y1="0" x2="1440" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="wave2" x1="0" y1="0" x2="1440" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mobile-hero"
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', zIndex: 1, position: 'relative' }}
      >
        <motion.div variants={itemVariants} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '999px', marginBottom: '32px', boxShadow: '0 0 20px rgba(59,130,246,0.2)' }}>
          <Zap size={14} color="#60a5fa" style={{ filter: 'drop-shadow(0 0 4px rgba(96,165,250,0.8))' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SUI OVERFLOW 2026</span>
        </motion.div>
        
        <motion.h1 variants={itemVariants} style={{ fontSize: 'clamp(48px, 6vw, 72px)', fontWeight: 800, textAlign: 'center', marginBottom: '24px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ background: 'linear-gradient(180deg, #ffffff 0%, #e4e4e7 40%, #a1a1aa 80%, #71717a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Next-Gen Community</span>
          <br />
          <span style={{ background: 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 40%, #2563eb 70%, #1d4ed8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 30px rgba(59,130,246,0.4))' }}>Safety</span>
          <span style={{ background: 'linear-gradient(180deg, #ffffff 0%, #e4e4e7 40%, #a1a1aa 80%, #71717a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> Platform</span>
        </motion.h1>
        
        <motion.p variants={itemVariants} style={{ fontSize: '20px', color: '#a1a1aa', textAlign: 'center', maxWidth: '750px', marginBottom: '48px', lineHeight: 1.6, fontWeight: 400 }}>
          Sentinel combines decentralized Walrus storage, real-time alerting, and autonomous MemWal AI agents to build a self-healing, cryptographically secure incident tracking network.
        </motion.p>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.div variants={itemVariants} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <button
              onClick={navigate}
              style={{
                width: '240px',
                height: '64px',
                background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                border: '1px solid #1e40af',
                borderRadius: '16px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 6px 0 #1e3a8a, 0 12px 24px rgba(37, 99, 235, 0.4)',
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.3), 0 8px 0 #1e3a8a, 0 16px 32px rgba(37, 99, 235, 0.5)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.2), 0 6px 0 #1e3a8a, 0 12px 24px rgba(37, 99, 235, 0.4)';
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(6px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 #1e3a8a, 0 4px 12px rgba(37, 99, 235, 0.3)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.3), 0 8px 0 #1e3a8a, 0 16px 32px rgba(37, 99, 235, 0.5)';
              }}
            >
              Launch Dashboard
            </button>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <a
              href="https://github.com/Blusterkj/sentinel"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '240px',
                height: '64px',
                background: 'linear-gradient(180deg, #2f363d 0%, #24292e 100%)',
                border: '1px solid #1b1f23',
                borderRadius: '16px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textDecoration: 'none',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 0 #15181c, 0 12px 24px rgba(0,0,0,0.4)',
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(180deg, #384048 0%, #2c3137 100%)';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 0 #15181c, 0 16px 28px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(180deg, #2f363d 0%, #24292e 100%)';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 0 #15181c, 0 12px 24px rgba(0,0,0,0.4)';
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(6px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 #15181c, 0 4px 12px rgba(0,0,0,0.3)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 0 #15181c, 0 16px 28px rgba(0,0,0,0.5)';
              }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"></path></svg> View Source
            </a>
          </motion.div>
        </div>

        {/* ── Stats / highlights bar ── */}
        <motion.div
          variants={itemVariants}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
            marginTop: '56px',
            marginBottom: '0px',
          }}
        >
          {[
            { icon: <Database size={14} color="#a78bfa" />, label: 'Decentralized Walrus Storage', accent: '#a78bfa' },
            { icon: <Activity size={14} color="#4ade80" />, label: 'Real-Time FCM Alerts', accent: '#4ade80' },
            { icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>📡</span>, label: '20km Alert Radius', accent: '#38bdf8' },
            { icon: <Hexagon size={14} color="#fb923c" />, label: 'On-Chain Verified Proof', accent: '#fb923c' },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                background: `${stat.accent}0d`,
                border: `1px solid ${stat.accent}28`,
                borderRadius: '999px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = `${stat.accent}1a`;
                (e.currentTarget as HTMLDivElement).style.borderColor = `${stat.accent}55`;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = `${stat.accent}0d`;
                (e.currentTarget as HTMLDivElement).style.borderColor = `${stat.accent}28`;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}
            >
              {stat.icon}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.02em' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* ── Feature cards ── */}
        <motion.div variants={containerVariants} className="mobile-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '56px', width: '100%' }}>
          {[
            {
              icon: <Database size={26} color="#c084fc" />,
              color: '#c084fc',
              title: 'Dual-Store Persistence',
              desc: 'Every incident write goes to both MemWal (encrypted, agent-queryable) and the Walrus Testnet Publisher — returning a publicly verifiable blob ID you can check on Walruscan. Nothing is mocked.',
            },
            {
              icon: <Activity size={26} color="#4ade80" />,
              color: '#4ade80',
              title: 'Real-Time Radius Alerting',
              desc: 'WebSocket layer pushes nearby-incident alerts using Haversine distance filtering — 5km for in-app, 20km for FCM push — with anonymous session IDs so alerting never requires an account.',
            },
            {
              icon: <Shield size={26} color="#60a5fa" />,
              color: '#60a5fa',
              title: 'On-Chain Verified Proof',
              desc: 'A Move smart contract deployed to Sui testnet anchors incident integrity. Incident views surface the blockchain proof without burying the human-readable report — proof collapsed by default.',
            },
            {
              icon: <Brain size={26} color="#f472b6" />,
              color: '#f472b6',
              title: 'AI Agent with Split Memory',
              desc: 'Built on MemWal + Gemini 2.5 Flash. Personal chat memory is wallet-filtered and private; incident memory is a public transparency ledger — toggled via separate tabs in the Memory Explorer.',
            },
            {
              icon: <Hexagon size={26} color="#fb923c" />,
              color: '#fb923c',
              title: 'Cross-Platform Wallet',
              desc: 'Desktop users connect via Slush wallet; mobile/APK users get an in-app Ed25519 keypair (BIP39-backed, Capacitor Preferences) — no wallet app dependency to use Sentinel on a phone.',
            },
            {
              icon: <Zap size={26} color="#fbbf24" />,
              color: '#fbbf24',
              title: 'Hyperlocal Safety Network',
              desc: 'Your neighbor gets a push notification while the situation is still relevant, not a headline the next morning. Every report is permanent, publicly auditable, and instantly actionable.',
            },
          ].map((feat, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              style={{
                background: 'linear-gradient(180deg, rgba(24,24,27,0.8) 0%, rgba(9,9,11,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderTop: `2px solid ${feat.color}55`,
                borderRadius: '24px',
                padding: '40px 32px',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Subtle top border glow on cards */}
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: `linear-gradient(90deg, transparent, ${feat.color}80, transparent)` }} />

              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: `${feat.color}15`, border: `1px solid ${feat.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: `0 8px 24px ${feat.color}20` }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f4f4f5', marginBottom: '12px', letterSpacing: '-0.01em' }}>{feat.title}</h3>
              <p style={{ fontSize: '15px', color: '#a1a1aa', lineHeight: 1.6 }}>{feat.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer attribution */}
        <motion.div
          variants={itemVariants}
          style={{
            marginTop: '80px',
            paddingBottom: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Hexagon size={12} color="#8b5cf6" />
            <span style={{ fontSize: '11px', color: '#444', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              POWERED BY WALRUS · SUI TESTNET · MEMWAL · GEMINI 2.5 FLASH
            </span>
            <Hexagon size={12} color="#8b5cf6" />
          </div>
          <a
            href="https://github.com/Blusterkj/sentinel"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: '#555', textDecoration: 'none', fontFamily: 'monospace' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#888'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#555'; }}
          >
            github.com/blusterkj/sentinel
          </a>
        </motion.div>

      </motion.div>
      </div> {/* End Inner Relative Container */}
    </div>
  );
};

