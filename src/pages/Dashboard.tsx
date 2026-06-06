import React, { useState, useEffect } from 'react';
import { Map } from '../components/Map';
import { IncidentFeed } from '../components/IncidentFeed';
import { BottomSheet } from '../components/BottomSheet';
import type { Incident } from '../types/incident';
import { AlertTriangle, Activity, Link as LinkIcon, Plus, X, MapPin, Clock } from 'lucide-react';
import { SeverityBadge, getSeverityColor } from '../components/SeverityBadge';
import { useCurrentAccount } from '@mysten/dapp-kit';


interface DashboardProps {
  incidents: Incident[];
  seeding?: {
    isSeeding: boolean;
    progress: number;
    total: number;
    isDone: boolean;
    successCount: number;
    failedCount: number;
  };
  criticalFilter: boolean;
  setCriticalFilter: (val: boolean) => void;
  activeFilter: boolean;
  setActiveFilter: (val: boolean) => void;
  onResolveIncident?: (id: string) => void;
  onDeleteIncident?: (id: string) => void;
  sidebarCollapsed?: boolean;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bangalore, India

export const Dashboard: React.FC<DashboardProps> = ({ 
  incidents, 
  criticalFilter,
  setCriticalFilter,
  activeFilter,
  setActiveFilter,
  onResolveIncident,
  onDeleteIncident,
  sidebarCollapsed
}) => {
  const [myReportsFilter, setMyReportsFilter] = useState(false);
  const [center, setCenter] = useState<[number, number]>(() => {
    if (incidents.length > 0) {
      const centerLat = incidents.reduce((sum, i) => sum + i.location.lat, 0) / incidents.length;
      const centerLng = incidents.reduce((sum, i) => sum + i.location.lng, 0) / incidents.length;
      return [centerLat, centerLng];
    }
    return DEFAULT_CENTER;
  });
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Incident[] | null>(null);
  const [locationObtained, setLocationObtained] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const account = useCurrentAccount();
  
  // Listen for external requests to select an incident (e.g. from NearbyAlerts)
  useEffect(() => {
    const handleSelectIncident = (e: Event) => {
      const customEvent = e as CustomEvent<Incident>;
      if (customEvent.detail) {
        setSelectedCluster(null);
        setSelectedIncident(customEvent.detail);
        setCenter([customEvent.detail.location.lat, customEvent.detail.location.lng]);
      }
    };
    window.addEventListener('selectIncident', handleSelectIncident);
    return () => window.removeEventListener('selectIncident', handleSelectIncident);
  }, []);

  // Try to get user location on mount and center the map on them
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setCenter(loc);
          setUserLocation(loc);
          setLocationObtained(true);
        },
        () => {
          // Silently fall back to default center if denied
        },
        { timeout: 5000 }
      );
    }
  }, []);

  // Sync selectedIncident with latest data from incidents list (or clear if deleted)
  useEffect(() => {
    if (selectedIncident) {
      const current = incidents.find((i) => i.id === selectedIncident.id);
      if (!current) {
        setSelectedIncident(null);
      } else if (current !== selectedIncident) {
        setSelectedIncident(current);
      }
    }
  }, [incidents, selectedIncident]);

  // Sync selectedCluster or clear if any incidents are deleted
  useEffect(() => {
    if (selectedCluster) {
      const updatedCluster = selectedCluster.map(inc => incidents.find(i => i.id === inc.id)).filter(Boolean) as Incident[];
      if (updatedCluster.length === 0) {
        setSelectedCluster(null);
      } else if (JSON.stringify(updatedCluster) !== JSON.stringify(selectedCluster)) {
        setSelectedCluster(updatedCluster);
      }
    }
  }, [incidents, selectedCluster]);

  // Stats
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
  const activeCount = incidents.filter((i) => i.status === 'active').length;
  const verifiedOnSuiCount = incidents.filter((i) => !!i.suiTxDigest).length;
  const walrusVerifiedCount = incidents.filter((i) => !!i.walrusBlobId).length;
  const myReportsCount = incidents.filter((i) => i.createdByMe).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Stats bar */}
      <div
        className="hidden md:flex items-center shrink-0 border-b border-[#1a1a1a]"
        style={{
          background: '#0d0d0d',
          padding: '16px 180px 16px 24px',
          gap: '20px'
        }}
      >
        {activeFilter ? (
          <StatPill
            icon={<Activity size={12} color="#3b82f6" />}
            label="Showing active only · ×"
            value=""
            color="#3b82f6"
            pulse={false}
            onClick={() => setActiveFilter(false)}
          />
        ) : (
          <StatPill
            icon={<Activity size={12} color="#3b82f6" />}
            label="Active"
            value={String(activeCount)}
            color="#3b82f6"
            onClick={() => setActiveFilter(true)}
          />
        )}
        {criticalFilter ? (
          <StatPill
            icon={<AlertTriangle size={12} color="#ef4444" />}
            label="Showing critical only · ×"
            value=""
            color="#ef4444"
            pulse={false}
            onClick={() => setCriticalFilter(false)}
          />
        ) : criticalCount > 0 ? (
          <StatPill
            icon={<AlertTriangle size={12} color="#ef4444" />}
            label="Critical"
            value={String(criticalCount)}
            color="#ef4444"
            pulse={true}
            onClick={() => setCriticalFilter(true)}
          />
        ) : null}
        {myReportsFilter ? (
          <StatPill
            icon={<span style={{ fontSize: '12px' }}>👤</span>}
            label="Showing my reports · ×"
            value=""
            color="#a855f7"
            pulse={false}
            onClick={() => setMyReportsFilter(false)}
          />
        ) : myReportsCount > 0 ? (
          <StatPill
            icon={<span style={{ fontSize: '12px' }}>👤</span>}
            label="My Reports"
            value={String(myReportsCount)}
            color="#a855f7"
            onClick={() => setMyReportsFilter(true)}
          />
        ) : null}
        <StatPill
          icon={<span style={{ fontSize: '12px' }}>📍</span>}
          label="Total"
          value={String(incidents.length)}
          color="#888888"
        />
        <StatPill
          icon={<LinkIcon size={12} color="#a78bfa" />}
          label="Stored on Walrus"
          value={String(walrusVerifiedCount)}
          color="#a78bfa"
        />
        {verifiedOnSuiCount > 0 && (
          <StatPill
            icon={<LinkIcon size={12} color="#22c55e" />}
            label="Verified on Sui"
            value={String(verifiedOnSuiCount)}
            color="#22c55e"
          />
        )}
        {!locationObtained && (
          <span style={{ fontSize: '11px', color: '#444' }}>
            Allow location for accurate centering
          </span>
        )}
      </div>

      {/* Main area: map + feed */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <WeatherStatus />
          <Map
            incidents={incidents}
            center={center}
            userLocation={userLocation}
            onIncidentClick={(i) => {
              setSelectedCluster(null);
              setSelectedIncident(i);
            }}
            onClusterClick={(clusterIncidents) => {
              setSelectedIncident(null);
              setSelectedCluster(clusterIncidents);
            }}
          />
          {/* Mobile Stats Pills Overlay */}
          <div 
            className="flex md:hidden absolute top-[8px] left-[8px] right-[8px] z-[800] overflow-x-auto" 
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-2 pb-2 px-1 mobile-pills-wrapper">
              <StatPill
                icon={<Activity size={12} color="#3b82f6" />}
                label="Active"
                value={String(activeCount)}
                color="#3b82f6"
              />
              {criticalCount > 0 && (
                <StatPill
                  icon={<AlertTriangle size={12} color="#ef4444" />}
                  label="Critical"
                  value={String(criticalCount)}
                  color="#ef4444"
                  pulse={true}
                />
              )}
              <StatPill
                icon={<span style={{ fontSize: '12px' }}>📍</span>}
                label="Total"
                value={String(incidents.length)}
                color="#eab308"
              />
              <StatPill
                icon={<LinkIcon size={12} color="#8b5cf6" />}
                label="Walrus"
                value={String(walrusVerifiedCount)}
                color="#8b5cf6"
              />
            </div>
          </div>

          {/* Selected incident card — anchored below the weather widget, top-right */}
          {selectedIncident && (
            <div
              className="fade-in-up"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openIncidentModal', { detail: selectedIncident }));
              }}
              style={{
                cursor: 'pointer',
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                zIndex: 800,
                width: '240px',
                background: 'rgba(13,13,13,0.92)',
                backdropFilter: 'blur(14px)',
                border: `1px solid ${getSeverityColor(selectedIncident.severity)}40`,
                borderRadius: '12px',
                padding: '14px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${getSeverityColor(selectedIncident.severity)}20`,
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '15px' }}>
                    {{'medical':'🏥','fire':'🔥','crime':'🚨','accident':'💥','natural_disaster':'🌪️','other':'⚠️'}[selectedIncident.type] || '⚠️'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#e5e5e5' }}>
                    {{'medical':'Medical','fire':'Fire','crime':'Crime','accident':'Accident','natural_disaster':'Disaster','other':'Other'}[selectedIncident.type]}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <SeverityBadge severity={selectedIncident.severity} size="sm" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedIncident(null); }}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '2px', display: 'flex', lineHeight: 1 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Resolved badge */}
              {selectedIncident.status === 'resolved' && (
                <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px', fontFamily: 'monospace' }}>
                  ✓ RESOLVED
                </span>
              )}

              {/* Description */}
              <p style={{ fontSize: '12px', color: '#999', lineHeight: '1.5', marginBottom: '10px' }}>
                {selectedIncident.description}
              </p>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#555', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <MapPin size={10} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedIncident.location.address}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#555', flexShrink: 0 }}>
                  <Clock size={10} />
                  <span>{new Date(selectedIncident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Selected cluster overlay */}
          {selectedCluster && (
            <div
              className="fade-in-up mobile-cluster-overlay"
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(17, 17, 17, 0.95)',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                padding: '14px 18px',
                backdropFilter: 'blur(12px)',
                width: '380px',
                maxHeight: '400px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid #333',
                  paddingBottom: '8px',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5' }}>
                  {selectedCluster.length} Incidents in this area
                </span>
                <button
                  onClick={() => setSelectedCluster(null)}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedCluster.map((inc) => (
                  <div 
                    key={inc.id} 
                    onClick={() => {
                      setSelectedCluster(null);
                      setSelectedIncident(inc);
                      setCenter([inc.location.lat, inc.location.lng]);
                    }}
                    style={{ 
                      padding: '10px', 
                      background: '#151515', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      border: '1px solid #222',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#151515')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <SeverityBadge severity={inc.severity} pulse={false} />
                      <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </span>
                      {inc.status === 'resolved' && (
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: '#22c55e',
                            background: 'rgba(34, 197, 94, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                            marginLeft: 'auto'
                          }}
                        >
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#999', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {inc.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>

        {/* Feed sidebar */}
        <div
          className="hidden md:block"
          style={{
            width: '320px',
            background: '#0d0d0d',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <IncidentFeed
            incidents={incidents}
            onSelectIncident={(i) => {
              setSelectedIncident(i);
              setCenter([i.location.lat, i.location.lng]);
            }}
            selectedId={selectedIncident?.id}
            criticalFilter={criticalFilter}
            activeFilter={activeFilter}
            myReportsFilter={myReportsFilter}
            onResolveIncident={onResolveIncident}
            onDeleteIncident={onDeleteIncident}
          />
        </div>
      </div>

      {/* Floating Action Button */}
      {sidebarCollapsed && (
        <div style={{ position: 'absolute', bottom: '24px', right: '344px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        {showToast && (
          <div className="fade-in-up" style={{ background: '#ef4444', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}>
            Please connect your wallet first
          </div>
        )}
        <button
          onClick={() => {
            if (!account) {
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            } else {
              window.history.pushState({}, '', '/report');
              window.dispatchEvent(new Event('popstate'));
            }
          }}
          title={!account ? "Connect wallet to report" : "Report Incident"}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.5)',
            transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
            (e.currentTarget as HTMLButtonElement).style.background = '#2563eb';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLButtonElement).style.background = '#3b82f6';
          }}
        >
          <Plus size={24} />
        </button>
      </div>
      )}

      {/* Mobile bottom sheet live feed */}
      <BottomSheet
        incidents={incidents}
        onSelectIncident={(i) => {
          setSelectedIncident(i);
          setCenter([i.location.lat, i.location.lng]);
        }}
        selectedId={selectedIncident?.id}
        criticalFilter={criticalFilter}
        activeFilter={activeFilter}
        myReportsFilter={myReportsFilter}
        onResolveIncident={onResolveIncident}
        onDeleteIncident={onDeleteIncident}
      />
    </div>
  );
};

const StatPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}> = ({ icon, label, value, color, pulse, highlight, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px',
      background: highlight ? `${color}28` : `${color}10`,
      border: `1px solid ${highlight ? color : `${color}25`}`,
      borderRadius: '24px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.35s ease',
      boxShadow: highlight ? `0 0 12px ${color}40` : 'none',
    }}
  >
    {icon}
    <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
    <span
      style={{
        fontSize: '13px',
        fontWeight: 700,
        color: color,
        fontFamily: 'monospace',
        transition: 'text-shadow 0.35s ease',
        ...(pulse && Number(value) > 0
          ? { textShadow: `0 0 10px ${color}` }
          : {}),
        ...(highlight
          ? { textShadow: `0 0 14px ${color}` }
          : {}),
      }}
    >
      {value}
    </span>
  </div>
);

// ─── Floating weather-style status on the map ─────────────────
const WMO_CODES: Record<number, string> = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 71: 'Light Snow', 73: 'Snow',
  75: 'Heavy Snow', 80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Heavy Thunderstorm',
};

const getWeatherEmoji = (code: number, isNight: boolean): string => {
  if (isNight && code <= 1) return '🌙';
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌧️';
  return '⛈️';
};

const getAqiColor = (aqi?: number) => {
  if (aqi === undefined) return '#888';
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#9f1239';
};

const WeatherStatus: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{
    temp: number;
    code: number;
    city: string;
    humidity?: number;
    windSpeed?: number;
    aqi?: number;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        // Fetch weather from Open-Meteo (free, no API key)
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`
        );
        const weatherData = await weatherRes.json();

        let aqi = 45; // Default fallback
        try {
          const aqiRes = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`
          );
          const aqiData = await aqiRes.json();
          if (aqiData?.current?.us_aqi) aqi = aqiData.current.us_aqi;
        } catch { /* ignore AQI failure */ }

        // Reverse geocode city name
        let city = 'Your Location';
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`
          );
          const geoData = await geoRes.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.county || geoData.address?.state || 'Your Location';
        } catch { /* fallback to default */ }

        setWeather({
          temp: Math.round(weatherData.current.temperature_2m),
          code: weatherData.current.weather_code,
          humidity: weatherData.current.relative_humidity_2m,
          windSpeed: weatherData.current.wind_speed_10m,
          aqi,
          city,
        });
      } catch {
        // Fallback to hardcoded if API fails
        setWeather({ temp: 28, code: 2, city: 'Bengaluru', humidity: 65, windSpeed: 12, aqi: 45 });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Permission denied — fallback to Bengaluru
          fetchWeather(12.9716, 77.5946);
        },
        { timeout: 5000 }
      );
    } else {
      fetchWeather(12.9716, 77.5946);
    }
  }, []);

  const hours = time.getHours();
  const isNight = hours < 6 || hours >= 19;
  const weatherIcon = weather ? getWeatherEmoji(weather.code, isNight) : (isNight ? '🌙' : '⛅');
  const greeting = isNight ? 'Night' : hours < 12 ? 'Morning' : hours < 17 ? 'Afternoon' : 'Evening';
  const condition = weather ? (WMO_CODES[weather.code] || 'Partly Cloudy') : 'Loading...';
  const temp = weather ? `${weather.temp}°C` : '...';
  const cityName = weather?.city || '...';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`absolute z-[800] right-[16px] md:right-[16px] top-[44px] md:top-[16px] mobile-weather`}
      style={{
        background: 'rgba(13, 13, 13, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        minWidth: '200px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>{weatherIcon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#e5e5e5', fontFamily: 'monospace' }}>
              {temp}
            </span>
            <span style={{ fontSize: '11px', color: '#666' }}>{condition}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
              {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            <span style={{ fontSize: '10px', color: '#444' }}>·</span>
            <span style={{ fontSize: '11px', color: '#666' }}>
              {cityName} · Good {greeting}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <div
        style={{
          maxHeight: expanded ? '100px' : '0',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ marginTop: '12px', paddingTop: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AQI</span>
            <span style={{ fontSize: '14px', color: getAqiColor(weather?.aqi), fontWeight: 700, fontFamily: 'monospace' }}>
              {weather?.aqi || '--'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Humidity</span>
            <span style={{ fontSize: '14px', color: '#e5e5e5', fontWeight: 700, fontFamily: 'monospace' }}>
              {weather?.humidity || '--'}%
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wind</span>
            <span style={{ fontSize: '14px', color: '#e5e5e5', fontWeight: 700, fontFamily: 'monospace' }}>
              {weather?.windSpeed || '--'} <span style={{ fontSize: '10px', color: '#888' }}>km/h</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
