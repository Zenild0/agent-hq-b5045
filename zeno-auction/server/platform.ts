// The "platform" side of ZenoBid: who the developer is, and what it costs to take an auction live.
//
// Everything here is OFF unless DEV_KEY is set in /etc/zenobid.env (a secret the developer writes there
// themselves — it is never in the code or on GitHub). Without it, every auction is free and there is no
// developer page. With it, the developer can set a UPI id and price, approve payments, and grant free access.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AuctionError, type Store } from './engine';
import { DATA_DIR } from './persist';

export interface PlatformConfig {
  upiId: string; // e.g. name@okaxis
  payeeName: string; // shown in the payer's UPI app
  price: number; // rupees per auction to go live; 0 = free for everyone
  note: string; // a short line shown with the payment instructions
  operatorName: string; // shown on the Terms page
  contact: string; // email / phone shown on the Terms page
}

const FILE = path.join(DATA_DIR, 'platform.json');
export const DEV_KEY = process.env.DEV_KEY ?? '';
/** The developer page and payments exist only when a long enough DEV_KEY is configured. */
export const devEnabled = () => DEV_KEY.length >= 12;

const EMPTY: PlatformConfig = { upiId: '', payeeName: '', price: 0, note: '', operatorName: '', contact: '' };
let cache: PlatformConfig | null = null;

export function getPlatform(): PlatformConfig {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...(existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}) };
  } catch {
    cache = { ...EMPTY };
  }
  return cache!;
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().replace(/[\r\n]+/g, ' ').slice(0, max) : '');
const UPI_ID = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}$/;

/** Validates and saves new settings (throws AuctionError for a bad UPI id or price). */
export function savePlatform(input: unknown): PlatformConfig {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const price = Number(p.price);
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) throw new AuctionError('The price must be a whole number of rupees, 0 or more.');
  const upiId = text(p.upiId, 80);
  if (price > 0 && !UPI_ID.test(upiId)) throw new AuctionError('Enter a valid UPI id like yourname@bank, or set the price to 0 to make everything free.');
  const next: PlatformConfig = {
    upiId,
    payeeName: text(p.payeeName, 60),
    price,
    note: text(p.note, 160),
    operatorName: text(p.operatorName, 80),
    contact: text(p.contact, 120),
  };
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2));
  renameSync(tmp, FILE);
  cache = next;
  return next;
}

/** Does a NEW auction need paying for before it can go live? */
export function currentGate(): { required: boolean; price: number } {
  const c = getPlatform();
  return { required: devEnabled() && c.price > 0 && UPI_ID.test(c.upiId), price: c.price };
}

/** Compares a presented developer key without leaking how much of it was right. */
export function isDevKey(key: unknown): boolean {
  if (!devEnabled() || typeof key !== 'string' || !key) return false;
  const a = createHash('sha256').update(key).digest();
  const b = createHash('sha256').update(DEV_KEY).digest();
  return timingSafeEqual(a, b);
}

/** Keeps an auction's status in step with the settings: if payments are switched off or free, waiting ones open up. */
export function refreshAccess(store: Store): void {
  const a = store.access;
  if ((a.status === 'locked' || a.status === 'pending') && !currentGate().required) {
    a.status = 'free';
    a.decidedAt = Date.now();
  }
}

// --- carrying an unlock across "Restore from file": a signed claim, so the file cannot simply be edited ---

export const unlockProof = (code: string, by: string): string => (devEnabled() ? createHmac('sha256', DEV_KEY).update(`zenobid-unlock:${code}:${by}`).digest('hex') : '');
export function verifyUnlockProof(code: string, by: string, proof: unknown): boolean {
  if (!devEnabled() || typeof proof !== 'string' || proof.length !== 64) return false;
  const want = Buffer.from(unlockProof(code, by), 'hex');
  const got = Buffer.from(proof, 'hex');
  return want.length === got.length && timingSafeEqual(want, got);
}
