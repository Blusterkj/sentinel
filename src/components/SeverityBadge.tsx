// src/components/SeverityBadge.tsx

import React from 'react';
import type { Severity } from '../types/incident';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const severityConfig = {
  low: {
    label: 'LOW',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    dot: '#3b82f6',
  },
  medium: {
    label: 'MEDIUM',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.3)',
    dot: '#eab308',
  },
  high: {
    label: 'HIGH',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.3)',
    dot: '#f97316',
  },
  critical: {
    label: 'CRITICAL',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    dot: '#ef4444',
  },
};

const sizeConfig = {
  sm: { padding: '2px 8px', fontSize: '10px', dotSize: '6px', gap: '5px' },
  md: { padding: '4px 10px', fontSize: '11px', dotSize: '7px', gap: '6px' },
  lg: { padding: '6px 14px', fontSize: '12px', dotSize: '8px', gap: '7px' },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'md',
  pulse = false,
}) => {
  const config = severityConfig[severity];
  const sz = sizeConfig[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sz.gap,
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: '4px',
        fontFamily: 'monospace',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: sz.dotSize,
          height: sz.dotSize,
          borderRadius: '50%',
          background: config.dot,
          flexShrink: 0,
          ...(pulse && (severity === 'high' || severity === 'critical')
            ? { boxShadow: `0 0 6px ${config.dot}`, animation: 'glow-pulse 2s ease-in-out infinite' }
            : {}),
        }}
      />
      {config.label}
    </span>
  );
};

export const getSeverityColor = (severity: Severity): string => {
  return severityConfig[severity].color;
};
