import { api, ApiError } from './api';

/**
 * Browser-side helpers for Web Push (Feature 6).
 *
 *   isPushSupported() — environment capability check
 *   getPushState() — current permission + subscription state
 *   subscribeToPush(token) — register the service worker, request
 *     permission if needed, create a PushSubscription, persist it on the
 *     API. Resolves with true on success, false if the user denies.
 *   unsubscribeFromPush(token) — pull the subscription on this device.
 *
 * The caller is responsible for surfacing UI state; this file does no
 * UI work itself.
 */

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  endpoint: string | null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false, endpoint: null };
  }
  const permission = Notification.permission;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return {
    supported: true,
    permission,
    subscribed: !!subscription,
    endpoint: subscription?.endpoint ?? null,
  };
}

interface PublicKeyResponse {
  publicKey: string | null;
  enabled: boolean;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

export async function subscribeToPush(accessToken: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const config = await api.get<PublicKeyResponse>('/api/v1/push/public-key', {});
  if (!config.enabled || !config.publicKey) return { ok: false, reason: 'server_disabled' };

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return { ok: false, reason: 'denied' };
  } else if (Notification.permission === 'denied') {
    return { ok: false, reason: 'denied' };
  }

  const registration = await getRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey).buffer as ArrayBuffer,
    });
  }

  const json = subscription.toJSON();
  try {
    await api.post(
      '/api/v1/push/subscribe',
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      },
      { accessToken },
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, reason: err.message };
    return { ok: false, reason: (err as Error).message };
  }
}

export async function unsubscribeFromPush(accessToken: string): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await api.post('/api/v1/push/unsubscribe', { endpoint: subscription.endpoint }, { accessToken });
  } catch {
    // best-effort
  }
  await subscription.unsubscribe();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}
