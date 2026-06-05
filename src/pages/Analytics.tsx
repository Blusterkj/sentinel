// src/pages/Analytics.tsx
// Pure CSS/SVG analytics — no recharts dependency to avoid React 19 crashes

import React, { useMemo } from 'react';
import type { Incident } from '../types/incident';
import { ShieldAlert, Zap, Clock, MapPin, Activity } from 'lucide-react';

interface AnalyticsProps {
  incidents: Incident[];
}

const COLORS = ['#3b82f6', '#ef4444', '#f97316', '#8b5cf6', '#22c55e', '#eab308'];
const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#3b82f6',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const cardStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #1f1f1f',
  borderRadius: '12px',
  padding: '24px',
};

// ─── Bar chart (pure SVG) ────────────────────────────────────────────────────
function SVGBarChart({ data }: { data: { name: string; value: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const W = 480, H = 200, PAD = 40, BAR_GAP = 16;
  const barW = (W - PAD * 2 - BAR_GAP * (data.length - 1)) / Math.max(data.length, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: '100%', height: 'auto' }}>
      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD + (1 - pct) * H;
        return (
          <g key={pct}>
            <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#222" strokeDasharray="4 4" />
            <text x={PAD - 6} y={y + 4} fill="#555" fontSize={10} textAnchor="end">
              {Math.round(pct * maxVal)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * H;
        const x = PAD + i * (barW + BAR_GAP);
        const y = PAD + H - barH;
        const color = SEVERITY_COLORS[d.name] ?? COLORS[i % COLORS.length];
        return (
          <g key={d.name}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx={4} opacity={0.85} />
            <text x={x + barW / 2} y={H + PAD + 16} fill="#888" fontSize={11} textAnchor="middle">
              {d.name}
            </text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} fill={color} fontSize={12} textAnchor="middle" fontWeight={700}>
                {d.value}
              </text>
            )}
          </g>
        );
      })}
      {/* X axis */}
      <line x1={PAD} x2={W - PAD} y1={PAD + H} y2={PAD + H} stroke="#333" />
    </svg>
  );
}

// ─── Line chart (pure SVG) ──────────────────────────────────────────────────
function SVGLineChart({ data }: { data: { date: string; count: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const W = 600, H = 200, PAD_X = 44, PAD_Y = 20;

  if (data.length === 0) {
    return (
      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>
        No incident data yet
      </div>
    );
  }

  const pts = data.map((d, i) => ({
    x: PAD_X + (i / Math.max(data.length - 1, 1)) * (W - PAD_X * 2),
    y: PAD_Y + (1 - d.count / maxVal) * H,
    ...d,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M ${pts[0].x},${PAD_Y + H} ` +
    pts.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x},${PAD_Y + H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H + PAD_Y * 2 + 30}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Y gridlines */}
      {[0, 0.5, 1].map(pct => {
        const y = PAD_Y + (1 - pct) * H;
        return (
          <g key={pct}>
            <line x1={PAD_X} x2={W - PAD_X} y1={y} y2={y} stroke="#222" strokeDasharray="4 4" />
            <text x={PAD_X - 6} y={y + 4} fill="#555" fontSize={10} textAnchor="end">
              {Math.round(pct * maxVal)}
            </text>
          </g>
        );
      })}
      {/* Area fill */}
      <path d={area} fill="url(#lineGrad)" />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots + labels */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#3b82f6" stroke="#111" strokeWidth={2} />
          {i % Math.max(1, Math.floor(pts.length / 8)) === 0 && (
            <text x={p.x} y={PAD_Y + H + 20} fill="#666" fontSize={9} textAnchor="middle">
              {p.date}
            </text>
          )}
        </g>
      ))}
      {/* X axis */}
      <line x1={PAD_X} x2={W - PAD_X} y1={PAD_Y + H} y2={PAD_Y + H} stroke="#333" />
    </svg>
  );
}

// ─── Donut chart (pure SVG) ─────────────────────────────────────────────────
function SVGDonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>
        No data yet
      </div>
    );
  }

  const CX = 110, CY = 110, R = 85, r = 52;
  
  const sliceAngles = data.reduce<{startAngle: number, endAngle: number}[]>((acc, d) => {
    const startAngle = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1].endAngle;
    const endAngle = startAngle + (d.value / total) * 2 * Math.PI;
    acc.push({ startAngle, endAngle });
    return acc;
  }, []);

  const slices = data.map((d, i) => {
    const frac = d.value / total;
    const { startAngle, endAngle } = sliceAngles[i];
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const ix1 = CX + r * Math.cos(endAngle);
    const iy1 = CY + r * Math.sin(endAngle);
    const ix2 = CX + r * Math.cos(startAngle);
    const iy2 = CY + r * Math.sin(startAngle);
    const large = frac > 0.5 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`;
    return { ...d, path, color: COLORS[i % COLORS.length] };
  });

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <svg viewBox={`0 0 220 220`} style={{ width: 180, height: 180, flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity={0.9} />
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={700}>{total}</text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="#666" fontSize={10}>total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#aaa', textTransform: 'capitalize' }}>{s.name.replace('_', ' ')}</span>
            <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export const Analytics: React.FC<AnalyticsProps> = ({ incidents }) => {
  const trendsData = useMemo(() => {
    const days: Record<string, number> = {};
    incidents.forEach(inc => {
      const date = new Date(inc.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days[date] = (days[date] || 0) + 1;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [incidents]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => counts[inc.type] = (counts[inc.type] || 0) + 1);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const severityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    incidents.forEach(inc => { if ((counts as any)[inc.severity] !== undefined) (counts as any)[inc.severity]++; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [incidents]);

  const hotspots = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => counts[inc.location.address] = (counts[inc.location.address] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [incidents]);

  const statCards = [
    { label: 'TOTAL INCIDENTS', value: incidents.length, icon: <Zap size={22} color="#3b82f6" />, bg: 'rgba(59,130,246,0.1)' },
    { label: 'ACTIVE', value: incidents.filter(i => i.status === 'active').length, icon: <Activity size={22} color="#f97316" />, bg: 'rgba(249,115,22,0.1)' },
    { label: 'CRITICAL THREATS', value: incidents.filter(i => i.severity === 'critical').length, icon: <ShieldAlert size={22} color="#ef4444" />, bg: 'rgba(239,68,68,0.1)' },
    { label: 'RESOLVED', value: incidents.filter(i => i.status === 'resolved').length, icon: <Clock size={22} color="#22c55e" />, bg: 'rgba(34,197,94,0.1)' },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', color: '#fff', padding: '40px 36px 120px' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>System Analytics</h1>
      <p style={{ fontSize: '13px', color: '#555', marginBottom: '36px' }}>Live incident intelligence overview</p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
        {statCards.map(s => (
          <div key={s.label} style={{ ...cardStyle, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '18px', padding: '28px 24px', minHeight: '110px' }}>
            <div style={{ background: s.bg, padding: '14px', borderRadius: '12px', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.1 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trends + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div style={{ ...cardStyle, padding: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ccc', marginBottom: '24px' }}>Incident Trends</h2>
          <SVGLineChart data={trendsData} />
        </div>
        <div style={{ ...cardStyle, padding: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ccc', marginBottom: '24px' }}>Incident Types</h2>
          <SVGDonutChart data={typeData} />
        </div>
      </div>

      {/* Bar chart + Hotspots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div style={{ ...cardStyle, padding: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ccc', marginBottom: '24px' }}>Severity Breakdown</h2>
          <SVGBarChart data={severityData} />
        </div>
        <div style={{ ...cardStyle, padding: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ccc', marginBottom: '24px' }}>
            <MapPin size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Top Hotspots
          </h2>
          {hotspots.length === 0 ? (
            <p style={{ color: '#555', fontSize: 13 }}>No hotspot data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hotspots.map(([address, count], idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', width: 18 }}>#{idx + 1}</span>
                  <span style={{ fontSize: '13px', color: '#ddd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '3px 10px', borderRadius: '999px', flexShrink: 0 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
