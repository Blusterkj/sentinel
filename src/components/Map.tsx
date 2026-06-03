// src/components/Map.tsx
// Dark-themed interactive map with severity-colored incident pins + marker clustering + heatmap

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Marker, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore — no bundled types for leaflet.heat
import 'leaflet.heat';
import type { Incident } from '../types/incident';
import { getSeverityColor } from './SeverityBadge';
import { Flame } from 'lucide-react';

interface MapProps {
  incidents: Incident[];
  center: [number, number];
  userLocation?: [number, number];
  onIncidentClick?: (incident: Incident) => void;
  onClusterClick?: (incidents: Incident[]) => void;
}

const TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌪️',
  other: '⚠️',
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
};

// Auto-pan and zoom to center when it changes
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 16), { animate: true });
  }, [center, map]);
  return null;
}

// Force map to recalculate size when container resizes (e.g. sidebar collapse)
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Heatmap overlay — adds/removes leaflet.heat layer
function HeatmapLayer({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    const points = incidents.map((inc) => [
      inc.location.lat,
      inc.location.lng,
      SEVERITY_WEIGHT[inc.severity] ?? 0.5,
    ]);

    // @ts-ignore — L.heatLayer is added by leaflet.heat
    heatLayerRef.current = L.heatLayer(points, {
      radius: 40,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: '#3b82f6',  // blue  – low density
        0.4: '#eab308',  // yellow – medium
        0.7: '#f97316',  // orange – high
        1.0: '#ef4444',  // red   – peak
      },
    });

    heatLayerRef.current.addTo(map);

    return () => {
      if (heatLayerRef.current) {
        heatLayerRef.current.remove();
        heatLayerRef.current = null;
      }
    };
  }, [map, incidents]);

  return null;
}

// Shows a button if user pans > 20km away from their location
// Also renders the heatmap toggle button
function MapControls({
  userLocation,
  showHeatmap,
  onToggleHeatmap,
}: {
  userLocation: [number, number];
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
}) {
  const map = useMap();
  const [distance, setDistance] = React.useState(0);

  useMapEvents({
    moveend: () => {
      const currentCenter = map.getCenter();
      const baseLatLng = L.latLng(userLocation[0], userLocation[1]);
      setDistance(currentCenter.distanceTo(baseLatLng));
    },
  });

  useEffect(() => {
    const currentCenter = map.getCenter();
    const baseLatLng = L.latLng(userLocation[0], userLocation[1]);
    setDistance(currentCenter.distanceTo(baseLatLng));
  }, [map, userLocation]);

  return (
    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Heatmap toggle */}
      <button
        onClick={onToggleHeatmap}
        title="Toggle Heatmap"
        style={{
          padding: '8px 14px',
          color: showHeatmap ? '#fff' : '#aaa',
          background: showHeatmap
            ? 'linear-gradient(135deg, rgba(249,115,22,0.5), rgba(239,68,68,0.4))'
            : 'rgba(17,17,17,0.85)',
          border: showHeatmap ? '1px solid #f97316' : '1px solid #333',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: showHeatmap
            ? '0 0 16px rgba(249,115,22,0.35)'
            : '0 4px 12px rgba(0,0,0,0.5)',
          transition: 'all 0.2s',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={(e) => {
          if (!showHeatmap) (e.currentTarget as HTMLButtonElement).style.background = '#222';
        }}
        onMouseLeave={(e) => {
          if (!showHeatmap) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(17,17,17,0.85)';
        }}
      >
        <Flame size={13} color={showHeatmap ? '#f97316' : '#888'} />
        Heatmap
      </button>

      {/* Return to location */}
      {distance > 20000 && (
        <button
          onClick={() => map.flyTo(userLocation, 12, { animate: true, duration: 1.5 })}
          className="glass-card"
          style={{
            padding: '10px 16px',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#222')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(17,17,17,0.85)')}
        >
          <span>📍</span> Navigate to your location
        </button>
      )}
    </div>
  );
}

// Custom cluster icon with severity-aware colors
function createClusterIcon(cluster: any) {
  const childCount = cluster.getChildCount();

  let worstLevel = 0;
  cluster.getAllChildMarkers().forEach((marker: any) => {
    const sev = marker.options?.severity as string | undefined;
    if (sev === 'critical') worstLevel = Math.max(worstLevel, 3);
    else if (sev === 'high') worstLevel = Math.max(worstLevel, 2);
    else if (sev === 'medium') worstLevel = Math.max(worstLevel, 1);
  });

  const colors = ['#3b82f6', '#eab308', '#f97316', '#ef4444'];
  const glows = [
    '0 0 12px rgba(59,130,246,0.4)',
    '0 0 16px rgba(234,179,8,0.5)',
    '0 0 20px rgba(249,115,22,0.6)',
    '0 0 24px rgba(239,68,68,0.7)',
  ];
  const color = colors[worstLevel];
  const glow = glows[worstLevel];
  const size = childCount > 20 ? 52 : childCount > 10 ? 44 : 36;

  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color}22;
      border: 2px solid ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', monospace;
      font-size: ${childCount > 20 ? 14 : 12}px;
      font-weight: 700;
      color: ${color};
      box-shadow: ${glow};
      backdrop-filter: blur(4px);
    ">${childCount}</div>`,
    className: 'sentinel-cluster-icon',
    iconSize: L.point(size, size),
  });
}

export const Map: React.FC<MapProps> = ({ incidents, center, userLocation, onIncidentClick, onClusterClick }) => {
  const [showHeatmap, setShowHeatmap] = React.useState(false);
  const fallbackLocation: [number, number] = userLocation ?? [12.9716, 77.5946];

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', background: '#0d1117' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution=""
      />
      <MapController center={center} />
      <MapResizer />
      <MapControls
        userLocation={fallbackLocation}
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap((v) => !v)}
      />

      {/* Heatmap overlay (coexists with markers) */}
      {showHeatmap && <HeatmapLayer incidents={incidents} />}

      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={60}
        spiderfyOnMaxZoom={false}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={false}
        disableClusteringAtZoom={16}
        animate={true}
        chunkedLoading={true}
        eventHandlers={{
          clusterclick: (e: any) => {
            if (e.layer && e.layer.getAllChildMarkers) {
              const markers = e.layer.getAllChildMarkers();
              const clusterIncidents = markers.map((m: any) => m.options.incident).filter(Boolean);
              onClusterClick?.(clusterIncidents);
            }
          },
        }}
        onClick={(e: any) => {
          if (e.layer && e.layer.getAllChildMarkers) {
            const markers = e.layer.getAllChildMarkers();
            const clusterIncidents = markers.map((m: any) => m.options.incident).filter(Boolean);
            onClusterClick?.(clusterIncidents);
          }
        }}
        // @ts-ignore
        onClusterClick={(cluster: any) => {
          if (cluster && cluster.layer && cluster.layer.getAllChildMarkers) {
            const markers = cluster.layer.getAllChildMarkers();
            const clusterIncidents = markers.map((m: any) => m.options.incident).filter(Boolean);
            onClusterClick?.(clusterIncidents);
          }
        }}
      >
        {incidents.map((incident) => {
          const color = getSeverityColor(incident.severity);
          const isHighOrCritical = incident.severity === 'high' || incident.severity === 'critical';
          const glow = isHighOrCritical ? `0 0 16px ${color}` : 'none';

          const iconHtml = `
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: #111;
              border: 2px solid ${color};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              box-shadow: ${glow};
              position: relative;
            ">
              ${TYPE_ICONS[incident.type] || '⚠️'}
              ${isHighOrCritical ? `
                <div style="
                  position: absolute;
                  inset: -6px;
                  border-radius: 50%;
                  border: 1px dashed ${color};
                  opacity: 0.4;
                "></div>
              ` : ''}
            </div>
          `;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'sentinel-incident-icon',
            iconSize: L.point(32, 32),
            iconAnchor: L.point(16, 16),
          });

          return (
            <Marker
              key={incident.id}
              position={[incident.location.lat, incident.location.lng]}
              icon={customIcon}
              eventHandlers={{
                click: () => onIncidentClick?.(incident),
              }}
              // @ts-ignore
              severity={incident.severity}
              // @ts-ignore
              incident={incident}
            />
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
};
