import React from 'react';
import { Map as MapIcon, BarChart3, Plus, Database, Bot } from 'lucide-react';

interface BottomTabBarProps {
  currentPage: string;
  navigate: (page: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentPage, navigate }) => {
  const tabs = [
    { id: 'dashboard', label: 'Map', icon: MapIcon },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'report', label: 'Report', icon: Plus, isFab: true },
    { id: 'memory', label: 'Memory', icon: Database },
    { id: 'agent', label: 'Agent', icon: Bot },
  ];

  return (
    <div
      className="flex md:hidden mobile-tab-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#0a0a0a',
        borderTop: '1px solid #1a1a1a',
        zIndex: 950,
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 8px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = currentPage === tab.id;
        const Icon = tab.icon;

        if (tab.isFab) {
          return (
            <div
              key={tab.id}
              onClick={() => navigate(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '100%',
                cursor: 'pointer',
              }}
            >
              <div
                className="active:scale-95 transition-transform"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: isActive ? '#dc2626' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isActive ? '0 0 16px rgba(239, 68, 68, 0.6)' : '0 4px 12px rgba(239, 68, 68, 0.4)',
                  transform: isActive ? 'scale(0.95)' : 'translateY(-12px)',
                  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <Icon size={24} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '10px', color: isActive ? '#ef4444' : '#888', marginTop: isActive ? '4px' : '-8px', fontWeight: isActive ? 600 : 500, transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                {tab.label}
              </span>
            </div>
          );
        }

        return (
          <div
            key={tab.id}
            onClick={() => navigate(tab.id)}
            className="active:scale-95 transition-transform"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '100%',
              cursor: 'pointer',
              position: 'relative',
              gap: '4px',
            }}
          >
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                transform: isActive ? 'scale(1.15)' : 'scale(1)', 
                transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)' 
              }}>
                <Icon size={22} color={isActive ? '#3b82f6' : '#666'} />
              </div>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: '10px', color: isActive ? '#3b82f6' : '#666', fontWeight: isActive ? 600 : 500, marginTop: '2px' }}>
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
