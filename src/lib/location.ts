import { Capacitor } from '@capacitor/core';

/**
 * Platform-aware location wrapper.
 * 
 * On native (Capacitor APK): uses @capacitor/geolocation ONLY to trigger
 * the native Android permission dialog, then falls back to the standard
 * navigator.geolocation API (which works perfectly inside the WebView
 * once the OS-level permission is granted — same engine as Chrome).
 * 
 * On web: uses navigator.geolocation directly.
 */
let locationPromise: Promise<{ latitude: number; longitude: number } | null> | null = null;

export async function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (locationPromise) return locationPromise;

  locationPromise = (async () => {
    try {
      // On native: ensure OS permission is granted first
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.checkPermissions();
        if (perm.location === 'denied') return null;
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') return null;
        }
      }

      // Both native and web: use the standard browser API for the actual position
      // (fast, uses WiFi + cell + GPS, same as Chrome)
      return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 10000 }
        );
      });
    } catch (error) {
      console.error('[Location] Failed to get position:', error);
      return null;
    } finally {
      // Clear the cache shortly after completion so future distinct requests can run
      setTimeout(() => { locationPromise = null; }, 2000);
    }
  })();

  return locationPromise;
}

