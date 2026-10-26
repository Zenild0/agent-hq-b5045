import { ARP_DAYS, OPEN_HOUR_IST, IST_OFFSET_MIN } from './constants.js';
import { addDays, fromISO } from './dates.js';

/** The instant booking opens for a journey date: 08:00 IST, ARP_DAYS before. */
export function openingInstant(journeyISO, { arpDays = ARP_DAYS, openHour = OPEN_HOUR_IST } = {}) {
  const j = fromISO(journeyISO);
  if (!j) throw new Error(`Bad journey date: ${journeyISO}`);
  const o = addDays(j, -arpDays);
  return new Date(Date.UTC(o.y, o.m - 1, o.d, openHour, 0, 0) - IST_OFFSET_MIN * 60000);
}

export function formatIST(date) {
  return new Date(date.getTime() + IST_OFFSET_MIN * 60000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' IST');
}

/**
 * Sleep until `target`. Re-reads the clock every wake-up, so a laptop that slept
 * or a throttled timer cannot make us late; the last 250 ms are polled finely.
 */
export async function waitUntil(target, { signal, onTick, now = Date.now, sleep = defaultSleep } = {}) {
  const t = target.getTime();
  let lastTick = 0;
  for (;;) {
    if (signal?.aborted) throw new Error('Cancelled');
    const left = t - now();
    if (left <= 0) return;
    if (onTick && now() - lastTick >= 1000) {
      lastTick = now();
      onTick(left);
    }
    await sleep(left > 5000 ? 1000 : left > 250 ? Math.min(left - 200, 100) : 5, signal);
  }
}

const defaultSleep = (ms, signal) =>
  new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(id), resolve()), { once: true });
  });

/** Best-effort clock check against Cloudflare's trace endpoint. Returns ms (local - true) or null. */
export async function measureClockSkew(fetchImpl = fetch) {
  try {
    const t0 = Date.now();
    const res = await fetchImpl('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(4000) });
    const t1 = Date.now();
    const m = /^ts=([\d.]+)$/m.exec(await res.text());
    if (!m) return null;
    return Math.round((t0 + t1) / 2 - parseFloat(m[1]) * 1000);
  } catch {
    return null;
  }
}
