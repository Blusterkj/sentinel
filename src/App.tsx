// src/App.tsx
// Main app shell — sidebar nav, page routing, global incident state

// localStorage keys for persistence
const USER_INCIDENTS_KEY = 'sentinel_user_incidents';
const INCIDENT_UPDATES_KEY = 'sentinel_incident_updates';

import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Report } from './pages/Report';
import { Memory } from './pages/Memory';
import { Agent } from './pages/Agent';
import { Activity } from './pages/Activity';
import { NearbyAlerts } from './components/NearbyAlerts';
import { Logo } from './components/Logo';
import { MobileHeader } from './components/MobileHeader';
import { BottomTabBar } from './components/BottomTabBar';
import { SosButton } from './components/SosButton';
import { KeyBackupScreen } from './components/KeyBackupScreen';
import { DemoTrigger } from './components/DemoTrigger';
import { buildSimulatedIncident } from './components/DemoButton';
import { useSecretDemo } from './hooks/useSecretDemo';
import type { Incident } from './types/incident';
import {
  LayoutDashboard,
  AlertTriangle,
  Database,
  Brain,
  Hexagon,
  Menu,
  BarChart3,
  Lock,
  LogOut,
  User,
  Wallet,
} from 'lucide-react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { WalletGuard } from './components/WalletGuard';
import { AuthModal } from './components/AuthModal';
import { useAuthStore } from './lib/authStore';
import { loadWallet, generateWallet, saveWallet, clearWallet } from './lib/inAppWallet';

type Page = 'landing' | 'dashboard' | 'analytics' | 'report' | 'memory' | 'agent' | 'activity';

const NAV_ITEMS: {
  id: Page;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  path: string;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, path: '/analytics' },
  { id: 'report', label: 'Report Incident', icon: <AlertTriangle size={18} />, path: '/report' },
  { id: 'memory', label: 'Memory', icon: <Database size={18} />, badge: 'Walrus', path: '/memory' },
  { id: 'agent', label: 'AI Agent', icon: <Brain size={18} />, badge: 'MemWal', path: '/agent' },
  { id: 'activity', label: 'My Activity', icon: <User size={18} />, path: '/activity' },
];



export default function App() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { address: inAppAddress, setInAppAuth, clearAuth } = useAuthStore();
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showDesktopAuthModal, setShowDesktopAuthModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>(
    'landing'
  );

  // ── APK KeyBackupScreen state ──
  const [showKeyBackup, setShowKeyBackup] = useState(false);
  const [backupWallet, setBackupWallet] = useState<{
    address: string; privateKey: string; mnemonic: string;
  } | null>(null);

  // ── Load persisted in-app wallet on mount ──
  useEffect(() => {
    (async () => {
      const existing = await loadWallet();
      if (existing) {
        // Wallet found — silently authenticate
        setInAppAuth(existing.address, existing.privateKey);
      } else if (Capacitor.isNativePlatform()) {
        // APK first launch — auto-generate wallet and show backup screen
        try {
          const wallet = await generateWallet();
          await saveWallet(wallet.privateKey);
          setBackupWallet(wallet);
          setShowKeyBackup(true);
        } catch (err) {
          console.error('Failed to generate wallet on APK first launch', err);
        }
      }
      // Web (no wallet) — WalletGuard handles auth prompting
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load persisted incidents on mount ──
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    // Start with only real user-submitted incidents from localStorage
    let merged: Incident[] = [];

    // Load user-created incidents from localStorage
    try {
      const raw = localStorage.getItem(USER_INCIDENTS_KEY);
      if (raw) {
        merged = JSON.parse(raw) as Incident[];
      }
    } catch {
      // Corrupted data — ignore
    }

    // Apply persisted updates (resolved / status changes)
    try {
      const raw = localStorage.getItem(INCIDENT_UPDATES_KEY);
      if (raw) {
        const updates: Record<string, Partial<Incident>> = JSON.parse(raw);
        merged = merged
          .filter((inc) => {
            const u = updates[inc.id];
            // If marked as __deleted, remove it
            return !(u && (u as any).__deleted);
          })
          .map((inc) => {
            const u = updates[inc.id];
            return u ? { ...inc, ...u } : inc;
          });
      }
    } catch {
      // Corrupted data — ignore
    }

    return merged;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [criticalFilter, setCriticalFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState(false);
  const [actionVisible, setActionVisible] = useState(false);

  // Desktop keyboard sequence activation
  useSecretDemo(() => setActionVisible(true));

  // No-arg version for MobileHeader inline button
  const runSimulate = () => {
    buildSimulatedIncident().then((incident) => handleNewIncident(incident));
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/') setCurrentPage('landing');
      else if (path === '/dashboard') setCurrentPage('dashboard');
      else if (path === '/analytics') setCurrentPage('analytics');
      else if (path === '/report') setCurrentPage('report');
      else if (path === '/memory') setCurrentPage('memory');
      else if (path === '/agent') setCurrentPage('agent');
      else if (path === '/activity') setCurrentPage('activity');
    };
    window.addEventListener('popstate', handlePopState);
    handlePopState();
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (page: Page, path: string) => {
    setCurrentPage(page);
    window.history.pushState({}, '', path);
  };

  // ── Persist user-created incidents to localStorage ──
  const persistUserIncident = (incident: Incident) => {
    try {
      const raw = localStorage.getItem(USER_INCIDENTS_KEY);
      const existing: Incident[] = raw ? JSON.parse(raw) : [];
      // Prepend new incident, dedupe by ID
      const updated = [incident, ...existing.filter((i) => i.id !== incident.id)];
      localStorage.setItem(USER_INCIDENTS_KEY, JSON.stringify(updated));
    } catch {
      // Storage full or unavailable — not fatal
    }
  };

  // ── Persist status updates (resolve, etc.) to localStorage ──
  const persistIncidentUpdate = (id: string, updates: Partial<Incident> & { __deleted?: boolean }) => {
    try {
      const raw = localStorage.getItem(INCIDENT_UPDATES_KEY);
      const existing: Record<string, Partial<Incident>> = raw ? JSON.parse(raw) : {};
      existing[id] = { ...(existing[id] || {}), ...updates };
      localStorage.setItem(INCIDENT_UPDATES_KEY, JSON.stringify(existing));
    } catch {
      // Storage full or unavailable — not fatal
    }
  };

  const handleNewIncident = (incident: Incident) => {
    setIncidents((prev) => [incident, ...prev]);
    persistUserIncident(incident);
  };

  // Callback to update a single incident's fields (used by seeding hook)
  const updateIncident = useCallback((id: string, updates: Partial<Incident>) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, ...updates } : inc))
    );
    // Persist status changes (e.g. resolved) so they survive refresh
    if (updates.status) {
      persistIncidentUpdate(id, updates);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteIncident = useCallback((id: string) => {
    setIncidents((prev) => prev.filter((inc) => inc.id !== id));
    // Mark as deleted in persisted updates
    persistIncidentUpdate(id, { __deleted: true } as any);
    // Also remove from user incidents if it was user-created
    try {
      const raw = localStorage.getItem(USER_INCIDENTS_KEY);
      if (raw) {
        const existing: Incident[] = JSON.parse(raw);
        const updated = existing.filter((i) => i.id !== id);
        localStorage.setItem(USER_INCIDENTS_KEY, JSON.stringify(updated));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── APK first launch: show full-screen KeyBackupScreen ──
  if (showKeyBackup && backupWallet && Capacitor.isNativePlatform()) {
    return (
      <AnimatePresence>
        <KeyBackupScreen
          key="key-backup"
          address={backupWallet.address}
          privateKey={backupWallet.privateKey}
          mnemonic={backupWallet.mnemonic}
          onContinue={() => {
            setInAppAuth(backupWallet.address, backupWallet.privateKey);
            setShowKeyBackup(false);
          }}
        />
      </AnimatePresence>
    );
  }

  return (
    <div
      className="flex flex-col md:flex-row mobile-app-root"
      style={{
        height: '100vh',
        width: '100vw',
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* Mobile-only Header — in normal flow, not fixed */}
      <MobileHeader
        onActivate={() => setActionVisible(true)}
        actionVisible={actionVisible}
        onSimulate={runSimulate}
        onHide={() => setActionVisible(false)}
      />

      {/* Desktop wallet button — absolute positioned, only shown on desktop */}
      <div className="hidden md:flex" style={{ position: 'absolute', top: '8px', right: '20px', zIndex: 1000, alignItems: 'center', gap: '8px' }}>
        {/* Inline ⚡ button — only when actionVisible */}
        {actionVisible && (
          <button
            onClick={() => { runSimulate(); setActionVisible(false); }}
            style={{
              padding: '6px 10px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '7px',
              color: '#aaa',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            ⚡ Simulate
          </button>
        )}
        {/* dapp-kit connected */}
        {account ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowWalletMenu((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer' }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>
                {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </span>
            </button>

            {showWalletMenu && (
              <div className="fade-in-up" style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '4px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <button
                  onClick={() => {
                    disconnect();
                    setShowWalletMenu(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <LogOut size={14} /> Disconnect
                </button>
              </div>
            )}
          </div>
        ) : inAppAddress ? (
          /* In-app wallet connected — show chip with disconnect dropdown */
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowWalletMenu((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer' }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }} />
              <span style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>
                {inAppAddress.slice(0, 6)}...{inAppAddress.slice(-4)}
              </span>
              <span style={{ fontSize: '10px', color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                in-app
              </span>
            </button>
            {showWalletMenu && (
              <div className="fade-in-up" style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '4px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <button
                  onClick={async () => { await clearWallet(); clearAuth(); setShowWalletMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, textAlign: 'left' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <LogOut size={14} /> Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Not connected — custom Sign In button that opens AuthModal */
          <button
            id="desktop-signin-btn"
            onClick={() => setShowDesktopAuthModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', background: '#1a1a1a',
              border: '1px solid #333', borderRadius: '8px',
              color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#252525'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; }}
          >
            <Wallet size={15} />
            Sign In
          </button>
        )}
      </div>

      {/* Content row: sidebar (desktop only) + main */}
      <div className="flex flex-row flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside
        className="hidden md:flex"
        style={{
          width: sidebarCollapsed ? '60px' : '220px',
          background: '#0d0d0d',
          borderRight: '1px solid #1a1a1a',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
          overflow: 'hidden',
          willChange: 'width',
        }}
      >
        {/* Header: Hamburger + Logo */}
        <div
          style={{
            padding: sidebarCollapsed ? '20px 12px' : '20px 20px',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            flexDirection: sidebarCollapsed ? 'column-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: sidebarCollapsed ? '16px' : '10px',
            flexShrink: 0,
          }}
        >
          {/* Logo + title — tap 5x on mobile to activate ⚡ */}
          <DemoTrigger onActivate={() => setActionVisible(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? '0px' : '10px' }}>
              <div style={{ flexShrink: 0 }}>
                <Logo size={28} />
              </div>
              <div style={{ 
                opacity: sidebarCollapsed ? 0 : 1, 
                width: sidebarCollapsed ? 0 : '110px',
                transition: 'all 0.15s ease', 
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #e5e5e5, #999)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '0.02em',
                  }}
                >
                  SENTINEL
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    color: '#444',
                    fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    marginTop: '1px',
                  }}
                >
                  SUI OVERFLOW 2026
                </div>
              </div>
            </div>
          </DemoTrigger>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{
              padding: '6px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#555',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              marginRight: sidebarCollapsed ? '0px' : '8px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#555';
            }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            const isReport = item.id === 'report';

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => navigate(item.id, item.path)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  borderRadius: '8px',
                  border: isReport && !isActive
                    ? '1px solid rgba(239, 68, 68, 0.2)'
                    : isActive
                    ? '1px solid rgba(59, 130, 246, 0.3)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'rgba(59, 130, 246, 0.1)'
                    : isReport && !isActive
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'transparent',
                  color: isActive
                    ? '#3b82f6'
                    : isReport && !isActive
                    ? '#ef4444'
                    : '#666',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  transition: 'all 0.15s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      isReport ? 'rgba(239, 68, 68, 0.08)' : '#151515';
                    (e.currentTarget as HTMLButtonElement).style.color =
                      isReport ? '#ef4444' : '#ccc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      isReport ? 'rgba(239, 68, 68, 0.05)' : 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color =
                      isReport ? '#ef4444' : '#666';
                  }
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flex: 1, 
                  opacity: sidebarCollapsed ? 0 : 1, 
                  transition: 'opacity 0.15s', 
                  whiteSpace: 'nowrap',
                  marginLeft: sidebarCollapsed ? '0px' : '10px'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {item.label}
                    {!account && !inAppAddress && (item.id === 'report' || item.id === 'agent' || item.id === 'activity') && (
                      <Lock size={12} color="#666" />
                    )}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        color: '#8b5cf6',
                        background: 'rgba(139, 92, 246, 0.12)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        marginLeft: '8px'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Active dot on collapsed sidebar */}
                {sidebarCollapsed && isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: collapse toggle + critical count */}
        <div
          style={{
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Critical alert badge removed */}



          {/* Walrus badge */}
          <div
            style={{
              padding: '6px 10px',
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex' }}>
              <Hexagon size={10} color="#8b5cf6" />
            </div>
            <span
              style={{
                fontSize: '10px',
                color: '#666',
                fontFamily: 'monospace',
              }}
            >
              Powered by Walrus
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <NearbyAlerts />
        {currentPage === 'landing' && <Landing />}
        {currentPage === 'dashboard' && (
          <Dashboard 
            incidents={incidents} 
            criticalFilter={criticalFilter}
            setCriticalFilter={setCriticalFilter}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            onResolveIncident={(id) => updateIncident(id, { status: 'resolved' })}
            onDeleteIncident={deleteIncident}
            sidebarCollapsed={sidebarCollapsed}
          />
        )}
        {currentPage === 'analytics' && <Analytics incidents={incidents} />}
        {currentPage === 'report' && (
          <WalletGuard>
            <Report onIncidentSubmitted={handleNewIncident} />
          </WalletGuard>
        )}
        {currentPage === 'memory' && <Memory incidents={incidents} />}
        {currentPage === 'agent' && (
          <WalletGuard>
            <Agent incidents={incidents} />
          </WalletGuard>
        )}
        {currentPage === 'activity' && (
          <WalletGuard>
            <Activity
              incidents={incidents}
              onNavigateReport={() => {
                setCurrentPage('report');
                window.history.pushState({}, '', '/report');
              }}
            />
          </WalletGuard>
        )}

        {/* Global SOS Button - hidden on landing page */}
        {currentPage !== 'landing' && (
          <div className="md:contents">
            <SosButton onSosSubmitted={handleNewIncident} />
          </div>
        )}
      </main>
      </div>{/* end content row */}

      {/* Mobile-only Tab Bar — in normal flow at bottom */}
      <BottomTabBar
        currentPage={currentPage}
        navigate={(page) => {
          setCurrentPage(page as Page);
          window.history.pushState({}, '', `/${page}`);
          window.dispatchEvent(new Event('popstate'));
        }}
      />
      <AnimatePresence>
        {showDesktopAuthModal && (
          <AuthModal onClose={() => setShowDesktopAuthModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}


