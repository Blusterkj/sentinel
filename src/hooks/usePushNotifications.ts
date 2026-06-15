// src/hooks/usePushNotifications.ts
// Registers FCM token + GPS location with proxy for 20km proximity filtering.
// Only active when running as native Android app (Capacitor).

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PROXY_URL } from '../lib/api';

/** Get current GPS position (returns null if unavailable) */
function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

async function registerToken(token: string, walletAddress: string | null) {
  const location = await getPosition();
  await fetch(`${PROXY_URL}/api/fcm/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      wallet: walletAddress,
      platform: 'android',
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    }),
  });
  console.log('[FCM] Registered token with location:', location);
}

// Lazy import — only runs on native Android, never in browser
async function setupPush(walletAddress: string | null) {
  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  // Request permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  // Register with FCM
  await PushNotifications.register();

  // Send FCM token + GPS to proxy
  PushNotifications.addListener('registration', async (token) => {
    console.log('[FCM] Token received:', token.value);
    try {
      await registerToken(token.value, walletAddress);
    } catch (e) {
      console.warn('[FCM] Token registration failed:', e);
    }
  });

  // Check if app was opened from a killed state via notification
  const delivered = await PushNotifications.getDeliveredNotifications();
  if (delivered.notifications?.length > 0) {
    const latest = delivered.notifications[0];
    if (latest.data?.incidentId) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('openIncidentFromNotification', { detail: latest.data.incidentId })
        );
      }, 1500); // wait for app to fully mount
    }
  }

  // Handle incoming foreground notifications — emit event for in-app toast
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[FCM] Foreground notification:', notification);
    window.dispatchEvent(new CustomEvent('fcmForegroundAlert', { detail: notification }));
  });

  // Handle tap on background/killed notification → open incident on map
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    console.log('[FCM] Notification tapped:', data);
    if (data?.incidentId) {
      window.dispatchEvent(
        new CustomEvent('openIncidentFromNotification', { detail: data.incidentId })
      );
    }
  });
}

export function usePushNotifications(walletAddress: string | null) {
  useEffect(() => {
    setupPush(walletAddress).catch(console.warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
