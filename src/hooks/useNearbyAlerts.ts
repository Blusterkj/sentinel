import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../lib/api';
import type { Incident } from '../types/incident';

import { getCurrentPosition } from '../lib/location';

export interface NearbyAlert {
  type: string;
  severity: string;
  description: string;
  location: { address: string; lat: number; lng: number };
  distance: string;
}

interface UseNearbyAlertsOptions {
  onNewIncident?: (incident: Incident) => void;
  onIncidentUpdated?: (incident: Incident) => void;
}

export function useNearbyAlerts(options: UseNearbyAlertsOptions = {}) {
  const ws = useRef<WebSocket | null>(null);
  const [alerts, setAlerts] = useState<NearbyAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    console.log('[SENTINEL] WebSocket connecting to:', WS_URL);
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = async () => {
      setConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Share location
      const pos = await getCurrentPosition();
      if (pos) {
        ws.current?.send(JSON.stringify({
          type: 'location',
          lat: pos.latitude,
          lng: pos.longitude,
        }));
      }
    };

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        console.log('[SENTINEL] WS message received:', msg.type);

        if (msg.type === 'nearby_alert') {
          setAlerts(prev => [msg.incident, ...prev].slice(0, 10));

          if (Notification.permission === 'default') {
            Notification.requestPermission();
          }

          if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
            new Notification('⚠️ Sentinel Alert', {
              body: `${msg.incident.type} reported ${msg.incident.distance}km away — ${msg.incident.location.address}`,
              icon: '/sentinel-icon.png',
              tag: 'sentinel-alert',
            });
          }
        }

        // Real-time cross-device sync: new incident stored by any client
        if (msg.type === 'NEW_INCIDENT' && msg.incident) {
          optionsRef.current.onNewIncident?.(msg.incident as Incident);
        }

        // Real-time cross-device sync: flag count changed
        if (msg.type === 'INCIDENT_UPDATED' && msg.incident) {
          optionsRef.current.onIncidentUpdated?.(msg.incident as Incident);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.current.onclose = () => {
      setConnected(false);
      // Try to reconnect in 3 seconds
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.current.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.current?.close(); // Will trigger onclose and reconnect
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const clearAlerts = () => setAlerts([]);
  const dismissAlert = (index: number) => setAlerts(prev => prev.filter((_, i) => i !== index));

  return { alerts, connected, clearAlerts, dismissAlert };
}
