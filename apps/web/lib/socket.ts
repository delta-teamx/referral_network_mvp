'use client';

import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl } from './api';

/**
 * Single shared Socket.IO connection for the whole app.
 *
 * One socket is multiplexed across every feature that needs realtime (the
 * notification bell, the messenger, presence). Components subscribe to named
 * events through `onSocketEvent` and never touch the raw socket, so we keep a
 * single connection open no matter how many listeners mount.
 *
 * A local listener registry makes subscription order-independent: handlers
 * registered before the socket connects (or across reconnects) are
 * re-attached automatically whenever a fresh socket comes up. Components can
 * therefore call `onSocketEvent` in any effect without racing the connection.
 *
 * The access token rotates (~15 min). `connectSocket(token)` is safe to call
 * on every token change: if the socket already exists we just refresh its auth
 * and reconnect, rather than tearing down every listener.
 */

let socket: Socket | null = null;
let currentToken: string | null = null;

/** event name -> set of handlers. Survives socket teardown/reconnect. */
const listeners = new Map<string, Set<(payload: unknown) => void>>();

/** Attach every registered handler to a freshly-created socket. */
function attachAll(s: Socket): void {
  for (const [event, handlers] of listeners) {
    for (const h of handlers) s.on(event, h);
  }
}

/** Connect (or refresh auth on) the shared socket for the given access token. */
export function connectSocket(token: string): Socket | null {
  const base = apiBaseUrl();
  // No API origin configured (preview build) => realtime is simply disabled;
  // the app still works on its polling fallbacks.
  if (!base) return null;

  if (socket) {
    if (currentToken !== token) {
      currentToken = token;
      socket.auth = { token };
      // Bounce the connection so the handshake re-runs with the new token.
      if (socket.connected) socket.disconnect();
      socket.connect();
    } else if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  currentToken = token;
  socket = io(base, {
    auth: { token },
    // Prefer WebSocket; fall back to polling behind restrictive proxies.
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    autoConnect: true,
  });
  attachAll(socket);
  return socket;
}

/** Tear the socket down (call on logout). Keeps the listener registry intact
 *  so a later re-login re-attaches the same handlers. */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

/** The live socket, or null before connect. */
export function getSocket(): Socket | null {
  return socket;
}

/** True while the socket is connected. */
export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

/**
 * Subscribe to a server event. Returns an unsubscribe function - always call
 * it from a React effect cleanup so listeners don't stack across remounts.
 * Safe to call before the socket connects: the handler is registered and
 * attached as soon as a socket exists (and re-attached on every reconnect).
 */
export function onSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): () => void {
  const h = handler as (payload: unknown) => void;
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(h);
  socket?.on(event, h);
  return () => {
    set?.delete(h);
    socket?.off(event, h);
  };
}

/** Emit an event to the server (best-effort; dropped if not connected). */
export function emitSocket(event: string, payload?: unknown): void {
  socket?.emit(event, payload);
}
