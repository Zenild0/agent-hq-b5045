import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeStore, type Store } from './engine';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? './data');
const EVENTS_DIR = path.join(DATA_DIR, 'events');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

mkdirSync(EVENTS_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });

export function loadAll(): Map<string, Store> {
  const out = new Map<string, Store>();
  for (const file of readdirSync(EVENTS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const store = JSON.parse(readFileSync(path.join(EVENTS_DIR, file), 'utf8')) as Store;
      out.set(store.data.code, normalizeStore(store));
    } catch (err) {
      console.error(`Could not load ${file}:`, err);
    }
  }
  return out;
}

const timers = new Map<string, NodeJS.Timeout>();

/** Debounced atomic write: a burst of bids becomes one disk write. */
export function saveSoon(store: Store): void {
  const code = store.data.code;
  if (timers.has(code)) return;
  timers.set(
    code,
    setTimeout(() => {
      timers.delete(code);
      saveNow(store);
    }, 250),
  );
}

export function saveNow(store: Store): void {
  const file = path.join(EVENTS_DIR, `${store.data.code}.json`);
  const tmp = `${file}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, file);
  } catch (err) {
    // e.g. disk full: keep the auction running from memory and try again on the next change
    console.error(`Could not save auction ${store.data.code}:`, err);
  }
}

export function flushAll(stores: Iterable<Store>): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const s of stores) saveNow(s);
}

export const hasUploads = () => existsSync(UPLOADS_DIR);
