import { useCallback, useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../../shared/types';
import { sendCommand } from './api';
import { useToast } from '../components/ui';

export type RoomStatus = 'connecting' | 'live' | 'offline' | 'missing' | 'blocked' | 'deleted';

export interface Room {
  snap: Snapshot | null;
  status: RoomStatus;
  /** The server's clock, so a wheel spun on one machine stops at the same moment everywhere. */
  serverNow: () => number;
  /** Runs a command; shows the error as a toast and resolves to undefined when it fails. */
  act: (action: string, params?: unknown) => Promise<any>;
}

const POLL_MS = 3000;

/**
 * Live connection to one auction.
 *
 * Uses a WebSocket (not limited by the browser's ~6-connections-per-site cap, so any number of tabs
 * can be open). If the socket can't be opened or drops, it reconnects with a short back-off and,
 * meanwhile, polls the state so the screen keeps working even where WebSockets are blocked.
 */
export function useRoom(code: string, key: string | null): Room {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const offset = useRef(0);
  const current = useRef<Snapshot | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    let gone = false; // the auction does not exist: stop trying
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let lastNow = 0;

    const apply = (next: Snapshot) => {
      // never let an older snapshot (e.g. a slow poll) overwrite a newer pushed one
      if (next.now < lastNow) return;
      lastNow = next.now;
      offset.current = next.now - Date.now();
      current.current = next;
      setSnap(next);
      setStatus('live');
    };

    const stopPolling = () => {
      clearInterval(pollTimer);
      pollTimer = undefined;
    };
    const startPolling = () => {
      if (cancelled || gone || pollTimer) return;
      pollTimer = setInterval(() => void poll(), POLL_MS);
    };

    /** Fetches the state over HTTP. Resolves to true when the auction does not exist. */
    const poll = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(code)}/state${key ? `?key=${encodeURIComponent(key)}` : ''}`, { cache: 'no-store' });
        if (cancelled) return false;
        if (res.status === 404) {
          gone = true;
          setStatus('missing');
          stopPolling();
          clearTimeout(retryTimer);
          ws?.close();
          return true;
        }
        if (res.status === 429) {
          // too many wrong keys from this connection: say so, and keep retrying until the minute passes
          setStatus('blocked');
          startPolling();
        } else if (res.ok) apply((await res.json()) as Snapshot);
      } catch {
        if (!cancelled) setStatus((s) => (s === 'live' ? 'offline' : s));
      }
      return false;
    };

    const connect = () => {
      if (cancelled || gone) return;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${location.host}/api/events/${encodeURIComponent(code)}/ws${key ? `?key=${encodeURIComponent(key)}` : ''}`;
      let opened = false;
      try {
        ws = new WebSocket(url);
      } catch {
        // WebSockets unavailable (blocked network / old browser): keep the screen alive by polling
        startPolling();
        scheduleRetry();
        return;
      }
      ws.onopen = () => {
        opened = true;
        retry = 0;
        lastNow = 0; // trust the new connection even if the server's clock moved
        stopPolling();
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg?.deleted) {
            // the admin deleted this auction: stop for good, don't reconnect
            gone = true;
            setStatus('deleted');
            stopPolling();
            clearTimeout(retryTimer);
            ws?.close();
            return;
          }
          if (msg?.delta) {
            // a partial update: only the parts that changed — lay them over what we already have
            if (!current.current) return;
            const { delta: _d, ...parts } = msg;
            apply({ ...current.current, ...parts } as Snapshot);
            return;
          }
          apply(msg as Snapshot);
        } catch {
          /* ignore a malformed frame */
        }
      };
      ws.onclose = () => {
        if (cancelled || gone) return;
        setStatus((s) => (s === 'missing' || s === 'blocked' || s === 'deleted' ? s : opened ? 'offline' : s));
        void poll(); // an immediate refresh (also detects "auction not found")
        startPolling();
        scheduleRetry();
      };
      ws.onerror = () => ws?.close();
    };

    const scheduleRetry = () => {
      if (cancelled || gone) return;
      retry += 1;
      retryTimer = setTimeout(connect, Math.min(5000, 500 * retry));
    };

    setStatus('connecting');
    // First paint over plain HTTP (also tells us right away if the auction doesn't exist), then go live.
    void poll().then((missing) => {
      if (!cancelled && !missing) connect();
    });
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      stopPolling();
      ws?.close();
    };
  }, [code, key]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  const act = useCallback(
    async (action: string, params: unknown = {}) => {
      try {
        return (await sendCommand(code, key, action, params)) ?? true;
      } catch (err) {
        toast((err as Error).message, 'error');
        return undefined;
      }
    },
    [code, key, toast],
  );

  return { snap, status, serverNow, act };
}
