// src/components/Map.tsx
// Dark-themed interactive map with severity-colored incident pins + marker clustering

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Popup, useMap, Marker, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident } from '../types/incident';
import { getSeverityColor } from './SeverityBadge';

interface MapProps {
  incidents: Incident[];
  center: [number, number];
  userLocation?: [number, number];
  onIncidentClick?: (incident: Incident) => void;
  onClusterClick?: (incidents: Incident[]) => void;
  selectedIncident?: Incident | null;
}



const TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌪️',
  other: '⚠️',
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

// Shows a button if user pans > 80km away from their location
function ReturnToLocation({ userLocation }: { userLocation: [number, number] }) {
  const map = useMap();
  const [distance, setDistance] = React.useState(0);

  // Update distance whenever the map finishes moving
  useMapEvents({
    moveend: () => {
      const currentCenter = map.getCenter();
      const baseLatLng = L.latLng(userLocation[0], userLocation[1]);
      const distMeters = currentCenter.distanceTo(baseLatLng);
      setDistance(distMeters);
    }
  });

  // Check on initial mount too
  useEffect(() => {
    const currentCenter = map.getCenter();
    const baseLatLng = L.latLng(userLocation[0], userLocation[1]);
    const distMeters = currentCenter.distanceTo(baseLatLng);
    setDistance(distMeters);
  }, [map, userLocation]);

  if (distance > 80000) { // 80km
    return (
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000 }}>
        <button
          onClick={() => {
            map.flyTo(userLocation, 12, { animate: true, duration: 1.5 });
          }}
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
          onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(17,17,17,0.85)')}
        >
          <span>📍</span> Navigate to your location
        </button>
      </div>
    );
  }
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

export const Map: React.FC<MapProps> = ({ incidents, center, userLocation, onIncidentClick, onClusterClick, selectedIncident }) => {
  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', width: '100%', background: '#0d1117' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution=""
      />
      <MapController center={center} />
      <MapResizer />
      {userLocation && <ReturnToLocation userLocation={userLocation} />}

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
          }
        }}
        onClick={(e: any) => {
          if (e.layer && e.layer.getAllChildMarkers) {
             const markers = e.layer.getAllChildMarkers();
             const clusterIncidents = markers.map((m: any) => m.options.incident).filter(Boolean);
             onClusterClick?.(clusterIncidents);
          }
        }}
        // @ts-ignore - some versions of react-leaflet-cluster use this prop directly
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
              ref={(r) => {
                if (r && selectedIncident?.id === incident.id) {
                  r.openPopup();
                }
              }}
            >
              {/* @ts-ignore - popup closeButton prop type mismatch */}
              <Popup closeButton={false} className="sentinel-popup">
                <IncidentPopup incident={incident} />
              </Popup>
            </Marker>
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
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {incident.status === 'resolved' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#22c55e',
                background: 'rgba(34, 197, 94, 0.2)',
                padding: '2px 6px',
                borderRadius: '3px',
                fontFamily: 'monospace',
              }}
            >
              RESOLVED
            </span>
          )}
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
