import React from 'react';
import { Shield, ChevronRight, Activity, Zap, Database } from 'lucide-react';

export const Landing: React.FC = () => {
  const navigate = () => {
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div style={{ height: '100%', width: '100%', overflowX: 'hidden', overflowY: 'auto', background: '#0a0a0a', position: 'relative' }}>
      {/* Background gradients */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '60%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '60%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)' }} />
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', zIndex: 1, position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '999px', marginBottom: '32px' }}>
          <Zap size={14} color="#3b82f6" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa', letterSpacing: '0.05em' }}>SUI OVERFLOW 2026</span>
        </div>
        
        <h1 style={{ fontSize: '64px', fontWeight: 800, textAlign: 'center', marginBottom: '24px', lineHeight: 1.1, background: 'linear-gradient(135deg, #ffffff 0%, #a3a3a3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Next-Gen Community <br /> Safety Platform
        </h1>
        
        <p style={{ fontSize: '20px', color: '#888', textAlign: 'center', maxWidth: '700px', marginBottom: '48px', lineHeight: 1.6 }}>
          Sentinel combines decentralized Walrus storage, real-time alerting, and autonomous MemWal AI agents to build a self-healing, cryptographically secure incident tracking network.
        </p>
        
        <button
          onClick={navigate}
          style={{
            padding: '16px 32px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '18px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.6)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(59, 130, 246, 0.4)';
          }}
        >
          Launch Dashboard <ChevronRight size={20} />
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '80px', width: '100%' }}>
          {[
            { icon: <Database size={24} color="#8b5cf6" />, title: 'Immutable Memory', desc: 'Incidents permanently archived on the Walrus network, bypassing censorship and data loss.' },
            { icon: <Activity size={24} color="#22c55e" />, title: 'Real-Time Telemetry', desc: 'Instantly broadcasts verified incidents to nearby citizens and first responder nodes.' },
            { icon: <Shield size={24} color="#3b82f6" />, title: 'Agentic Analysis', desc: 'Llama 3.3 agent continuously triages, analyzes, and correlates incoming threats.' },
          ].map((feat, i) => (
            <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '32px', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>{feat.title}</h3>
              <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.6 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
