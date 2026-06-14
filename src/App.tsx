// src/App.tsx
// Main app shell — sidebar nav, page routing, global incident state

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PROXY_URL, WS_URL } from './lib/api';
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
import { useAppStore } from './store/appStore';
import { loadWallet, generateWallet, saveWallet, clearWallet } from './lib/inAppWallet';

type Page = 'landing' | 'dashboard' | 'analytics' | 'report' | 'memory' | 'agent' | 'activity';

const NAV_ITEMS: {
  id: Page;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  path: string;
  count?: number;
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
  const { clearAgentMessages } = useAppStore();
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

  // ── Incident state — loaded from proxy, polled every 5s ──
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Count of user's own real incidents (for sidebar badge)
  const address = account?.address || inAppAddress;
  const myIncidentCount = incidents.filter(i =>
    !i.isSimulated && (
      (address && i.reportedBy && i.reportedBy.toLowerCase() === address.toLowerCase()) ||
      i.createdByMe
    )
  ).length;

  const fetchIncidents = useCallback(async () => {
    try {
      const url = `${PROXY_URL}/api/incidents`;
      console.log('[SENTINEL] fetchIncidents URL:', url);
      const res = await fetch(url);
      if (!res.ok) {
        setFetchError(true);
        return;
      }
      const data = await res.json();
      const fetched: Incident[] = data.incidents ?? [];
      setFetchError(false);
      setIncidents((prev) => {
        // Merge: keep any optimistic local-only incidents (no walrusBlobId yet)
        // that haven't been echoed back from the proxy yet
        const fetchedIds = new Set(fetched.map((i) => i.id));
        const localOnly = prev.filter((i) => !fetchedIds.has(i.id) && !i.walrusBlobId);

        // When a server incident overwrites a local one, preserve uploadStatus so
        // the "Storing…" dot / "failed" retry button survive the poll cycle.
        // Once uploadStatus is 'confirmed' we clear it (undefined) so no indicator shows.
        const merged = fetched.map((serverInc) => {
          const existing = prev.find((local) => local.id === serverInc.id);
          const preservedStatus =
            existing?.uploadStatus === 'confirmed'
              ? undefined          // confirmed → no indicator needed
              : existing?.uploadStatus; // pending/failed → keep showing
          return { ...serverInc, uploadStatus: preservedStatus };
        });

        return [...localOnly, ...merged].sort((a, b) => {
          const timeA = new Date(a.timestamp || a.createdAt || 0).getTime() || 0;
          const timeB = new Date(b.timestamp || b.createdAt || 0).getTime() || 0;
          return timeB - timeA;
        });
      });
    } catch {
      // Network unavailable — keep current state, retry next tick
      setFetchError(true);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    pollRef.current = setInterval(fetchIncidents, 5_000);
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebSocket — real-time cross-device sync ──────────────────
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
        console.log('[SENTINEL] WebSocket connecting to:', WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[SENTINEL] WS connected');
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[SENTINEL] WS message received:', data.type);
            if (data.type === 'NEW_INCIDENT' && data.incident) {
              setIncidents((prev) => {
                // Preserve uploadStatus from any local optimistic copy
                // (Sui tx may still be running when proxy broadcasts NEW_INCIDENT)
                const existing = prev.find(i => i.id === data.incident.id);
                const preservedStatus =
                  existing?.uploadStatus === 'confirmed'
                    ? undefined
                    : existing?.uploadStatus;
                const merged = { ...data.incident, uploadStatus: preservedStatus };
                const filtered = prev.filter(i => i.id !== data.incident.id);
                return [merged, ...filtered].sort((a, b) => {
                  const timeA = new Date(a.timestamp || a.createdAt || 0).getTime() || 0;
                  const timeB = new Date(b.timestamp || b.createdAt || 0).getTime() || 0;
                  return timeB - timeA;
                });
              });
            } else if (data.type === 'INCIDENT_UPDATED' && data.incident) {
              setIncidents((prev) =>
                prev.map((i) => i.id === data.incident.id ? { ...i, ...data.incident } : i)
              );
            } else if (data.type === 'INCIDENT_DELETED' && data.incidentId) {
              setIncidents((prev) => prev.filter((i) => i.id !== data.incidentId));
            } else if (data.type === 'AGENT_CHAT_CLEARED') {
              // Sync chat clear across all devices (mobile + desktop)
              clearAgentMessages();
            }
          } catch { /* ignore malformed messages */ }
        };

        ws.onclose = () => {
          console.log('[SENTINEL] WS closed — reconnecting in 3s');
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
      } catch { /* WebSocket not available (SSR/test) */ }
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleNewIncident = (incident: Incident) => {
    // Optimistically prepend — the 15s poll will confirm it from the proxy.
    // Calling again with the same id (e.g. after background Walrus confirms) merges the update.
    setIncidents((prev) => [incident, ...prev.filter((i) => i.id !== incident.id)]);
  };


  // Merge updated flag data from POST /api/unflag response
  const handleFlagIncident = useCallback((updated: Incident) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === updated.id ? { ...i, flagCount: updated.flagCount, flaggedByMe: updated.flaggedByMe } : i))
    );
  }, []);

  // Listen for retry-success events dispatched by IncidentCard's inline retry button
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, blobId, createdAt } = (e as CustomEvent).detail;
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, walrusBlobId: blobId, walrusStatus: 'synced' as const, uploadStatus: 'confirmed' as const, createdAt: createdAt || i.createdAt }
            : i
        )
      );
    };
    window.addEventListener('incidentRetrySuccess', handler);
    return () => window.removeEventListener('incidentRetrySuccess', handler);
  }, []);

  const resolveIncident = useCallback((id: string) => {
    // Optimistic local update
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, status: 'resolved' as const } : inc))
    );
    // Tell proxy → it broadcasts INCIDENT_UPDATED to all other clients
    fetch(`${PROXY_URL}/api/incidents/${id}/resolve`, { method: 'POST' }).catch(() => {});
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
              className="hover:bg-white/[0.08] hover:shadow-[0_0_12px_rgba(111,188,240,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
                <path d="M12 2L20 8.5V15.5L12 22L4 15.5V8.5L12 2Z" fill="#6fbcf0"/>
                <path d="M12 6L17 9.5V14.5L12 18L7 14.5V9.5L12 6Z" fill="white" opacity="0.4"/>
              </svg>
              <span style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>
                {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </span>
            </button>

            {showWalletMenu && (
              <div className="fade-in-up" style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '0px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <button
                  onClick={() => {
                    disconnect();
                    setShowWalletMenu(false);
                  }}
                  className="bg-transparent text-red-500 hover:text-white hover:bg-red-700 hover:shadow-[0_0_12px_rgba(239,68,68,0.6)] hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, textAlign: 'left' }}
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
              className="hover:bg-white/[0.08] hover:shadow-[0_0_12px_rgba(111,188,240,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
                <path d="M12 2L20 8.5V15.5L12 22L4 15.5V8.5L12 2Z" fill="#6fbcf0"/>
                <path d="M12 6L17 9.5V14.5L12 18L7 14.5V9.5L12 6Z" fill="white" opacity="0.4"/>
              </svg>
              <span style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>
                {inAppAddress.slice(0, 6)}...{inAppAddress.slice(-4)}
              </span>
              <span style={{ fontSize: '10px', color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                in-app
              </span>
            </button>
            {showWalletMenu && (
              <div className="fade-in-up" style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '0px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <button
                  onClick={async () => { await clearWallet(); clearAuth(); setShowWalletMenu(false); }}
                  className="bg-transparent text-red-500 hover:text-white hover:bg-red-700 hover:shadow-[0_0_12px_rgba(239,68,68,0.6)] hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, textAlign: 'left' }}
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
            className="transition-smooth"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', background: '#1a1a1a',
              border: '1px solid #333', borderRadius: '8px',
              color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { 
              (e.currentTarget as HTMLButtonElement).style.background = '#252525';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(255,255,255,0.08)';
            }}
            onMouseLeave={(e) => { 
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
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
                  border: isActive
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))'
                    : 'transparent',
                  color: isActive
                    ? '#ffffff'
                    : isReport
                    ? '#ef4444'
                    : '#666',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isActive ? '-3px 0 12px rgba(255, 255, 255, 0.2)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(255,255,255,0.05), transparent)';
                    (e.currentTarget as HTMLButtonElement).style.color = isReport ? '#ef4444' : '#ccc';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = isReport ? '#ef4444' : '#666';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
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
                  {item.id === 'activity' && myIncidentCount > 0 && (
                    <span
                      style={{
                        fontSize: '9px',
                        color: '#22c55e',
                        background: 'rgba(34, 197, 94, 0.12)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        marginLeft: '8px',
                        minWidth: '18px',
                        textAlign: 'center',
                      }}
                    >
                      {myIncidentCount}
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
        <NearbyAlerts
          onNewIncident={(incident) => {
            setIncidents((prev) => {
              if (prev.some((i) => i.id === incident.id)) return prev;
              return [incident, ...prev];
            });
          }}
          onIncidentUpdated={(incident) => {
            setIncidents((prev) =>
              prev.map((i) => (i.id === incident.id ? { ...i, ...incident } : i))
            );
          }}
        />
        {currentPage === 'landing' && <Landing />}
        <div style={{
          position: currentPage === 'dashboard' ? 'static' : 'absolute',
          visibility: currentPage === 'dashboard' ? 'visible' : 'hidden',
          pointerEvents: currentPage === 'dashboard' ? 'auto' : 'none',
          width: '100%',
          height: currentPage === 'dashboard' ? '100%' : 0,
          overflow: 'hidden',
          top: 0, left: 0,
        }}>
          <Dashboard 
            incidents={incidents} 
            fetchError={fetchError}
            wsConnected={wsConnected}
            criticalFilter={criticalFilter}
            setCriticalFilter={setCriticalFilter}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            onResolveIncident={resolveIncident}
            onFlagIncident={handleFlagIncident}
            sidebarCollapsed={sidebarCollapsed}
          />
        </div>
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


