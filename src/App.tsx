// src/App.tsx
// Main app shell — sidebar nav, page routing, global incident state

import React, { useState, useCallback, useEffect } from 'react';
import { useWalrusSeeding } from './hooks/useWalrusSeeding';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Report } from './pages/Report';
import { Memory } from './pages/Memory';
import { Agent } from './pages/Agent';
import type { Incident } from './types/incident';
import {
  LayoutDashboard,
  AlertTriangle,
  Database,
  Brain,
  Shield,
  Hexagon,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

type Page = 'landing' | 'dashboard' | 'analytics' | 'report' | 'memory' | 'agent';

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
];

// Helper: generate timestamps spread across the past 14 days
const daysAgo = (d: number, h = 0, m = 0) =>
  new Date(Date.now() - d * 86400000 - h * 3600000 - m * 60000).toISOString();

// 21 realistic seed incidents — real Bengaluru streets, 14-day spread
const SEED_INCIDENTS: Incident[] = [
  // ── TODAY ──────────────────────────────────
  {
    id: 'demo-1',
    type: 'medical',
    severity: 'high',
    description: 'Person collapsed on MG Road near the metro station. Unresponsive. Bystanders performing CPR. Ambulance dispatched from Manipal Hospital.',
    location: { lat: 12.9752, lng: 77.6062, address: 'MG Road Metro Station, Bengaluru' },
    timestamp: daysAgo(0, 0, 12),
    reportedBy: 'Witness',
    status: 'active',
  },
  {
    id: 'demo-2',
    type: 'fire',
    severity: 'critical',
    description: 'Kitchen fire in commercial building on Brigade Road. Smoke visible from two blocks away. Fire department arrived in 8 minutes. Two floors evacuated.',
    location: { lat: 12.9719, lng: 77.6070, address: 'Brigade Road, Bengaluru' },
    timestamp: daysAgo(0, 0, 28),
    reportedBy: 'Shop owner',
    status: 'active',
    suiTxDigest: '6aB9fXz2L7QkQw8YtR3uPp4vV5cXmWzE1gHjKtN3Ry6s',
  },
  {
    id: 'demo-3',
    type: 'accident',
    severity: 'medium',
    description: 'Two-vehicle collision at the Silk Board junction. One person with head injuries. Traffic backed up 2km on Hosur Road. Ambulance and traffic police at scene.',
    location: { lat: 12.9176, lng: 77.6230, address: 'Silk Board Junction, Bengaluru' },
    timestamp: daysAgo(0, 0, 45),
    reportedBy: 'Motorist',
    status: 'active',
  },
  // ── 1 DAY AGO ─────────────────────────────
  {
    id: 'demo-4',
    type: 'crime',
    severity: 'medium',
    description: 'Chain snatching reported near Indiranagar 100ft Road. Two suspects on black Pulsar motorcycle, fled towards CMH Road. Victim: woman in her 30s, minor injuries.',
    location: { lat: 12.9784, lng: 77.6405, address: 'Indiranagar 100ft Road, Bengaluru' },
    timestamp: daysAgo(1, 2),
    reportedBy: 'Victim',
    status: 'active',
  },
  {
    id: 'demo-5',
    type: 'crime',
    severity: 'critical',
    description: 'Armed robbery at jewellery shop on Avenue Road. Suspect brandished knife, stole gold worth ₹8 lakh. Shop CCTV captured clear face image. Police pursuing.',
    location: { lat: 12.9670, lng: 77.5770, address: 'Avenue Road, Chickpet, Bengaluru' },
    timestamp: daysAgo(1, 8),
    reportedBy: 'Shop owner',
    status: 'active',
    suiTxDigest: '8bC3vYz9M2WjRn4Ts1uKq6pX3fGhLwJv5aKdMtB7Hy2e',
  },
  // ── 2 DAYS AGO ────────────────────────────
  {
    id: 'demo-6',
    type: 'medical',
    severity: 'low',
    description: 'Elderly person fell at Lalbagh botanical garden entrance. Minor bruises and scraped knee. First aid administered by park security. Family notified.',
    location: { lat: 12.9507, lng: 77.5848, address: 'Lalbagh Botanical Garden, Bengaluru' },
    timestamp: daysAgo(2, 4),
    reportedBy: 'Park security',
    status: 'resolved',
  },
  {
    id: 'demo-7',
    type: 'natural_disaster',
    severity: 'medium',
    description: 'Flash flooding on Outer Ring Road near Marathahalli bridge. 12 vehicles stranded, water at knee level. BBMP pumps deployed. Diversion via Kundalahalli.',
    location: { lat: 12.9591, lng: 77.6969, address: 'Outer Ring Road, Marathahalli, Bengaluru' },
    timestamp: daysAgo(2, 6),
    reportedBy: 'BBMP Control Room',
    status: 'resolved',
  },
  // ── 3 DAYS AGO ────────────────────────────
  {
    id: 'demo-8',
    type: 'accident',
    severity: 'critical',
    description: 'BMTC bus collided with auto-rickshaw at KR Puram railway crossing. Three passengers injured, one critical. Traffic diverted for 2 hours.',
    location: { lat: 12.9988, lng: 77.6874, address: 'KR Puram Railway Crossing, Bengaluru' },
    timestamp: daysAgo(3, 10),
    reportedBy: 'Traffic police',
    status: 'resolved',
    suiTxDigest: '3fH7cNw1V5ZjLm8Pr9bTq4sX2vYgKzJt6eRkNxC4Wu5d',
  },
  {
    id: 'demo-9',
    type: 'fire',
    severity: 'medium',
    description: 'Electrical fire in server room at tech park near Bellandur. Sprinklers activated. Building partially evacuated. No casualties. Short circuit suspected.',
    location: { lat: 12.9261, lng: 77.6762, address: 'Ecoworld Tech Park, Bellandur, Bengaluru' },
    timestamp: daysAgo(3, 14),
    reportedBy: 'Facility manager',
    status: 'resolved',
  },
  // ── 5 DAYS AGO (Friday night) ─────────────
  {
    id: 'demo-10',
    type: 'crime',
    severity: 'medium',
    description: 'Wallet and phone snatched from pedestrian on Church Street near Koshy\'s restaurant. Suspect fled on foot into Brigade Road lane. Area has poor CCTV coverage.',
    location: { lat: 12.9735, lng: 77.6060, address: 'Church Street, Bengaluru' },
    timestamp: daysAgo(5, 22),
    reportedBy: 'Victim',
    status: 'active',
  },
  {
    id: 'demo-11',
    type: 'crime',
    severity: 'medium',
    description: 'Two bikes stolen from parking area near Commercial Street metro exit. Lock cut with bolt cutter. Night security guard was away from post.',
    location: { lat: 12.9832, lng: 77.6097, address: 'Commercial Street, Bengaluru' },
    timestamp: daysAgo(5, 3),
    reportedBy: 'Vehicle owner',
    status: 'active',
  },
  // ── 7 DAYS AGO ────────────────────────────
  {
    id: 'demo-12',
    type: 'medical',
    severity: 'medium',
    description: 'Construction worker fell from second floor scaffolding at Whitefield building site. Suspected fracture. Taken to Columbia Asia hospital by co-workers.',
    location: { lat: 12.9698, lng: 77.7500, address: 'ITPL Main Road, Whitefield, Bengaluru' },
    timestamp: daysAgo(7, 9),
    reportedBy: 'Site foreman',
    status: 'resolved',
  },
  {
    id: 'demo-13',
    type: 'natural_disaster',
    severity: 'critical',
    description: 'Large tree uprooted on Sankey Road during evening storm, blocking both lanes. Power lines down, live wire hazard. BESCOM crew and BBMP tree-cutting team dispatched.',
    location: { lat: 12.9900, lng: 77.5760, address: 'Sankey Road, Sadashivanagar, Bengaluru' },
    timestamp: daysAgo(7, 18),
    reportedBy: 'Resident',
    status: 'resolved',
    suiTxDigest: '9dQ4xTr7J1MkNw2Cv8bVp5sZ3fGhKyLt6aRjMxB9Wu4e',
  },
  // ── 9 DAYS AGO ────────────────────────────
  {
    id: 'demo-14',
    type: 'accident',
    severity: 'low',
    description: 'Minor fender-bender on Bannerghatta Road near Meenakshi Temple. No injuries. Both drivers exchanged insurance details. Slight traffic slowdown.',
    location: { lat: 12.9036, lng: 77.5946, address: 'Bannerghatta Road, Bengaluru' },
    timestamp: daysAgo(9, 11),
    reportedBy: 'Motorist',
    status: 'resolved',
  },
  {
    id: 'demo-15',
    type: 'fire',
    severity: 'low',
    description: 'Small garbage fire near Majestic bus station platform 4. Quickly extinguished by station staff. Cause: discarded cigarette butt in dry waste bin.',
    location: { lat: 12.9767, lng: 77.5713, address: 'Majestic Bus Station, Bengaluru' },
    timestamp: daysAgo(9, 5),
    reportedBy: 'Station staff',
    status: 'resolved',
  },
  // ── 10 DAYS AGO ───────────────────────────
  {
    id: 'demo-16',
    type: 'crime',
    severity: 'critical',
    description: 'House burglary in HAL 2nd Stage, Indiranagar. Family was away for weekend. Electronics worth ₹3 lakh and cash stolen. Forced entry through kitchen window.',
    location: { lat: 12.9780, lng: 77.6450, address: 'HAL 2nd Stage, Indiranagar, Bengaluru' },
    timestamp: daysAgo(10, 2),
    reportedBy: 'Home owner',
    status: 'active',
    suiTxDigest: '5aJ8vWz4L6HkMw9Rt1uPq2sX7fCbGyJt3eKkNxF8Vu3c',
  },
  // ── 11 DAYS AGO ───────────────────────────
  {
    id: 'demo-17',
    type: 'medical',
    severity: 'high',
    description: 'Food poisoning outbreak at street food stall near VV Puram food street. 8 people hospitalized with vomiting and dehydration. Health inspector notified.',
    location: { lat: 12.9450, lng: 77.5750, address: 'VV Puram Food Street, Bengaluru' },
    timestamp: daysAgo(11, 20),
    reportedBy: 'Hospital ER',
    status: 'resolved',
  },
  // ── 12 DAYS AGO (Friday night) ────────────
  {
    id: 'demo-18',
    type: 'crime',
    severity: 'medium',
    description: 'Drunk driving hit-and-run near Koramangala 5th Block. Victim: delivery rider. Suspect vehicle: white Swift, partial plate KA-03. Dashcam footage available.',
    location: { lat: 12.9352, lng: 77.6245, address: 'Koramangala 5th Block, Bengaluru' },
    timestamp: daysAgo(12, 23),
    reportedBy: 'Witness',
    status: 'active',
  },
  {
    id: 'demo-19',
    type: 'crime',
    severity: 'medium',
    description: 'Phone snatching near Cubbon Park metro entrance. Suspect on scooter approached from behind, grabbed phone from victim\'s hand. Third such incident this month.',
    location: { lat: 12.9763, lng: 77.5929, address: 'Cubbon Park Metro Station, Bengaluru' },
    timestamp: daysAgo(12, 21),
    reportedBy: 'Victim',
    status: 'active',
  },
  // ── 13 DAYS AGO ───────────────────────────
  {
    id: 'demo-20',
    type: 'accident',
    severity: 'medium',
    description: 'Pothole-related motorcycle accident on Bellary Road near Hebbal flyover. Rider skidded into oncoming lane. Helmet saved his life. Road repair pending for 3 weeks.',
    location: { lat: 13.0358, lng: 77.5970, address: 'Bellary Road, Hebbal, Bengaluru' },
    timestamp: daysAgo(13, 7),
    reportedBy: 'Motorist',
    status: 'resolved',
  },
  {
    id: 'demo-21',
    type: 'natural_disaster',
    severity: 'low',
    description: 'Minor waterlogging reported in Rajajinagar 4th Block underpass. Water depth about 6 inches. Traffic able to pass slowly. BBMP drain clearing scheduled.',
    location: { lat: 12.9905, lng: 77.5545, address: 'Rajajinagar 4th Block, Bengaluru' },
    timestamp: daysAgo(13, 15),
    reportedBy: 'Resident',
    status: 'resolved',
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'dashboard' | 'analytics' | 'report' | 'memory' | 'agent'>(
    'landing'
  );
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [criticalFilter, setCriticalFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/') setCurrentPage('landing');
      else if (path === '/dashboard') setCurrentPage('dashboard');
      else if (path === '/analytics') setCurrentPage('analytics');
      else if (path === '/report') setCurrentPage('report');
      else if (path === '/memory') setCurrentPage('memory');
      else if (path === '/agent') setCurrentPage('agent');
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
    setIncidents((prev) => [incident, ...prev]);
  };

  // Callback to update a single incident's fields (used by seeding hook)
  const updateIncident = useCallback((id: string, updates: Partial<Incident>) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, ...updates } : inc))
    );
  }, []);

  // Walrus seeding — stores all seed incidents on-chain on first load
  const seeding = useWalrusSeeding(incidents, updateIncident);

  const criticalIncidentCount = incidents.filter(
    (i) => i.severity === 'critical'
  ).length;

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarCollapsed ? '60px' : '220px',
          background: '#0d0d0d',
          borderRight: '1px solid #1a1a1a',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: sidebarCollapsed ? '20px 12px' : '20px 20px',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Shield size={16} color="#fff" />
          </div>
          {!sidebarCollapsed && (
            <div>
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
          )}
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            const showBadge = item.badge && !sidebarCollapsed;
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
                  gap: '10px',
                  padding: sidebarCollapsed ? '10px' : '10px 12px',
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
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  position: 'relative',
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
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, flex: 1, textAlign: 'left' }}>
                      {item.label}
                    </span>
                    {showBadge && (
                      <span
                        style={{
                          fontSize: '9px',
                          color: '#8b5cf6',
                          background: 'rgba(139, 92, 246, 0.12)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}

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
            borderTop: '1px solid #1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Critical alert badge */}
          {criticalIncidentCount > 0 && !sidebarCollapsed && (
            <div
              className="glow-high"
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setCurrentPage('dashboard');
                setCriticalFilter(true);
                setActiveFilter(false);
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                {criticalIncidentCount} critical
              </span>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '1px solid #1f1f1f',
              borderRadius: '8px',
              color: '#444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRight
              size={14}
              style={{
                transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.25s',
              }}
            />
          </button>

          {/* Walrus badge */}
          {!sidebarCollapsed && (
            <div
              style={{
                padding: '6px 10px',
                background: 'rgba(139, 92, 246, 0.06)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Hexagon size={10} color="#8b5cf6" />
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
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Walrus seeding progress banner */}
        {seeding.isSeeding && (
          <SeedingBanner progress={seeding.progress} total={seeding.total} />
        )}
        {currentPage === 'landing' && <Landing />}
        {currentPage === 'dashboard' && (
          <Dashboard 
            incidents={incidents} 
            seeding={seeding} 
            criticalFilter={criticalFilter}
            setCriticalFilter={setCriticalFilter}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            onResolveIncident={(id) => updateIncident(id, { status: 'resolved' })}
          />
        )}
        {currentPage === 'analytics' && <Analytics incidents={incidents} />}
        {currentPage === 'report' && (
          <Report onIncidentSubmitted={handleNewIncident} />
        )}
        {currentPage === 'memory' && <Memory incidents={incidents} />}
        {currentPage === 'agent' && <Agent incidents={incidents} />}
      </main>
    </div>
  );
}

// ─── Seeding progress banner ────────────────────────────────
const SeedingBanner: React.FC<{ progress: number; total: number }> = ({
  progress,
  total,
}) => {
  const pct = total > 0 ? (progress / total) * 100 : 0;
  return (
    <div
      style={{
        padding: '10px 20px',
        background: 'rgba(139, 92, 246, 0.06)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          border: '2px solid #8b5cf6',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 600 }}>
        Syncing to Walrus…
      </span>
      <span
        style={{
          fontSize: '12px',
          color: '#ccc',
          fontFamily: 'monospace',
          fontWeight: 700,
        }}
      >
        {progress}/{total}
      </span>
      <div
        style={{
          flex: 1,
          height: '4px',
          background: '#1a1a1a',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <Hexagon size={12} color="#8b5cf6" style={{ opacity: 0.5 }} />
    </div>
  );
};
