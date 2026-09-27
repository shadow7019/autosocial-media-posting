/**
 * Singleton socket.io connection for AutoSocial realtime events.
 *
 * Connection string: io("/?XTransformPort=3003")
 *   - Per the Caddy gateway rules, we MUST route through the gateway by
 *     using a relative URL with the target port in the `XTransformPort`
 *     query param. NEVER use `http://localhost:3003` directly.
 *
 * The hook returns `{ socket, connected }`. The socket is created lazily on
 * first call and shared across all callers (module-level singleton). If the
 * mini-service is not running, the socket will keep trying to reconnect and
 * `connected` stays false; the app keeps working via HTTP polling.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

let socketRef: Socket | null = null;

function getSocket(): Socket {
  if (socketRef) return socketRef;
  socketRef = io("/?XTransformPort=3003", {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_500,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
    autoConnect: true,
  });
  return socketRef;
}

export function useSocket() {
  // Initialise from the current socket connection state synchronously so we
  // don't trigger a setState-in-effect cascading render. The socket listeners
  // below keep this value up to date over time.
  const [connected, setConnected] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return getSocket().connected;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const s = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: typeof window !== "undefined" ? getSocket() : null, connected };
}

/**
 * Subscribe a callback to a single socket event for the lifetime of the
 * calling component. Safe to use during SSR because it no-ops when window
 * is undefined. The latest handler is kept in a ref (updated inside an
 * effect) so callers can pass inline lambdas without triggering
 * re-subscriptions.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = getSocket();
    const wrapped = (payload: T) => handlerRef.current(payload);
    s.on(event, wrapped);
    return () => {
      s.off(event, wrapped);
    };
  }, [event]);
}

/** Exposed for the app shell to wire up global invalidations. */
export function getSocketRef(): Socket | null {
  if (typeof window === "undefined") return null;
  return getSocket();
}
