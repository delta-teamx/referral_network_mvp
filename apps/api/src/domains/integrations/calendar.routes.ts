import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { env } from '../../config/env.js';
import {
  buildCalendarAuthUrl,
  connectCalendar,
  disconnectCalendar,
  getCalendarStatus,
  isGoogleCalendarConfigured,
} from './google-calendar.service.js';

/**
 * Google Calendar connect flow.
 *
 *   GET  /connect-url  (auth)  -> { url }   frontend then window.location = url
 *   GET  /callback     (public) Google redirects here with ?code&state
 *   GET  /status       (auth)  -> { connected }
 *   POST /disconnect   (auth)  -> { disconnected: true }
 *
 * The Bearer token can't ride a full-page redirect to Google, so /connect-url
 * mints a short-lived signed `state` JWT carrying the member's id. /callback
 * verifies it to know who is connecting - no cookies, survives restarts.
 */
export const calendarRouter: Router = Router();

function calendarStateSecret(): string {
  const secret = env.JWT_ACCESS_SECRET;
  if (!secret) throw AppError.badRequest('Calendar sync is not configured.');
  return secret;
}

function createCalendarState(userId: string): string {
  return jwt.sign({ uid: userId, kind: 'gcal' }, calendarStateSecret(), { expiresIn: '10m' });
}

function verifyCalendarState(state: string): string | null {
  try {
    const payload = jwt.verify(state, calendarStateSecret(), { algorithms: ['HS256'] }) as {
      uid?: string;
      kind?: string;
    };
    if (payload.kind !== 'gcal' || !payload.uid) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

// --- /callback is PUBLIC (Google calls it); everything else needs auth. -------
calendarRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
    const dest = `${origin}/dashboard/bookings`;
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const userId = state ? verifyCalendarState(state) : null;
      if (!code || !userId) {
        res.redirect(`${dest}?calendar=error`);
        return;
      }
      await connectCalendar(userId, code);
      res.redirect(`${dest}?calendar=connected`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[gcal] callback failed', err);
      res.redirect(`${dest}?calendar=error`);
    }
  }),
);

calendarRouter.use(authenticate);

calendarRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const status = await getCalendarStatus(req.user.id);
    const body: ApiResponse<{ connected: boolean; configured: boolean }> = {
      success: true,
      data: { ...status, configured: isGoogleCalendarConfigured() },
    };
    res.json(body);
  }),
);

calendarRouter.get(
  '/connect-url',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (!isGoogleCalendarConfigured()) {
      throw AppError.badRequest('Google Calendar sync is not configured on this server yet.');
    }
    const state = createCalendarState(req.user.id);
    const url = buildCalendarAuthUrl(state);
    const body: ApiResponse<{ url: string }> = { success: true, data: { url } };
    res.json(body);
  }),
);

calendarRouter.post(
  '/disconnect',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await disconnectCalendar(req.user.id);
    const body: ApiResponse<{ disconnected: true }> = { success: true, data: { disconnected: true } };
    res.json(body);
  }),
);
