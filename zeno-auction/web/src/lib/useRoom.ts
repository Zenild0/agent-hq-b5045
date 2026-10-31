import { useCallback, useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../../shared/types';
import { sendCommand } from './api';
import { useToast } from '../components/ui';

export type RoomStatus = 'connecting' | 'live' | 'offline' | 'missing';

export interface Room {
  snap: Snapshot | null;
  status: RoomStatus;
  /** The server's clock, so a wheel spun on one machine stops at the same moment everywhere. */
  serverNow: () => number;
  /** Runs a command; shows the error as a toast and resolves to undefined when it fails. */
  act: (action: string, params?: unknown) => Promise<any>;
}

export function useRoom(code: string, key: string | null): Room {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const offset = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    setStatus('connecting');
    const url = `/api/events/${encodeURIComponent(code)}/stream${key ? `?key=${encodeURIComponent(key)}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      const next = JSON.parse(e.data) as Snapshot;
      offset.current = next.now - Date.now();
      setSnap(next);
      setStatus('live');
    };
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? 'missing' : 'offline');
    return () => es.close();
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
