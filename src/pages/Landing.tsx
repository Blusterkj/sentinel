import React from 'react';
import { Shield, ChevronRight, Activity, Zap, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export const Landing: React.FC = () => {
  const navigate = () => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new Event('popstate'));
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: any = {
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
        style={{ position: 'absolute', top: '0%', left: '10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{ position: 'absolute', bottom: '-10%', right: '5%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} 
      />

      {/* Extra floating orbs behind hero text */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.15, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', top: '15%', left: '35%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 20, 0], scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{ position: 'absolute', top: '25%', right: '25%', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ x: [0, 25, 0], y: [0, -15, 0], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        style={{ position: 'absolute', top: '10%', right: '15%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }}
      />

      {/* Animated wavy SVG pattern */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', opacity: 0.08 }}>
        <svg viewBox="0 0 1440 500" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
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
        
        <motion.div variants={itemVariants} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <button
            onClick={navigate}
            style={{
              padding: '18px 36px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: '1px solid rgba(96, 165, 250, 0.5)',
              borderRadius: '16px',
              color: 'white',
              fontSize: '18px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 12px 32px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 16px 48px rgba(37, 99, 235, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
            }}
          >
            Launch Dashboard <ChevronRight size={20} />
          </button>
        </motion.div>

        <motion.div variants={containerVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '100px', width: '100%' }}>
          {[
            { icon: <Database size={26} color="#c084fc" />, color: '#c084fc', title: 'Immutable Memory', desc: 'Incidents permanently archived on the Walrus network, bypassing censorship and data loss.' },
            { icon: <Activity size={26} color="#4ade80" />, color: '#4ade80', title: 'Real-Time Telemetry', desc: 'Instantly broadcasts verified incidents to nearby citizens and first responder nodes.' },
            { icon: <Shield size={26} color="#60a5fa" />, color: '#60a5fa', title: 'Agentic Analysis', desc: 'Llama 3.3 agent continuously triages, analyzes, and correlates incoming threats.' },
          ].map((feat, i) => (
            <motion.div 
              key={i} 
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              style={{ 
                background: 'linear-gradient(180deg, rgba(24,24,27,0.8) 0%, rgba(9,9,11,0.8) 100%)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '24px', 
                padding: '40px 32px', 
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Subtle top border glow on cards */}
              <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px', background: `linear-gradient(90deg, transparent, ${feat.color}60, transparent)` }} />
              
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: `${feat.color}15`, border: `1px solid ${feat.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: `0 8px 24px ${feat.color}20` }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f4f4f5', marginBottom: '12px', letterSpacing: '-0.01em' }}>{feat.title}</h3>
              <p style={{ fontSize: '15px', color: '#a1a1aa', lineHeight: 1.6 }}>{feat.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
      </div> {/* End Inner Relative Container */}
    </div>
  );
};
