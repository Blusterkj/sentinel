// src/components/Map.tsx
// Dark-themed interactive map with severity-colored incident pins + marker clustering

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident } from '../types/incident';
import { getSeverityColor } from './SeverityBadge';

interface MapProps {
  incidents: Incident[];
  center: [number, number];
  onIncidentClick?: (incident: Incident) => void;
}

const severityRadii: Record<string, number> = {
  low: 10,
  medium: 14,
  high: 18,
  critical: 22,
};

// Auto-pan to center when it changes
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
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

// Custom cluster icon with severity-aware colors
function createClusterIcon(cluster: any) {
  const childCount = cluster.getChildCount();

  // Determine cluster severity color based on worst incident inside
  let worstLevel = 0; // 0=low, 1=medium, 2=high, 3=critical
  cluster.getAllChildMarkers().forEach((marker: any) => {
    const sev = marker.options?.severity as string | undefined;
    if (sev === 'critical') worstLevel = Math.max(worstLevel, 3);
    else if (sev === 'high') worstLevel = Math.max(worstLevel, 2);
    else if (sev === 'medium') worstLevel = Math.max(worstLevel, 1);
  });

  const colors = ['#3b82f6', '#eab308', '#f97316', '#ef4444']; // low/medium/high/critical
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

export const Map: React.FC<MapProps> = ({ incidents, center, onIncidentClick }) => {
  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', background: '#0d1117' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        attribution="&copy; Google Maps"
      />
      <MapController center={center} />
      <MapResizer />

      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={60}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        disableClusteringAtZoom={16}
        animate={true}
        chunkedLoading={true}
      >
        {incidents.map((incident) => {
          const color = getSeverityColor(incident.severity);
          const radius = severityRadii[incident.severity] || 12;
          const isHighOrCritical = incident.severity === 'high' || incident.severity === 'critical';
          const pulsePadding = incident.severity === 'critical' ? 12 : incident.severity === 'high' ? 8 : 6;

          return (
            <React.Fragment key={incident.id}>
              {/* Outer pulse ring for all severities */}
              {/* @ts-ignore - react-leaflet typing issue with radius */}
              <CircleMarker
                center={[incident.location.lat, incident.location.lng]}
                radius={radius + pulsePadding}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.1,
                  weight: 1,
                  opacity: 0.4,
                  dashArray: '4 4',
                }}
              />

              {/* Main marker — pass severity as option for cluster coloring */}
              {/* @ts-ignore - react-leaflet typing issue with radius and severity */}
              <CircleMarker
                center={[incident.location.lat, incident.location.lng]}
                radius={radius}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: isHighOrCritical ? 0.85 : 0.7,
                  weight: isHighOrCritical ? 2 : 1.5,
                  opacity: 1,
                }}
                eventHandlers={{
                  click: () => onIncidentClick?.(incident),
                }}
                // @ts-ignore — custom option for cluster icon coloring
                severity={incident.severity}
              >
                {/* @ts-ignore - popup closeButton prop type mismatch */}
                <Popup
                  closeButton={false}
                  className="sentinel-popup"
                >
                  <IncidentPopup incident={incident} />
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
};

// Inline popup — no external CSS classes needed
const IncidentPopup: React.FC<{ incident: Incident }> = ({ incident }) => {
  const color = getSeverityColor(incident.severity);
  const typeLabels: Record<string, string> = {
    medical: '🏥 Medical',
    fire: '🔥 Fire',
    crime: '🚨 Crime',
    accident: '💥 Accident',
    natural_disaster: '🌪️ Natural Disaster',
    other: '⚠️ Other',
  };

  return (
    <div
      style={{
        background: '#111',
        border: `1px solid ${color}40`,
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>
          {typeLabels[incident.type] || incident.type}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: color,
            background: `${color}20`,
            padding: '2px 6px',
            borderRadius: '3px',
            fontFamily: 'monospace',
          }}
        >
          {incident.severity.toUpperCase()}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: '#888', lineHeight: '1.4', marginBottom: '8px' }}>
        {incident.description}
      </p>
      <div style={{ fontSize: '11px', color: '#555' }}>
        {incident.location.address}
      </div>
    </div>
  );
};
