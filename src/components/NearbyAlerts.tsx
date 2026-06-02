import { useNearbyAlerts } from '../hooks/useNearbyAlerts';
import { MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJI_MAP: Record<string, string> = {
  fire: '🔥',
  theft: '🚨',
  medical: '🏥',
  accident: '🚗',
  suspicious_activity: '👀',
  other: '⚠️'
};

export function NearbyAlerts() {
  const { alerts, connected, clearAlerts, dismissAlert } = useNearbyAlerts();

  if (alerts.length === 0) return null;

  const displayAlerts = alerts.slice(0, 5);
  const extraCount = alerts.length - 5;

  return (
    <div className="absolute bottom-8 left-8 z-[800] w-80 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm font-medium text-white/70 uppercase tracking-wider">Nearby Alerts</span>
        </div>
        {alerts.length >= 1 && (
          <button 
            onClick={clearAlerts}
            className="text-xs font-medium text-white/50 hover:text-white/90 transition-colors bg-white/5 px-2 py-1 rounded-md"
          >
            Clear all
          </button>
        )}
      </div>

      <AnimatePresence>
        {displayAlerts.map((alert, idx) => {
          const emoji = EMOJI_MAP[alert.type] || EMOJI_MAP.other;
          return (
            <motion.div
              key={`${alert.location.lat}-${alert.location.lng}-${idx}`}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={() => {
                window.history.pushState({}, '', '/dashboard');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 py-5 px-4 rounded-xl shadow-2xl relative overflow-hidden group cursor-pointer hover:bg-white/15 transition-colors"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                alert.severity === 'critical' ? 'bg-red-500' :
                alert.severity === 'high' ? 'bg-orange-500' :
                alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{emoji}</span>
                  <span className="font-semibold text-white capitalize">{alert.type.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 bg-white/10 rounded-full text-white/80">
                    {alert.distance} km
                  </span>
                  <button
                    onClick={() => dismissAlert(idx)}
                    className="text-white/40 hover:text-white/90 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-white/70 line-clamp-2 mb-3 pl-8">
                {alert.description}
              </p>
              
              <div className="flex items-center gap-1.5 text-xs text-white/50 pl-8">
                <MapPin size={12} />
                <span className="truncate">{alert.location.address}</span>
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
