import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Google Calendar sync.
 *
 * A member connects their Google Calendar once (OAuth, offline access). We then:
 *   1. READ their free/busy so their real calendar blocks out bookable slots -
 *      nobody can book a Nova call over a meeting they already have.
 *   2. WRITE a calendar event when a booking is confirmed, and delete it when
 *      the booking is canceled - so a Nova call shows up on their Google
 *      Calendar automatically.
 *
 * Everything here is BEST-EFFORT: a member who hasn't connected, an expired
 * grant, or a Google outage must never break the booking flow. Read helpers
 * return empty/no-op, write helpers swallow and log.
 *
 * Auth model: the OAuth grant is initiated by a logged-in member. Since a
 * full-page redirect to Google can't carry our Bearer token, the connect URL
 * embeds the member's id in a short-lived signed `state` JWT; the callback
 * verifies it and knows who is connecting. This mirrors the login OAuth flow.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_API = 'https://www.googleapis.com/calendar/v3';

// calendar.events = create/delete events on the member's calendar.
// calendar.freebusy = read busy intervals (no event details) to block slots.
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
].join(' ');

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** The exact redirect URI Google will call back. Must be registered in the
 *  Google Cloud console's OAuth client. */
export function calendarCallbackUrl(): string {
  return env.GOOGLE_CALENDAR_CALLBACK_URL ?? `${env.API_URL}/api/v1/integrations/calendar/callback`;
}

export function buildCalendarAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: calendarCallbackUrl(),
    response_type: 'code',
    scope: CALENDAR_SCOPES,
    state,
    access_type: 'offline',
    // Force the consent screen so Google always returns a refresh_token, even
    // on a re-connect where the user previously granted access.
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
    redirect_uri: calendarCallbackUrl(),
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw AppError.badRequest(`Google Calendar token exchange failed: ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/** Exchange the auth code and persist the connection for `userId`. */
export async function connectCalendar(userId: string, code: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) {
    // Without a refresh token we can't keep syncing after the ~1hr access
    // token expires. Force a full re-consent (prompt=consent) so we get one.
    throw AppError.badRequest('Google did not return offline access. Please reconnect and allow calendar access.');
  }
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CalendarConnection"
       ("id", "userId", "provider", "accessToken", "refreshToken", "expiresAt", "calendarId", "syncBusy", "pushEvents", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'google', $2, $3, $4, 'primary', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("userId") DO UPDATE SET
       "accessToken" = EXCLUDED."accessToken",
       "refreshToken" = EXCLUDED."refreshToken",
       "expiresAt" = EXCLUDED."expiresAt",
       "provider" = 'google',
       "updatedAt" = CURRENT_TIMESTAMP`,
    userId,
    tokens.access_token,
    tokens.refresh_token,
    expiresAt,
  );
}

export interface CalendarConnectionRow {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  calendarId: string;
  syncBusy: boolean;
  pushEvents: boolean;
}

async function getConnectionRow(userId: string): Promise<CalendarConnectionRow | null> {
  const rows = await prisma.$queryRawUnsafe<CalendarConnectionRow[]>(
    `SELECT "userId", "accessToken", "refreshToken", "expiresAt", "calendarId", "syncBusy", "pushEvents"
       FROM "CalendarConnection" WHERE "userId" = $1 LIMIT 1`,
    userId,
  );
  return rows[0] ?? null;
}

/** Public connection status for the UI (never leaks tokens). */
export async function getCalendarStatus(userId: string): Promise<{ connected: boolean }> {
  try {
    const row = await getConnectionRow(userId);
    return { connected: Boolean(row) };
  } catch {
    return { connected: false };
  }
}

export async function disconnectCalendar(userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM "CalendarConnection" WHERE "userId" = $1`, userId);
}

/** Return a live access token, refreshing (and persisting) it if near expiry. */
async function getValidAccessToken(row: CalendarConnectionRow): Promise<string | null> {
  if (new Date(row.expiresAt).getTime() > Date.now() + 60_000) {
    return row.accessToken;
  }
  try {
    const body = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: row.refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      // A revoked/invalid grant (400/401) means the member disconnected on
      // Google's side - drop our stale row so the UI shows "not connected".
      if (res.status === 400 || res.status === 401) {
        await disconnectCalendar(row.userId).catch(() => undefined);
      }
      return null;
    }
    const tokens = (await res.json()) as GoogleTokenResponse;
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
    await prisma.$executeRawUnsafe(
      `UPDATE "CalendarConnection" SET "accessToken" = $2, "expiresAt" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $1`,
      row.userId,
      tokens.access_token,
      expiresAt,
    );
    return tokens.access_token;
  } catch {
    return null;
  }
}

export interface BusyInterval {
  start: number; // epoch ms
  end: number;
}

/**
 * The member's busy intervals from their Google Calendar in [timeMin, timeMax].
 * Best-effort: returns [] if not connected, not configured, or on any error,
 * so slot generation degrades to DB-only availability rather than failing.
 */
export async function getBusyIntervals(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  if (!isGoogleCalendarConfigured()) return [];
  try {
    const row = await getConnectionRow(userId);
    if (!row || !row.syncBusy) return [];
    const token = await getValidAccessToken(row);
    if (!token) return [];
    const res = await fetch(`${CAL_API}/freeBusy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: row.calendarId || 'primary' }],
      }),
      // free/busy is on the booking hot path - never let a slow Google hang it.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };
    const cal = data.calendars?.[row.calendarId || 'primary'];
    const busy = cal?.busy ?? [];
    return busy
      .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
      .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
  } catch {
    return [];
  }
}

export interface PushEventInput {
  userId: string;
  summary: string;
  description?: string;
  location?: string; // Zoom / Jitsi join URL
  startsAt: Date;
  endsAt: Date;
}

/**
 * Create an event on the member's Google Calendar. Returns the Google event id
 * (to store for later deletion) or null when the member isn't connected / on
 * any error. Never throws.
 */
export async function pushEvent(input: PushEventInput): Promise<string | null> {
  if (!isGoogleCalendarConfigured()) return null;
  try {
    const row = await getConnectionRow(input.userId);
    if (!row || !row.pushEvents) return null;
    const token = await getValidAccessToken(row);
    if (!token) return null;
    const res = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(row.calendarId || 'primary')}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.startsAt.toISOString(), timeZone: 'UTC' },
          end: { dateTime: input.endsAt.toISOString(), timeZone: 'UTC' },
          source: { title: 'Referral Nova', url: 'https://dashboard.referralnova.com/dashboard/bookings' },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[gcal] pushEvent failed:', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[gcal] pushEvent error:', String(err).slice(0, 200));
    return null;
  }
}

/** Delete a previously pushed event. No-op when the member isn't connected. */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  if (!isGoogleCalendarConfigured() || !eventId) return;
  try {
    const row = await getConnectionRow(userId);
    if (!row) return;
    const token = await getValidAccessToken(row);
    if (!token) return;
    await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(row.calendarId || 'primary')}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
  } catch {
    // best-effort
  }
}
