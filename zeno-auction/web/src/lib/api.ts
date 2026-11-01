import type { EventSettings } from '../../../shared/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error ?? 'Something went wrong', res.status);
  return body as T;
}

export async function createEvent(settings: Partial<EventSettings>) {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  return parse<{ code: string; adminKey: string; hostKey: string }>(res);
}

export async function lookupEvent(code: string) {
  const res = await fetch(`/api/events/${encodeURIComponent(code.trim().toUpperCase())}/exists`);
  return parse<{ code: string; name: string; sport: string }>(res);
}

const COMMAND_TIMEOUT_MS = 10_000;

export async function sendCommand(code: string, key: string | null, action: string, params: unknown = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), COMMAND_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/events/${code}/cmd`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { 'x-key': key } : {}) },
      body: JSON.stringify({ action, params }),
      signal: ctl.signal,
    });
    const body = await parse<{ ok: true; result: any }>(res);
    return body.result;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // timeout or no network: say so instead of leaving a button stuck
    throw new ApiError(ctl.signal.aborted ? 'The server is taking too long to answer — please try again.' : 'Could not reach the server — check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadImage(code: string, key: string, blob: Blob): Promise<string> {
  const res = await fetch(`/api/events/${code}/upload`, {
    method: 'POST',
    headers: { 'content-type': blob.type || 'image/jpeg', 'x-key': key },
    body: blob,
  });
  return (await parse<{ url: string }>(res)).url;
}

/** Permanently deletes an auction (admin only). */
export async function deleteEvent(code: string, key: string) {
  const res = await fetch(`/api/events/${encodeURIComponent(code)}`, { method: 'DELETE', headers: { 'x-key': key } });
  await parse<{ ok: true }>(res);
}

/** The whole auction as one file (admin only). */
export async function exportEvent(code: string, key: string): Promise<unknown> {
  const res = await fetch(`/api/events/${encodeURIComponent(code)}/export`, { headers: { 'x-key': key }, cache: 'no-store' });
  return parse<unknown>(res);
}

/** Creates a brand-new auction from a saved auction file. */
export async function restoreEvent(file: unknown) {
  const res = await fetch('/api/events/restore', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(file),
  });
  return parse<{ code: string; name: string; adminKey: string; hostKey: string; players: number; teams: number }>(res);
}
