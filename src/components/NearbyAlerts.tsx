import { useNearbyAlerts } from '../hooks/useNearbyAlerts';
import { MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '../types/incident';
import { getSeverityColor } from './SeverityBadge';

const EMOJI_MAP: Record<string, string> = {
  fire: '🔥',
  theft: '🚨',
  medical: '🏥',
  accident: '🚗',
  suspicious_activity: '👀',
  other: '⚠️'
};

interface NearbyAlertsProps {
  onNewIncident?: (incident: Incident) => void;
  onIncidentUpdated?: (incident: Incident) => void;
}

export function NearbyAlerts({ onNewIncident, onIncidentUpdated }: NearbyAlertsProps = {}) {
  const { alerts, dismissAlert } = useNearbyAlerts({ onNewIncident, onIncidentUpdated });

  if (alerts.length === 0) return null;

  const displayAlerts = alerts.slice(0, 5);
  const extraCount = alerts.length - 5;

  return (
    <div className="absolute z-[800]" style={{ left: 0, bottom: 0, right: 0, pointerEvents: 'none' }}>
      <AnimatePresence>
        {displayAlerts.map((alert, idx) => {
          const emoji = EMOJI_MAP[alert.type] || EMOJI_MAP.other;
          return (
            <motion.div
              key={`${alert.location.lat}-${alert.location.lng}-${idx}`}
              className="mobile-incident-popup fade-in-up"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={() => {
                dismissAlert(idx);
                window.history.pushState({}, '', '/dashboard');
                window.dispatchEvent(new Event('popstate'));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('selectIncident', { detail: alert }));
                }, 300);
              }}
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                zIndex: 800,
                width: '240px',
                background: 'rgba(13,13,13,0.92)',
                backdropFilter: 'blur(14px)',
                border: `1px solid ${getSeverityColor(alert.severity as any)}40`,
                borderRadius: '12px',
                padding: '14px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${getSeverityColor(alert.severity as any)}20`,
              }}
            >
              
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emoji}</span>
                  <span className="text-xs font-medium px-2 py-1 bg-white/10 rounded-full text-white/80">
                    {alert.distance} km
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissAlert(idx); }}
                    className="text-white/40 hover:text-white/90 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              <p style={{ 
                fontSize: '12px', 
                color: '#999', 
                lineHeight: '1.5', 
                marginBottom: '10px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'left'
              }}>
                {alert.description}
              </p>
              
              <div className="flex items-center justify-start gap-1.5 text-xs text-white/50 pr-8">
                <MapPin size={12} />
                <span className="truncate text-left">{alert.location.address}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      
      {extraCount > 0 && (
        <div className="text-center text-xs text-white/50 py-1">
          +{extraCount} more alerts
        </div>
      )}
    </div>
  );
}
