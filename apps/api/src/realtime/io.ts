import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Real-time transport (Socket.IO).
 *
 * This module is deliberately a LEAF: it imports only env + token
 * verification, never a domain service. Domain code that wants to push a
 * live event calls the exported `emitToUser` / presence helpers, so there is
 * no import cycle (notifications -> realtime, never the reverse).
 *
 * Design for a single Render web instance:
 *   - Each authenticated socket joins a room named `user:<userId>`.
 *   - Presence is tracked in-process by counting live sockets per user (a
 *     user may have several tabs/devices open at once).
 *   - `emitToUser` fans a payload out to every socket in that user's room.
 *
 * Scaling later to multiple instances only requires swapping the in-memory
 * presence map for a shared adapter (e.g. @socket.io/redis-adapter) - every
 * call site below already goes through these helpers, so nothing else moves.
 */

let io: SocketIOServer | null = null;

/**
 * userId -> number of live sockets. A user is "online" while the count > 0.
 * Multiple tabs increment/decrement the same entry so presence survives a
 * single tab closing.
 */
const socketCounts = new Map<string, number>();

interface SocketAuth {
  userId: string;
  email: string;
  role: string;
}

/** Per-socket setup a domain can register (e.g. messaging typing/receipt
 *  handlers). Called once for every authenticated connection. */
export type ConnectionHandler = (socket: Socket, userId: string) => void;
const connectionHandlers: ConnectionHandler[] = [];

/**
 * Register extra behavior to run on every authenticated socket. Domains use
 * this to attach their own event listeners (typing relays, delivery acks)
 * without the leaf realtime module needing to import them. Safe to call before
 * or after init - handlers are applied to all future connections.
 */
export function onConnection(handler: ConnectionHandler): void {
  connectionHandlers.push(handler);
}

/** Pull the JWT from the handshake (auth payload first, Authorization header fallback). */
function tokenFromHandshake(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const t = header.slice('Bearer '.length).trim();
    if (t) return t;
  }
  return null;
}

function allowedOrigins(): string[] {
  return env.FRONTEND_URL.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Attach Socket.IO to the shared HTTP server. Idempotent per process. */
export function initRealtime(server: HttpServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, {
    // Mirror the Express CORS policy: explicit FRONTEND_URL origins plus our
    // own Netlify preview subdomains. Socket.IO's initial handshake is an
    // XHR/polling request, so it is subject to CORS just like the REST API.
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins().includes(origin)) return cb(null, true);
        if (/^https:\/\/[a-z0-9-]+--virtualprosnetwork\.netlify\.app$/i.test(origin)) {
          return cb(null, true);
        }
        return cb(new Error(`Socket CORS blocked: ${origin}`));
      },
      credentials: true,
    },
    // Keep the polling fallback available: some corporate proxies block raw
    // WebSockets, and Socket.IO silently upgrades to WS when it can.
    transports: ['websocket', 'polling'],
    // A dead client is reaped ~40s after it stops responding, which keeps the
    // presence map honest for the offline-only email digest (Phase 3).
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // ---- Handshake auth ------------------------------------------------------
  // Reject any connection without a valid access token BEFORE it joins a room,
  // so a socket can only ever receive its own user's events.
  io.use((socket, next) => {
    const token = tokenFromHandshake(socket);
    if (!token) return next(new Error('Authentication required'));
    try {
      const claims = verifyAccessToken(token);
      (socket.data as { auth?: SocketAuth }).auth = {
        userId: claims.sub,
        email: claims.email,
        role: String(claims.role),
      };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const auth = (socket.data as { auth?: SocketAuth }).auth;
    if (!auth) {
      socket.disconnect(true);
      return;
    }
    const { userId } = auth;
    void socket.join(roomForUser(userId));
    // Admins share a room so support/ops events can fan out to the whole team
    // (live ticket updates in the admin console) with one emit.
    if (auth.role === 'ADMIN') void socket.join('admins');
    incrementPresence(userId);

    // Let domains attach their own per-socket listeners (typing, receipts).
    for (const handler of connectionHandlers) {
      try {
        handler(socket, userId);
      } catch {
        /* one bad handler must not drop the connection */
      }
    }

    socket.on('disconnect', () => {
      decrementPresence(userId);
    });
  });

  return io;
}

/** Room name convention - one room per user, all their devices/tabs inside. */
export function roomForUser(userId: string): string {
  return `user:${userId}`;
}

function incrementPresence(userId: string): void {
  socketCounts.set(userId, (socketCounts.get(userId) ?? 0) + 1);
}

function decrementPresence(userId: string): void {
  const next = (socketCounts.get(userId) ?? 0) - 1;
  if (next <= 0) socketCounts.delete(userId);
  else socketCounts.set(userId, next);
}

/**
 * Push a real-time event to every socket a user currently has open. No-op
 * (and never throws) when realtime isn't initialised or the user is offline -
 * callers use this as a best-effort side channel on top of the DB write.
 */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  try {
    io.to(roomForUser(userId)).emit(event, payload);
  } catch {
    /* best-effort - a realtime failure must never break the request path */
  }
}

/** Fan an event out to every connected admin (the shared "admins" room). */
export function emitToAdmins(event: string, payload: unknown): void {
  if (!io) return;
  try {
    io.to('admins').emit(event, payload);
  } catch {
    /* best-effort */
  }
}

/** True while the user has at least one live socket (any tab/device). */
export function isUserOnline(userId: string): boolean {
  return (socketCounts.get(userId) ?? 0) > 0;
}

/** Snapshot of every user id with a live connection right now. */
export function onlineUserIds(): string[] {
  return Array.from(socketCounts.keys());
}

/** The live Socket.IO server, or null before init (used by tests/other modules). */
export function getIo(): SocketIOServer | null {
  return io;
}
