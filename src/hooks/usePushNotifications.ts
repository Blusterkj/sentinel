// src/hooks/usePushNotifications.ts
// Registers FCM token with proxy server and handles incoming push notifications.
// Only active when running as native Android app (Capacitor).

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PROXY_URL } from '../lib/api';

// Lazy import — only runs on native Android, never in browser
async function setupPush(walletAddress: string | null) {
  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  // Request permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  // Register with FCM
  await PushNotifications.register();

  // Send FCM token to proxy so it can push new incident alerts
  PushNotifications.addListener('registration', async (token) => {
    console.log('[FCM] Token received:', token.value);
    try {
      await fetch(`${PROXY_URL}/api/fcm/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.value,
          wallet: walletAddress,
          platform: 'android',
        }),
      });
    } catch (e) {
      console.warn('[FCM] Token registration failed:', e);
    }
  });

  // Handle incoming foreground notifications
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[FCM] Foreground notification:', notification);
    // App is open — WS already shows the incident, no extra UI needed
  });

  // Handle tap on background notification
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    console.log('[FCM] Notification tapped:', data);
    // Navigate to dashboard if an incidentId is in the payload
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
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
