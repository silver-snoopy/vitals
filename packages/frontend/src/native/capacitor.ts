import { Capacitor } from '@capacitor/core';

/**
 * Returns true when running inside a native Capacitor shell (iOS/Android).
 * Returns false when running as a web app (PWA or browser).
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform: 'ios', 'android', or 'web'.
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}
