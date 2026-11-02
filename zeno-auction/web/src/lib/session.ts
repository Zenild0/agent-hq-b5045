import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const EVENTS_KEY = 'zeno:events';

export interface SavedEvent {
  code: string;
  name: string;
  role: 'admin' | 'host' | 'captain';
  key: string;
  at: number;
}

export function savedEvents(): SavedEvent[] {
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveEvent(ev: SavedEvent) {
  const rest = savedEvents().filter((e) => !(e.code === ev.code && e.role === ev.role));
  localStorage.setItem(EVENTS_KEY, JSON.stringify([ev, ...rest].slice(0, 20)));
}

export function forgetEvent(code: string, role: string) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(savedEvents().filter((e) => !(e.code === code && e.role === role))));
}

/**
 * Each role page lives at a different URL, so keys are stored per page ("admin", "host", "captain").
 * A key in the URL (?k=…) wins and is remembered for next time.
 */
export function usePageKey(code: string, page: 'admin' | 'host' | 'captain'): string | null {
  const [params] = useSearchParams();
  const storeKey = `zeno:key:${code}:${page}`;
  const fromUrl = params.get('k');
  const [key, setKey] = useState<string | null>(() => fromUrl ?? localStorage.getItem(storeKey));
  useEffect(() => {
    if (fromUrl) {
      localStorage.setItem(storeKey, fromUrl);
      setKey(fromUrl);
    }
  }, [fromUrl, storeKey]);
  return key;
}
