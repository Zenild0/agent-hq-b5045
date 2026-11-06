import { useEffect, useState } from 'react';

/** Milliseconds left until `endsAt` (on the server's clock), refreshed four times a second. */
export function useCountdown(endsAt: number | null, serverNow: () => number): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === null ? 0 : Math.max(0, endsAt - serverNow());
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDuration(seconds: number): string {
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  if (seconds < 60) return `${seconds} seconds`;
  return `${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`;
}
