import React from 'react';
import { Shield, ChevronRight, Activity, Zap, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export const Landing: React.FC = () => {
  const navigate = () => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new Event('popstate'));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 20 }
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', overflowX: 'hidden', overflowY: 'auto', backgroundColor: '#050505', position: 'relative' }}>
      
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
        
        <motion.h1 variants={itemVariants} style={{ fontSize: 'clamp(48px, 6vw, 72px)', fontWeight: 800, textAlign: 'center', marginBottom: '24px', lineHeight: 1.1, letterSpacing: '-0.02em', background: 'linear-gradient(180deg, #ffffff 0%, #a1a1aa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Next-Gen Community <br /> Safety Platform
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
    </div>
  );
};
