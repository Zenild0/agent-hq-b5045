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

export async function sendCommand(code: string, key: string | null, action: string, params: unknown = {}) {
  const res = await fetch(`/api/events/${code}/cmd`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-key': key } : {}) },
    body: JSON.stringify({ action, params }),
  });
  const body = await parse<{ ok: true; result: any }>(res);
  return body.result;
}

export async function uploadImage(code: string, key: string, blob: Blob): Promise<string> {
  const res = await fetch(`/api/events/${code}/upload`, {
    method: 'POST',
    headers: { 'content-type': blob.type || 'image/jpeg', 'x-key': key },
    body: blob,
  });
  return (await parse<{ url: string }>(res)).url;
}
