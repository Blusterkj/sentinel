import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar
} from 'recharts';
import type { Incident } from '../types/incident';
import { ShieldAlert, Zap, Clock } from 'lucide-react';

interface AnalyticsProps {
  incidents: Incident[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ incidents }) => {
  // 1. LineChart trends (incidents per day)
  const trendsData = useMemo(() => {
    const days: Record<string, number> = {};
    incidents.forEach(inc => {
      const date = new Date(inc.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days[date] = (days[date] || 0) + 1;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count })).reverse();
  }, [incidents]);

  // 2. PieChart types
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => counts[inc.type] = (counts[inc.type] || 0) + 1);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);
  
  const COLORS = ['#3b82f6', '#ef4444', '#f97316', '#8b5cf6', '#22c55e', '#eab308'];

  // 3. BarChart severity
  const severityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    incidents.forEach(inc => { if (counts[inc.severity] !== undefined) counts[inc.severity]++; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [incidents]);
  
  const SEVERITY_COLORS = { LOW: '#3b82f6', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };

  // 4. Top 5 hotspots
  const hotspots = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => counts[inc.location.address] = (counts[inc.location.address] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [incidents]);

  const cardStyle = {
    background: '#111',
    border: '1px solid #1f1f1f',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', background: '#0a0a0a', color: '#fff', width: '100%' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>System Analytics</h1>
      
      {/* 3 response stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={{ ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '12px' }}><Zap size={24} color="#3b82f6" /></div>
          <div>
            <div style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>TOTAL INCIDENTS</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{incidents.length}</div>
          </div>
        </div>
        <div style={{ ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px' }}><ShieldAlert size={24} color="#ef4444" /></div>
          <div>
            <div style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>CRITICAL THREATS</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{incidents.filter(i => i.severity === 'critical').length}</div>
          </div>
        </div>
        <div style={{ ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '12px' }}><Clock size={24} color="#22c55e" /></div>
          <div>
            <div style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>RESOLVED</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{incidents.filter(i => i.status === 'resolved').length}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px', color: '#ccc' }}>Incident Trends (Past 14 Days)</h2>
          <div style={{ width: '100%', height: 300, minHeight: 300 }}>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <LineChart width={700} height={300} data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px', color: '#ccc' }}>Incident Types</h2>
          <div style={{ width: '100%', height: 300, minHeight: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PieChart width={300} height={300}>
                <Pie data={typeData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {typeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }} />
              </PieChart>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px', color: '#ccc' }}>Severity Breakdown</h2>
          <div style={{ width: '100%', height: 250, minHeight: 250 }}>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <BarChart width={500} height={250} data={severityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="name" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }} cursor={{ fill: '#222' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={(SEVERITY_COLORS as any)[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </div>
          </div>
        </div>
        
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px', color: '#ccc' }}>Top Hotspots</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hotspots.map(([address, count], idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                <span style={{ fontSize: '13px', color: '#ddd' }}>{address}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '999px' }}>{count} incidents</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
