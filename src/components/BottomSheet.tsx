import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IncidentFeed } from './IncidentFeed';
import type { Incident } from '../types/incident';

type SheetState = 'collapsed' | 'half' | 'full';

interface BottomSheetProps {
  incidents: Incident[];
  fetchError?: boolean;
  wsConnected?: boolean;
  onSelectIncident: (incident: Incident) => void;
  selectedId?: string;
  criticalFilter: boolean;
  activeFilter: boolean;
  myReportsFilter?: boolean;
  onResolveIncident?: (id: string) => void;
  onFlagIncident?: (updated: Incident) => void;
}

const SNAP_HEIGHTS: Record<SheetState, string> = {
  collapsed: '136px', // 64px hidden behind tab bar + 72px visible (handle + header)
  half: '50vh',
  full: '88vh',
};

export const BottomSheet: React.FC<BottomSheetProps> = ({
  incidents,
  fetchError = false,
  wsConnected = true,
  onSelectIncident,
  selectedId,
  criticalFilter,
  activeFilter,
  myReportsFilter = false,
  onResolveIncident,
  onFlagIncident,
}) => {
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');

  const cycleUp = () => {
    if (sheetState === 'collapsed') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
  };

  const cycleDown = () => {
    if (sheetState === 'full') setSheetState('half');
    else if (sheetState === 'half') setSheetState('collapsed');
  };

  const handleDragEnd = (_: unknown, info: { offset: { y: number } }) => {
    const dy = info.offset.y;
    if (dy < -40) cycleUp();
    else if (dy > 40) cycleDown();
  };

  // Status indicator: red = fetch error, amber = WS disconnected (polling only), green = fully live
  const dotColor = fetchError ? '#ef4444' : wsConnected ? '#22c55e' : '#eab308';
  const statusLabel = fetchError ? 'OFFLINE' : wsConnected ? 'MONITORING' : 'POLLING';

  return (
    <motion.div
      className="flex md:hidden"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      animate={{ height: SNAP_HEIGHTS[sheetState] }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
      style={{
        position: 'fixed',
        bottom: '0',
        left: 0,
        right: 0,
        background: '#0a0a0a',
        borderTop: '1px solid #1a1a1a',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        zIndex: 800,
        flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.9)',
        touchAction: 'none',
      }}
    >
      {/* Drag Handle */}
      <div
        onClick={cycleUp}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          padding: '12px 0 16px',
          cursor: 'grab',
          flexShrink: 0,
        }}
      >
        <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px' }} />
      </div>

      {/* Header */}
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#e5e5e5' }}>Live Feed</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', background: '#1a1a1a', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, color: '#888' }}>
            {incidents.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: dotColor,
              boxShadow: `0 0 8px ${dotColor}`,
              transition: 'background 0.3s, box-shadow 0.3s',
            }} />
            <span style={{ fontSize: '9px', fontWeight: 700, color: dotColor, letterSpacing: '0.05em', transition: 'color 0.3s' }}>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehaviorY: 'contain',
          touchAction: 'pan-y',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div style={{ paddingBottom: '84px' }}>
          <IncidentFeed
            incidents={incidents}
            fetchError={fetchError}
            onSelectIncident={onSelectIncident}
            selectedId={selectedId}
            criticalFilter={criticalFilter}
            activeFilter={activeFilter}
            myReportsFilter={myReportsFilter}
            onResolveIncident={onResolveIncident}
            onFlagIncident={onFlagIncident}
            hideHeader
          />
        </div>
      </div>
    </motion.div>
  );
};
