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
      className="flex md:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom)',
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
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <Icon size={24} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '10px', color: isActive ? '#ef4444' : '#888', marginTop: isActive ? '4px' : '-8px', fontWeight: isActive ? 600 : 500, transition: 'all 0.2s' }}>
                {tab.label}
              </span>
            </div>
          );
        }

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
              position: 'relative',
              gap: '4px',
            }}
          >
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  width: '24px',
                  height: '3px',
                  background: '#3b82f6',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
                }}
              />
            )}
            <Icon size={22} color={isActive ? '#3b82f6' : '#666'} />
            <span style={{ fontSize: '10px', color: isActive ? '#3b82f6' : '#666', fontWeight: isActive ? 600 : 500 }}>
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
