import { isNative } from './capacitor';

interface PushToken {
  value: string;
}

interface PushListeners {
  onTokenReceived?: (token: PushToken) => void;
  onNotificationReceived?: (notification: unknown) => void;
  onNotificationActionPerformed?: (action: unknown) => void;
}

/**
 * Register for push notifications and set up listeners.
 * Returns a cleanup function that removes all registered listeners.
 * No-op on web (web uses Web Push API from the service worker instead).
 */
export async function initPushNotifications(listeners: PushListeners): Promise<() => void> {
  if (!isNative()) return () => {};

  const handles: Array<{ remove: () => Promise<void> }> = [];

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return () => {};
    }

    // Register with APNS
    await PushNotifications.register();

    // Set up listeners and collect handles for cleanup
    if (listeners.onTokenReceived) {
      handles.push(await PushNotifications.addListener('registration', listeners.onTokenReceived));
    }

    if (listeners.onNotificationReceived) {
      handles.push(
        await PushNotifications.addListener(
          'pushNotificationReceived',
          listeners.onNotificationReceived,
        ),
      );
    }

    if (listeners.onNotificationActionPerformed) {
      handles.push(
        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          listeners.onNotificationActionPerformed,
        ),
      );
    }
  } catch (error) {
    console.error('Push notification setup failed:', error);
  }

  return () => {
    handles.forEach((h) => h.remove());
  };
}
