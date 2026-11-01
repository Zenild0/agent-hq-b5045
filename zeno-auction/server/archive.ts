// The "whole auction file": everything about one auction in a single downloadable file, and the
// reverse — turning such a file back into a live auction.
//
// The file is plain JSON so it can be opened in any text editor. Photos are included (as data
// URLs) so a restored auction looks exactly like the original.

import { randomBytes } from 'node:crypto';
import { AuctionError, DEFAULT_SETTINGS, MAX_CAPTAINS, MAX_PLAYERS, createStore, mergeSettings, randomCode, type Store } from './engine';
import { LIMITS } from '../shared/limits';
import type { Captain, LogItem, Player, StrategyItem } from '../shared/types';

export const ARCHIVE_FORMAT = 'zenobid-auction';
export const ARCHIVE_VERSION = 1;
export const MAX_PHOTO_BYTES = LIMITS.photoBytes;
export const MAX_PHOTOS = LIMITS.photos;

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export interface Archive {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  exportedAt: number;
  note: string;
  auction: {
    settings: Store['data']['settings'];
    round: number;
    captains: Captain[];
    players: Player[];
    log: LogItem[];
    /** Captain PINs, so the PINs people already have keep working after a restore. */
    captainPins: Record<string, string>;
    strategies: Store['strategies'];
  };
  /** photo file name → data URL */
  photos: Record<string, string>;
}

/** Reads one uploaded photo by file name (supplied by the caller so this module stays free of disk access). */
export type PhotoReader = (fileName: string) => Buffer | null;

const uploadName = (url: string, code: string): string | null => {
  const m = new RegExp(`^/uploads/${code}/([A-Za-z0-9]+\\.(?:jpg|png|webp))$`).exec(url);
  return m ? m[1] : null;
};

/** Builds the file for one auction. While a practice run is on, the *real* auction (parked) is exported. */
export function buildArchive(store: Store, readPhoto: PhotoReader, now = Date.now()): Archive {
  const d = store.data;
  const real = store.stash;
  const players: Player[] = JSON.parse(JSON.stringify(real ? real.players : d.players));
  const captains: Captain[] = JSON.parse(JSON.stringify(d.captains));
  if (real) for (const c of captains) if (typeof real.budgets[c.id] === 'number') c.budget = real.budgets[c.id];
  const log: LogItem[] = JSON.parse(JSON.stringify(real ? real.log : d.log));

  const photos: Record<string, string> = {};
  const grab = (url: string) => {
    const name = uploadName(url, d.code);
    if (!name || photos[name] || Object.keys(photos).length >= MAX_PHOTOS) return;
    const buf = readPhoto(name);
    if (buf && buf.length <= MAX_PHOTO_BYTES) photos[name] = `data:${MIME_BY_EXT[name.split('.')[1]]};base64,${buf.toString('base64')}`;
  };
  for (const p of players) grab(p.photo);
  for (const c of captains) grab(c.logo);

  // Photos are stored under the *old* code; rewrite to a neutral prefix so the file stands alone.
  const neutral = (url: string) => {
    const name = uploadName(url, d.code);
    return name && photos[name] ? `photo:${name}` : /^https?:\/\//.test(url) ? url : '';
  };
  for (const p of players) p.photo = neutral(p.photo);
  for (const c of captains) c.logo = neutral(c.logo);

  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: now,
    note: 'ZenoBid auction file. Keep it safe: it contains team PINs. Restore it from the "Restore from file" button when creating an auction.',
    auction: {
      settings: d.settings,
      round: real ? real.round : d.round,
      captains,
      players,
      log,
      captainPins: { ...store.secrets.captainTokens },
      strategies: JSON.parse(JSON.stringify(store.strategies)),
    },
    photos,
  };
}

// ---- reading a file back --------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const whole = (v: unknown, fallback = 0, min = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= min && n <= Number.MAX_SAFE_INTEGER ? Math.round(n) : fallback;
};
const COLOR = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const PIN = /^[A-Z0-9]{6}$/;

export interface Restored {
  store: Store;
  /** new file name → image bytes, to be written into the new auction's photo folder */
  photos: Map<string, Buffer>;
}

/**
 * Turns an uploaded file into a brand-new auction (new code, new admin/host keys). Anything that
 * does not look right is dropped or fixed rather than trusted. Throws AuctionError(400) for a file
 * that is not a ZenoBid auction file at all.
 */
export function restoreArchive(file: unknown, code: string, now = Date.now()): Restored {
  if (!isObj(file) || file.format !== ARCHIVE_FORMAT || !isObj(file.auction)) {
    throw new AuctionError('That does not look like a ZenoBid auction file.');
  }
  if (typeof file.version !== 'number' || file.version > ARCHIVE_VERSION) {
    throw new AuctionError('That file was made by a newer version of ZenoBid — update the app first.');
  }
  const a = file.auction;
  const store = createStore(code, a.settings ?? {}, now);
  const d = store.data;
  d.settings = mergeSettings(DEFAULT_SETTINGS, a.settings);

  // photos: decode, check type and size, store under fresh random names
  const photos = new Map<string, Buffer>();
  const renamed = new Map<string, string>(); // "photo:<old>" → new url
  if (isObj(file.photos)) {
    for (const [oldName, url] of Object.entries(file.photos)) {
      if (photos.size >= MAX_PHOTOS || typeof url !== 'string') break;
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
      if (!m) continue;
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) continue;
      const fresh = `${randomBytes(6).toString('hex')}.${EXT_BY_MIME[m[1]]}`;
      photos.set(fresh, buf);
      renamed.set(`photo:${oldName}`, `/uploads/${code}/${fresh}`);
    }
  }
  const pic = (v: unknown): string => {
    const s = text(v, 300);
    return renamed.get(s) ?? (/^https?:\/\//.test(s) ? s : '');
  };

  // teams
  const rawCaptains = Array.isArray(a.captains) ? a.captains : [];
  const seen = new Set<string>();
  const pins = isObj(a.captainPins) ? a.captainPins : {};
  const usedPins = new Set<string>();
  for (const rc of rawCaptains.slice(0, MAX_CAPTAINS)) {
    if (!isObj(rc) || !ID.test(String(rc.id)) || seen.has(rc.id)) continue;
    const team = text(rc.team, 60);
    if (!team) continue;
    seen.add(rc.id);
    const c: Captain = {
      id: rc.id,
      team,
      name: text(rc.name, 60),
      color: typeof rc.color === 'string' && COLOR.test(rc.color) ? rc.color : '#4d8bff',
      logo: pic(rc.logo),
      budget: whole(rc.budget, d.settings.defaultBudget),
    };
    d.captains.push(c);
    let pin = typeof pins[c.id] === 'string' ? pins[c.id].toUpperCase() : '';
    if (!PIN.test(pin) || usedPins.has(pin)) {
      pin = randomCode(6);
      while (usedPins.has(pin)) pin = randomCode(6);
    }
    usedPins.add(pin);
    store.secrets.captainTokens[c.id] = pin;
  }

  // players
  const rawPlayers = Array.isArray(a.players) ? a.players : [];
  const playerIds = new Set<string>();
  d.round = Math.max(1, whole(a.round, 1, 1));
  for (const rp of rawPlayers.slice(0, MAX_PLAYERS)) {
    if (!isObj(rp) || !ID.test(String(rp.id)) || playerIds.has(rp.id)) continue;
    const name = text(rp.name, 80);
    if (!name) continue;
    playerIds.add(rp.id);
    let status: Player['status'] = rp.status === 'sold' || rp.status === 'unsold' ? rp.status : 'available';
    // a sale only makes sense with a team that exists
    const teamId = status === 'sold' && typeof rp.teamId === 'string' && seen.has(rp.teamId) ? rp.teamId : null;
    if (status === 'sold' && !teamId) status = 'available';
    const p: Player = {
      id: rp.id,
      name,
      role: text(rp.role, 60),
      description: text(rp.description, 400),
      photo: pic(rp.photo),
      basePrice: whole(rp.basePrice, 0),
      status,
      teamId,
      price: status === 'sold' ? whole(rp.price, 0) : 0,
      soldRound: status === 'sold' ? Math.max(1, whole(rp.soldRound, 1, 1)) : 0,
      order: d.players.length,
    };
    if (status === 'sold' && Number.isFinite(rp.soldAt)) p.soldAt = whole(rp.soldAt, now);
    d.players.push(p);
  }
  // keep the original order the file had
  d.players.forEach((p, i) => (p.order = i));

  // history
  const rawLog = Array.isArray(a.log) ? a.log : [];
  const log: LogItem[] = [];
  for (const l of rawLog.slice(-300)) if (isObj(l) && typeof l.text === 'string') log.push({ at: whole(l.at, now), text: l.text.slice(0, 300) });
  d.log = [...log, { at: now, text: `Auction restored from a saved file (${d.players.length} players, ${d.captains.length} teams)` }];

  // captains' private plans
  if (isObj(a.strategies)) {
    for (const [cid, items] of Object.entries(a.strategies)) {
      if (!seen.has(cid) || !Array.isArray(items)) continue;
      const clean: StrategyItem[] = [];
      for (const it of items.slice(0, MAX_PLAYERS)) {
        if (isObj(it) && playerIds.has(it.playerId)) clean.push({ playerId: it.playerId, budget: whole(it.budget, 0), note: text(it.note, 300) });
      }
      store.strategies[cid] = clean;
    }
  }
  return { store, photos };
}
