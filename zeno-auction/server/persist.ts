import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStore, type Store } from './engine';

// Default: the project's own `data` folder — NOT relative to wherever the command was started from,
// so starting the app from a different folder can never silently open an empty set of auctions.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(PROJECT_ROOT, 'data'));
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

/**
 * Atomic write, coalesced within the same tick. It used to wait 250 ms to batch bursts, but that
 * meant a bid made just before the app was stopped or restarted could be lost (Windows does not
 * run shutdown handlers when a dev server restarts). An auction file is small, so write right away.
 */
export function saveSoon(store: Store): void {
  const code = store.data.code;
  if (timers.has(code)) return;
  timers.set(
    code,
    setTimeout(() => {
      timers.delete(code);
      saveNow(store);
    }, 0),
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

const SAFETY_DIR = path.join(DATA_DIR, 'safety');
/**
 * A full copy of one auction taken just before something that overwrites a lot (replacing the player list from a file).
 * Kept in DATA_DIR/safety (so the nightly backup includes it); the newest few per auction are kept.
 */
let safetySeq = 0;
export function saveSafetyCopy(store: Store, keep = 5): string {
  mkdirSync(SAFETY_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:.]/g, ''); // to the millisecond, so two copies never share a name
  const file = path.join(SAFETY_DIR, `${store.data.code}-${stamp}-${String(safetySeq++ % 10000).padStart(4, '0')}.json`);
  writeFileSync(file, JSON.stringify(store));
  const mine = readdirSync(SAFETY_DIR).filter((f) => f.startsWith(`${store.data.code}-`)).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - keep))) rmSync(path.join(SAFETY_DIR, old), { force: true });
  return file;
}

/** Permanently removes one auction from disk: its file, any half-written copy, and its photos. */
export function deleteEventFiles(code: string): void {
  clearTimeout(timers.get(code)); // a save that was about to happen must not bring the file back
  timers.delete(code);
  const file = path.join(EVENTS_DIR, `${code}.json`);
  rmSync(file, { force: true });
  rmSync(`${file}.tmp`, { force: true });
  rmSync(path.join(UPLOADS_DIR, code), { recursive: true, force: true });
  if (existsSync(SAFETY_DIR)) for (const f of readdirSync(SAFETY_DIR)) if (f.startsWith(`${code}-`)) rmSync(path.join(SAFETY_DIR, f), { force: true });
}

/** One uploaded photo, or null if it is not there. `fileName` must already be validated (letters/digits + extension). */
export function readUpload(code: string, fileName: string): Buffer | null {
  try {
    return readFileSync(path.join(UPLOADS_DIR, code, fileName));
  } catch {
    return null;
  }
}

export function writeUploads(code: string, files: Map<string, Buffer>): void {
  if (files.size === 0) return;
  const dir = path.join(UPLOADS_DIR, code);
  mkdirSync(dir, { recursive: true });
  for (const [name, buf] of files) writeFileSync(path.join(dir, name), buf);
}
