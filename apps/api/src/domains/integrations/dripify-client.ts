import { env } from '../../config/env.js';

/**
 * Thin Dripify API client for outbound LinkedIn DMs.
 *
 * Dripify's REST API exposes a "send message" endpoint that enqueues a DM
 * inside the user's connected LinkedIn account, respecting their daily
 * sending limits. We never call LinkedIn directly — that's a ToS hot zone.
 *
 * When DRIPIFY_API_KEY is unset, sendDripifyDm is a no-op that returns
 * { sent: false, reason: 'disabled' } so the meeting-invite flow can pick
 * the email path instead. Same pattern as twilio + anthropic + web-push.
 */

export interface DripifyDmResult {
  sent: boolean;
  reason?: 'disabled' | 'api_error';
  externalId?: string;
}

export function isDripifyEnabled(): boolean {
  return Boolean(env.DRIPIFY_API_KEY);
}

export async function sendDripifyDm(input: {
  linkedInUrl: string;
  message: string;
}): Promise<DripifyDmResult> {
  if (!env.DRIPIFY_API_KEY) {
    return { sent: false, reason: 'disabled' };
  }
  try {
    const res = await fetch(`${env.DRIPIFY_API_URL.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DRIPIFY_API_KEY}`,
      },
      body: JSON.stringify({
        profile_url: input.linkedInUrl,
        message: input.message,
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('[dripify] DM send failed', res.status, await res.text());
      return { sent: false, reason: 'api_error' };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, externalId: data.id };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dripify] DM send threw', err);
    return { sent: false, reason: 'api_error' };
  }
}
