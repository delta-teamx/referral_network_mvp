import { env } from '../../config/env.js';

/**
 * Zoom meeting provisioning. When ZOOM_ACCOUNT_ID + ZOOM_CLIENT_ID +
 * ZOOM_CLIENT_SECRET are set, creates real scheduled meetings via the
 * Server-to-Server OAuth flow. Otherwise returns a deterministic fake
 * URL so the booking flow works end-to-end in demo mode.
 */

export interface ZoomMeetingParams {
  topic: string;
  startsAt: Date;
  durationMin: number;
  hostEmail?: string;
}

export interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl?: string;
  demo: boolean;
}

function isZoomConfigured(): boolean {
  return Boolean(
    env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET,
  );
}

async function getZoomAccessToken(): Promise<string> {
  const basic = Buffer.from(
    `${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    // eslint-disable-next-line no-console
    console.error('[zoom] token request failed:', res.status, text);
    throw new Error(`Zoom token request failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function createZoomMeeting(
  params: ZoomMeetingParams,
): Promise<ZoomMeetingResult> {
  if (!isZoomConfigured()) {
    const meetingId = `demo-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    return {
      meetingId,
      joinUrl: `https://zoom.us/j/${meetingId.replace(/\D/g, '') || '1234567890'}?pwd=demo`,
      demo: true,
    };
  }

  const token = await getZoomAccessToken();
  const res = await fetch(
    'https://api.zoom.us/v2/users/me/meetings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: params.topic,
        type: 2, // scheduled
        start_time: params.startsAt.toISOString(),
        duration: params.durationMin,
        timezone: 'UTC',
        settings: {
          join_before_host: true,
          waiting_room: false,
          approval_type: 2,
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    // eslint-disable-next-line no-console
    console.error('[zoom] meeting create failed:', res.status, err);
    throw new Error(`Zoom meeting create failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    id: number;
    join_url: string;
    start_url: string;
  };
  return {
    meetingId: String(data.id),
    joinUrl: data.join_url,
    startUrl: data.start_url,
    demo: false,
  };
}
