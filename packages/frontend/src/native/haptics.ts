import { isNative } from './capacitor';

async function getHapticsPlugin() {
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  return { Haptics, ImpactStyle };
}

/**
 * Trigger a light haptic impact. No-op on web.
 */
export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await getHapticsPlugin();
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics not critical — silent fail
  }
}

/**
 * Trigger a medium haptic impact. No-op on web.
 */
export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await getHapticsPlugin();
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Haptics not critical — silent fail
  }
}

/**
 * Trigger a success notification haptic. No-op on web.
 */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Haptics not critical — silent fail
  }
}
