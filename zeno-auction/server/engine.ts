import { randomBytes, randomInt } from 'node:crypto';
import { formatMoney, type MoneyFmt } from '../shared/money';
import { LIMITS } from '../shared/limits';
import { themeIds } from '../shared/themes';
import { checkBid, effectiveBase, maxBid, nextBidAmount, sortedTiers, teamStats } from '../shared/rules';
import type {
  Captain,
  UnlockStatus,
  EventData,
  LiveState,
  LogItem,
  EventSettings,
  LiveEventType,
  Me,
  Player,
  Secrets,
  StrategyItem,
} from '../shared/types';

export class AuctionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** The real auction, parked while a practice run uses the same players and teams. */
export interface Stash {
  players: Player[];
  budgets: Record<string, number>;
  round: number;
  live: LiveState;
  log: LogItem[];
}

/** Server-side record of whether this auction may go live (see platform.ts for who decides). */
export interface UnlockAccess {
  status: UnlockStatus;
  price: number;
  by: '' | 'payment' | 'grant';
  ref: string; // the UPI reference the admin entered
  payer: string;
  requestedAt: number;
  decidedAt: number;
}
export const freeAccess = (): UnlockAccess => ({ status: 'free', price: 0, by: '', ref: '', payer: '', requestedAt: 0, decidedAt: 0 });
export const isOpen = (a: UnlockAccess) => a.status === 'free' || a.status === 'unlocked';

export interface Store {
  data: EventData;
  /** Whether going live is allowed. Missing on auctions saved before payments existed (those are free). */
  access: UnlockAccess;
  secrets: Secrets;
  /** Captains' private plans, keyed by captain id. Never part of the shared state. */
  strategies: Record<string, StrategyItem[]>;
  stash: Stash | null;
}

/** Fills in fields that auctions saved by an older version don't have. */
export function normalizeStore(store: Store): Store {
  store.strategies ??= {};
  store.stash ??= null;
  store.access ??= freeAccess();
  store.data.practice ??= false;
  store.data.live.break ??= null;
  store.data.live.squadSort ??= 'price';
  const st = store.data.settings;
  st.theme ??= DEFAULT_SETTINGS.theme;
  st.mode ??= 'dark';
  st.brand ??= { ...DEFAULT_SETTINGS.brand };
  return store;
}

export const SPIN_MS = 7000; // 5.2 s of spinning + 1.8 s of the winner's name flashing
export const MAX_PLAYERS = LIMITS.players;
export const MAX_CAPTAINS = LIMITS.teams;
const WHEEL_SLICES = 24;

const COLORS = ['#ff3d81', '#29e0ff', '#ffc933', '#7cf29a', '#b388ff', '#ff8a3d', '#4d8bff', '#f25cf0'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

const uid = () => randomBytes(4).toString('hex');
const secretKey = () => randomBytes(12).toString('base64url');

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

export const DEFAULT_SETTINGS: EventSettings = {
  theme: 'midnight-gold',
  mode: 'dark',
  brand: { logo: '', eventLogo: '', eventLogoStyle: 'side', color: '#2f6bff' },
  name: 'Office Premier League',
  sport: 'Cricket',
  tagline: 'The Zeno team auction',
  accent: '#ffc933',
  symbol: '₹',
  moneyStyle: 'indian',
  defaultBudget: 120_000_000, // 12 Cr
  defaultBasePrice: 2_000_000, // 20 L
  increments: [
    { from: 0, step: 500_000 }, // +5 L
    { from: 10_000_000, step: 1_000_000 }, // +10 L once the bid reaches 1 Cr
  ],
  display: { showPhoto: true, showDescription: true, showRole: true, showBasePrice: true },
  drawMode: 'random',
  minSquad: 0,
  maxSquad: 0,
  reserveRule: false,
  totalRounds: 2,
};

const str = (v: unknown, fallback: string, max = 120): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : fallback;
const num = (v: unknown, fallback: number, min = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= min ? Math.round(n) : fallback;
};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Merge a partial patch into settings, discarding anything invalid. */
export function mergeSettings(base: EventSettings, patch: unknown): EventSettings {
  const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>;
  const next: EventSettings = { ...base, display: { ...base.display }, brand: { ...base.brand } };

  next.name = str(p.name, base.name, 80) || base.name;
  next.sport = str(p.sport, base.sport, 40) || base.sport;
  next.tagline = str(p.tagline, base.tagline, 140);
  if (typeof p.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.accent)) next.accent = p.accent;
  next.symbol = str(p.symbol, base.symbol, 5);
  if (p.moneyStyle === 'indian' || p.moneyStyle === 'western') next.moneyStyle = p.moneyStyle;
  next.defaultBudget = num(p.defaultBudget, base.defaultBudget, 1);
  next.defaultBasePrice = num(p.defaultBasePrice, base.defaultBasePrice, 1);
  if (p.drawMode === 'random' || p.drawMode === 'sequential' || p.drawMode === 'manual') next.drawMode = p.drawMode;
  next.minSquad = num(p.minSquad, base.minSquad, 0);
  next.maxSquad = num(p.maxSquad, base.maxSquad, 0);
  next.reserveRule = bool(p.reserveRule, base.reserveRule);
  next.totalRounds = Math.max(1, num(p.totalRounds, base.totalRounds, 1));
  if (typeof p.theme === 'string' && themeIds.includes(p.theme)) next.theme = p.theme;
  if (p.mode === 'dark' || p.mode === 'light') next.mode = p.mode;
  if (p.brand && typeof p.brand === 'object') {
    const b = p.brand as Record<string, unknown>;
    // only pictures uploaded to this server (or an https link) — never anything that could run script
    const pic = (v: unknown, old: string) => (typeof v === 'string' ? (v === '' || /^\/uploads\/[A-Z0-9]{6}\/[A-Za-z0-9]+\.(jpg|png|webp)$/.test(v) || /^https:\/\/[^\s"'<>]{1,280}$/.test(v) ? v : old) : old);
    next.brand = {
      logo: pic(b.logo, base.brand.logo),
      eventLogo: pic(b.eventLogo, base.brand.eventLogo),
      eventLogoStyle: b.eventLogoStyle === 'banner' ? 'banner' : b.eventLogoStyle === 'side' ? 'side' : base.brand.eventLogoStyle,
      color: typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : base.brand.color,
    };
  }

  if (p.display && typeof p.display === 'object') {
    const d = p.display as Record<string, unknown>;
    next.display = {
      showPhoto: bool(d.showPhoto, base.display.showPhoto),
      showDescription: bool(d.showDescription, base.display.showDescription),
      showRole: bool(d.showRole, base.display.showRole),
      showBasePrice: bool(d.showBasePrice, base.display.showBasePrice),
    };
  }

  if (Array.isArray(p.increments)) {
    const tiers = p.increments
      .map((t) => ({ from: num((t as any)?.from, -1, 0), step: num((t as any)?.step, -1, 1) }))
      .filter((t) => t.from >= 0 && t.step > 0);
    if (tiers.length === 0) throw new AuctionError('Add at least one bid increment');
    const sorted = sortedTiers(tiers);
    if (sorted[0].from !== 0) sorted[0] = { ...sorted[0], from: 0 };
    next.increments = sorted;
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// Creating and mutating events
// ---------------------------------------------------------------------------------------------

export function createStore(code: string, settingsPatch: unknown, now = Date.now(), gate: { required: boolean; price: number } = { required: false, price: 0 }): Store {
  const settings = mergeSettings(DEFAULT_SETTINGS, settingsPatch);
  return {
    access: gate.required ? { ...freeAccess(), status: 'locked', price: gate.price } : freeAccess(),
    data: {
      code,
      createdAt: now,
      settings,
      players: [],
      captains: [],
      round: 1,
      live: emptyLive(),
      log: [{ at: now, text: `Auction “${settings.name}” created` }],
      practice: false,
    },
    secrets: { adminKey: secretKey(), hostKey: secretKey(), captainTokens: {} },
    strategies: {},
    stash: null,
  };
}

function emptyLive(): EventData['live'] {
  return { phase: 'idle', playerId: null, bids: [], call: 0, spin: null, result: null, screen: 'stage', squadSort: 'price', break: null, seq: 0, lastEvent: null };
}

function emit(d: EventData, type: LiveEventType, now: number, extra: Partial<EventData['live']['lastEvent'] & object> = {}) {
  d.live.seq += 1;
  d.live.lastEvent = { seq: d.live.seq, type, at: now, ...extra };
}

function note(d: EventData, text: string, now: number) {
  d.log.push({ at: now, text });
  if (d.log.length > 300) d.log.splice(0, d.log.length - 300);
}

const fmtOf = (d: EventData): MoneyFmt => d.settings;
const money = (d: EventData, n: number) => formatMoney(n, fmtOf(d));

function getPlayer(d: EventData, id: unknown): Player {
  const p = d.players.find((x) => x.id === id);
  if (!p) throw new AuctionError('Player not found', 404);
  return p;
}
function getCaptain(d: EventData, id: unknown): Captain {
  const c = d.captains.find((x) => x.id === id);
  if (!c) throw new AuctionError('Team not found', 404);
  return c;
}

function currentPlayer(d: EventData): Player | null {
  return d.live.playerId ? (d.players.find((p) => p.id === d.live.playerId) ?? null) : null;
}

/** Time-driven transitions (the wheel stopping). Call before reading or acting on an event. */
export function tick(store: Store, now: number): boolean {
  const { live } = store.data;
  let changed = false;
  if (live.phase === 'spinning' && live.spin && now >= live.spin.endsAt) {
    live.phase = 'bidding';
    emit(store.data, 'reveal', live.spin.endsAt, { playerId: live.playerId ?? undefined });
    changed = true;
  }
  if (live.break && now >= live.break.endsAt) {
    const at = live.break.endsAt;
    live.break = null;
    emit(store.data, 'breakend', at);
    changed = true;
  }
  return changed;
}

/** The next moment something happens by itself (the wheel stops, a break ends), or null. */
export function nextDue(store: Store): number | null {
  const { live } = store.data;
  const times: number[] = [];
  if (live.phase === 'spinning' && live.spin) times.push(live.spin.endsAt);
  if (live.break) times.push(live.break.endsAt);
  return times.length ? Math.min(...times) : null;
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

export interface Actor {
  role: Me['role'];
  captainId?: string;
}

type Handler = (store: Store, p: Record<string, any>, actor: Actor, now: number) => unknown;
type Access = 'admin' | 'host' | 'captain' | 'captainOnly';

const rank: Record<Actor['role'], number> = { viewer: 0, captain: 1, host: 2, admin: 3 };

function allowed(actor: Actor, access: Access): boolean {
  if (access === 'captainOnly') return actor.role === 'captain' && !!actor.captainId;
  if (access === 'captain') return actor.role === 'captain' || actor.role === 'host' || actor.role === 'admin';
  return rank[actor.role] >= rank[access];
}

/** Changes to who is in the auction can't be part of a practice run (they would be lost or leak into the real one). */
const ROSTER_LOCKED = new Set(['captain.add', 'captain.budget', 'captains.topup', 'captain.remove', 'player.add', 'players.import', 'player.update', 'player.remove', 'demo.load']);

/** Actions that start the real auction. */
const GO_LIVE = new Set(['draw', 'pick']);

const actions: Record<string, { access: Access; run: Handler }> = {};
const on = (name: string, access: Access, run: Handler) => {
  actions[name] = { access, run };
};

export function runAction(store: Store, actor: Actor, name: string, params: unknown, now = Date.now()): unknown {
  const action = typeof name === 'string' && Object.hasOwn(actions, name) ? actions[name] : undefined; // (not inherited keys like "constructor")
  if (!action) throw new AuctionError(`Unknown action “${String(name).slice(0, 40)}”`, 404);
  if (!allowed(actor, action.access)) throw new AuctionError('You are not allowed to do that', 403);
  // Going live (putting a player on the block) needs the auction to be unlocked. Practice is always free.
  if (GO_LIVE.has(name) && !store.data.practice && !isOpen(store.access))
    throw new AuctionError('This auction is not unlocked yet. The admin can unlock it under Settings → Unlock to go live. Practice runs are free.', 402);
  if (store.data.practice && ROSTER_LOCKED.has(name))
    throw new AuctionError('Teams and players are locked during a practice run — click “Go live” first to edit them');
  tick(store, now);
  const p = (params && typeof params === 'object' ? params : {}) as Record<string, any>;
  return action.run(store, p, actor, now);
}

// ---- settings --------------------------------------------------------------------------------

on('settings.update', 'admin', ({ data }, p) => {
  data.settings = mergeSettings(data.settings, p.patch);
});

// ---- teams -----------------------------------------------------------------------------------

on('captain.add', 'admin', ({ data, secrets }, p, _a, now) => {
  if (data.captains.length >= MAX_CAPTAINS) throw new AuctionError(`Up to ${MAX_CAPTAINS} teams per auction`);
  const team = str(p.team, '', 60);
  if (!team) throw new AuctionError('Team name is required');
  const c: Captain = {
    id: uid(),
    team,
    name: str(p.name, '', 60),
    color: typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : COLORS[data.captains.length % COLORS.length],
    logo: str(p.logo, '', 300),
    budget: num(p.budget, data.settings.defaultBudget, 0),
  };
  data.captains.push(c);
  secrets.captainTokens[c.id] = randomCode(6);
  note(data, `Team ${c.team} joined with ${money(data, c.budget)}`, now);
  return { id: c.id };
});

on('captain.update', 'admin', ({ data }, p) => {
  const c = getCaptain(data, p.id);
  if (p.team !== undefined) c.team = str(p.team, c.team, 60) || c.team;
  if (p.name !== undefined) c.name = str(p.name, c.name, 60);
  if (p.logo !== undefined) c.logo = str(p.logo, c.logo, 300);
  if (typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color)) c.color = p.color;
});

on('captain.budget', 'admin', ({ data }, p, _a, now) => {
  const c = getCaptain(data, p.id);
  const amount = num(p.amount, NaN, 0);
  if (!Number.isFinite(amount)) throw new AuctionError('Enter an amount');
  const before = c.budget;
  if (p.mode === 'add') c.budget += amount;
  else if (p.mode === 'subtract') c.budget = Math.max(0, c.budget - amount);
  else if (p.mode === 'set') c.budget = amount;
  else throw new AuctionError('Unknown budget mode');
  note(data, `${c.team} purse ${money(data, before)} → ${money(data, c.budget)}`, now);
});

on('captains.topup', 'admin', ({ data }, p, _a, now) => {
  const amount = typeof p.amount === 'number' ? Math.round(p.amount) : NaN;
  if (!Number.isFinite(amount) || amount === 0) throw new AuctionError('Enter an amount');
  for (const c of data.captains) c.budget = Math.max(0, c.budget + amount);
  note(data, `All purses ${amount > 0 ? 'increased' : 'reduced'} by ${money(data, Math.abs(amount))}`, now);
});

on('captain.rotateToken', 'admin', ({ data, secrets }, p) => {
  const c = getCaptain(data, p.id);
  secrets.captainTokens[c.id] = randomCode(6);
});

on('captain.remove', 'admin', (store, p, _a, now) => {
  const { data, secrets } = store;
  const c = getCaptain(data, p.id);
  const top = data.live.bids[data.live.bids.length - 1];
  if (data.live.phase === 'bidding' && data.live.bids.some((b) => b.captainId === c.id) && top)
    throw new AuctionError('This team has bids on the current player — undo them first');
  // a SOLD stamp that names this team (as buyer or as an under-bidder) cannot stay on screen
  if (data.live.phase === 'sold' && data.live.playerId && (data.live.result?.captainId === c.id || data.live.bids.some((b) => b.captainId === c.id)))
    dropFromBlock(data, data.live.playerId, now);
  for (const pl of data.players) {
    if (pl.teamId === c.id) resetPlayer(pl);
  }
  data.captains = data.captains.filter((x) => x.id !== c.id);
  delete secrets.captainTokens[c.id];
  delete store.strategies[c.id];
  note(data, `Team ${c.team} removed`, now);
});

// ---- players ---------------------------------------------------------------------------------

function newPlayer(d: EventData, src: Record<string, any>): Player {
  const name = str(src.name, '', 80);
  if (!name) throw new AuctionError('Player name is required');
  return {
    id: uid(),
    name,
    role: str(src.role, '', 40),
    description: str(src.description, '', 400),
    photo: str(src.photo, '', 400),
    basePrice: num(src.basePrice, 0, 0),
    status: 'available',
    teamId: null,
    price: 0,
    soldRound: 0,
    soldAt: 0,
    order: d.players.reduce((m, p) => Math.max(m, p.order), 0) + 1,
  };
}

on('player.add', 'admin', ({ data }, p) => {
  if (data.players.length >= MAX_PLAYERS) throw new AuctionError(`Up to ${MAX_PLAYERS} players per auction`);
  const pl = newPlayer(data, p);
  data.players.push(pl);
  return { id: pl.id };
});

/**
 * Bulk import (paste or Excel). Rows may carry `team` + `price` to record a player who was already
 * bought before the app was used. A row whose name matches an existing player updates that player
 * instead of adding a duplicate, so export → edit → re-import is safe.
 */
on('players.import', 'admin', ({ data }, p, _a, now) => {
  const rows: Record<string, any>[] = Array.isArray(p.rows) ? p.rows : [];
  if (rows.length === 0) throw new AuctionError('Nothing to import');
  const skipped: string[] = [];
  let added = 0;
  let updated = 0;
  let assigned = 0;
  for (const row of rows) {
    const name = str(row?.name, '', 80);
    if (!name) {
      skipped.push('(a row without a name)');
      continue;
    }
    const existing = data.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing && data.live.playerId === existing.id && data.live.phase !== 'idle') {
      skipped.push(`${name} (on the block right now)`);
      continue;
    }
    if (!existing && data.players.length >= MAX_PLAYERS) {
      skipped.push(`${name} (limit of ${MAX_PLAYERS} players reached)`);
      continue;
    }

    let pl: Player;
    if (existing) {
      pl = existing;
      if (str(row.role, '', 40)) pl.role = str(row.role, '', 40);
      if (str(row.description, '', 400)) pl.description = str(row.description, '', 400);
      if (str(row.photo, '', 400)) pl.photo = str(row.photo, '', 400);
      if (num(row.basePrice, 0, 0) > 0) pl.basePrice = num(row.basePrice, 0, 0);
      updated++;
    } else {
      pl = newPlayer(data, row);
      data.players.push(pl);
      added++;
    }

    const teamName = str(row.team, '', 60).toLowerCase();
    if (teamName) {
      const c = data.captains.find((x) => x.team.toLowerCase() === teamName || x.name.toLowerCase() === teamName);
      if (c) {
        pl.status = 'sold';
        pl.teamId = c.id;
        pl.price = num(row.price, effectiveBase(data.settings, pl), 0);
        pl.soldRound = data.round;
        pl.soldAt = now;
        assigned++;
      } else {
        skipped.push(`${pl.name} (team “${row.team}” not found — left unassigned)`);
      }
    }
  }
  note(data, `Imported players: ${added} added, ${updated} updated${assigned ? `, ${assigned} placed on teams` : ''}`, now);
  return { added, updated, assigned, skipped };
});

on('player.update', 'admin', ({ data }, p) => {
  const pl = getPlayer(data, p.id);
  const patch = (p.patch ?? {}) as Record<string, any>;
  if (patch.name !== undefined) pl.name = str(patch.name, pl.name, 80) || pl.name;
  if (patch.role !== undefined) pl.role = str(patch.role, pl.role, 40);
  if (patch.description !== undefined) pl.description = str(patch.description, pl.description, 400);
  if (patch.photo !== undefined) pl.photo = str(patch.photo, pl.photo, 400);
  if (patch.basePrice !== undefined) pl.basePrice = num(patch.basePrice, pl.basePrice, 0);
});

const resetPlayer = (pl: Player) => Object.assign(pl, { status: 'available', teamId: null, price: 0, soldRound: 0, soldAt: 0 });

/** If `id` is the player on screen, wipe the screen (bids are discarded; the player's own status is untouched). */
function dropFromBlock(d: EventData, id: string, now: number): boolean {
  if (d.live.playerId !== id || d.live.phase === 'idle') return false;
  clearBlock(d);
  emit(d, 'idle', now);
  return true;
}

on('player.remove', 'admin', ({ data, strategies }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  dropFromBlock(data, pl.id, now);
  data.players = data.players.filter((x) => x.id !== pl.id);
  for (const id of Object.keys(strategies)) strategies[id] = strategies[id].filter((i) => i.playerId !== pl.id);
});

on('player.assign', 'admin', ({ data }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  const c = getCaptain(data, p.captainId);
  dropFromBlock(data, pl.id, now);
  pl.status = 'sold';
  pl.teamId = c.id;
  pl.price = num(p.price, effectiveBase(data.settings, pl), 0);
  pl.soldRound = data.round;
  pl.soldAt = now;
  note(data, `${pl.name} assigned to ${c.team} for ${money(data, pl.price)}`, now);
});

on('player.release', 'admin', ({ data }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  dropFromBlock(data, pl.id, now);
  resetPlayer(pl);
  note(data, `${pl.name} released back to the pool`, now);
});

/**
 * Admin override: put any player into any state. (Sold goes through `player.assign` because it
 * needs a team and a price.) Moving a player out of "sold" refunds their team.
 */
on('player.setStatus', 'admin', ({ data }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  switch (p.status) {
    case 'available':
      dropFromBlock(data, pl.id, now);
      resetPlayer(pl);
      note(data, `${pl.name} set to: in the pool`, now);
      break;
    case 'unsold':
      dropFromBlock(data, pl.id, now);
      resetPlayer(pl);
      pl.status = 'unsold';
      note(data, `${pl.name} set to: unsold`, now);
      break;
    case 'block':
      assertNoBreak(data);
      if (data.captains.length < 2) throw new AuctionError('Add at least two teams before starting');
      // Whoever is on screen right now is dropped (back to the pool if they were mid-bidding).
      if (pl.status === 'sold') resetPlayer(pl);
      putOnBlock(data, pl, null, now);
      note(data, `${pl.name} put on the block`, now);
      break;
    default:
      throw new AuctionError('Choose in the pool, on the block or unsold — use Assign to mark someone sold');
  }
});

// ---- the live auction ------------------------------------------------------------------------

const poolOf = (d: EventData, role?: string) =>
  d.players
    .filter((p) => p.status === 'available' && (!role || p.role.toLowerCase() === role.toLowerCase()))
    .sort((a, b) => a.order - b.order);

function assertNoBreak(d: EventData) {
  if (d.live.break) throw new AuctionError('A strategy break is running — end it first');
}

function assertCanDraw(d: EventData) {
  assertNoBreak(d);
  if (d.live.phase === 'spinning' || d.live.phase === 'bidding') throw new AuctionError('Finish the current player first');
  if (d.captains.length < 2) throw new AuctionError('Add at least two teams before starting');
}

function clearBlock(d: EventData) {
  d.live.playerId = null;
  d.live.bids = [];
  d.live.call = 0;
  d.live.spin = null;
  d.live.result = null;
  d.live.phase = 'idle';
}

function putOnBlock(d: EventData, player: Player, spin: EventData['live']['spin'], now: number) {
  clearBlock(d);
  d.live.playerId = player.id;
  if (spin) {
    d.live.phase = 'spinning';
    d.live.spin = spin;
    emit(d, 'spin', now, { playerId: player.id });
  } else {
    d.live.phase = 'bidding';
    emit(d, 'reveal', now, { playerId: player.id });
  }
}

function drawFromPool(d: EventData, now: number, mode: string | undefined, role?: string) {
  assertCanDraw(d);
  const pool = poolOf(d, role);
  if (pool.length === 0) throw new AuctionError(role ? `No “${role}” players left in this round` : `No players left in round ${d.round}`);
  const how = mode ?? d.settings.drawMode;
  if (how === 'manual') throw new AuctionError('Pick a player from the list');
  if (how === 'sequential') {
    putOnBlock(d, pool[0], null, now);
    return;
  }
  const target = pool[randomInt(pool.length)];
  const others = pool.filter((p) => p.id !== target.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [others[i], others[j]] = [others[j], others[i]];
  }
  const candidates = [target.id, ...others.slice(0, WHEEL_SLICES - 1).map((p) => p.id)];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  putOnBlock(d, target, { targetId: target.id, candidates, startedAt: now, endsAt: now + SPIN_MS }, now);
}

on('draw', 'host', ({ data }, p, _a, now) => {
  drawFromPool(data, now, typeof p.mode === 'string' ? p.mode : undefined, typeof p.role === 'string' && p.role ? p.role : undefined);
});

on('pick', 'host', ({ data }, p, _a, now) => {
  assertCanDraw(data);
  const pl = getPlayer(data, p.playerId);
  if (pl.status === 'sold') throw new AuctionError(`${pl.name} is already on a team`);
  putOnBlock(data, pl, null, now);
});

on('next', 'host', ({ data }, _p, _a, now) => {
  const phase = data.live.phase;
  if (phase !== 'sold' && phase !== 'unsold') throw new AuctionError('Nothing to move on from');
  clearBlock(data);
  emit(data, 'idle', now);
  if (data.settings.drawMode !== 'manual' && poolOf(data).length > 0) drawFromPool(data, now, undefined);
});

on('bid', 'captain', (store, p, actor, now) => {
  const { data } = store;
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== 'bidding' || !player) throw new AuctionError('Bidding is not open right now');

  const byHost = actor.role !== 'captain';
  const captainId = byHost ? p.captainId : actor.captainId;
  const captain = getCaptain(data, captainId);

  const min = nextBidAmount(data.settings, player, live.bids);
  const amount = p.amount === undefined ? min : num(p.amount, NaN, 0);
  if (!Number.isFinite(amount)) throw new AuctionError('Invalid bid amount');
  if (amount < min) throw new AuctionError(`Too late — the bid is already at ${money(data, live.bids[live.bids.length - 1]?.amount ?? 0)}. Next bid: ${money(data, min)}`);

  const block = checkBid(data, captain, amount);
  if (!block.ok) throw new AuctionError(block.reason);

  live.bids.push({ captainId: captain.id, amount, at: now, byHost });
  live.call = 0;
  emit(data, 'bid', now, { captainId: captain.id, amount, playerId: player.id });
  return { amount };
});

on('undoBid', 'host', ({ data }, _p, _a, now) => {
  if (data.live.phase !== 'bidding') throw new AuctionError('Bidding is not open');
  if (data.live.bids.length === 0) throw new AuctionError('No bids to undo');
  data.live.bids.pop();
  data.live.call = 0;
  emit(data, 'undo', now);
});

on('call', 'host', ({ data }, _p, _a, now) => {
  const live = data.live;
  if (live.phase !== 'bidding') throw new AuctionError('Bidding is not open');
  if (live.bids.length === 0) throw new AuctionError('No bids yet — wait for an opening bid, or mark the player unsold');
  if (live.call >= 3) throw new AuctionError('Final call already made — sell it!');
  live.call = (live.call + 1) as 1 | 2 | 3;
  emit(data, 'call', now, { call: live.call });
});

on('sold', 'host', ({ data }, _p, _a, now) => {
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== 'bidding' || !player) throw new AuctionError('Bidding is not open');
  const top = live.bids[live.bids.length - 1];
  if (!top) throw new AuctionError('No bids — mark the player unsold instead');
  const captain = getCaptain(data, top.captainId);
  if (teamStats(data, captain).remaining < top.amount)
    throw new AuctionError(`${captain.team} can no longer afford ${money(data, top.amount)} — undo the bid or top up their purse`);
  player.status = 'sold';
  player.teamId = captain.id;
  player.price = top.amount;
  player.soldRound = data.round;
  player.soldAt = now;
  live.phase = 'sold';
  live.result = { kind: 'sold', playerId: player.id, captainId: captain.id, price: top.amount };
  emit(data, 'sold', now, { playerId: player.id, captainId: captain.id, amount: top.amount });
  note(data, `SOLD: ${player.name} → ${captain.team} for ${money(data, top.amount)}`, now);
});

on('unsold', 'host', ({ data }, _p, _a, now) => {
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== 'bidding' || !player) throw new AuctionError('Bidding is not open');
  if (live.bids.length > 0) throw new AuctionError('There are bids on this player — undo them first');
  player.status = 'unsold';
  live.phase = 'unsold';
  live.result = { kind: 'unsold', playerId: player.id };
  emit(data, 'unsold', now, { playerId: player.id });
  note(data, `UNSOLD: ${player.name}`, now);
});

/** Undo the sale that is currently being shown, putting the player straight back on the block. */
on('reopen', 'host', ({ data }, _p, _a, now) => {
  const live = data.live;
  const player = currentPlayer(data);
  if ((live.phase !== 'sold' && live.phase !== 'unsold') || !player) throw new AuctionError('Nothing to reopen');
  Object.assign(player, { status: 'available', teamId: null, price: 0, soldRound: 0, soldAt: 0 });
  live.result = null;
  live.phase = 'bidding';
  live.call = 0;
  emit(data, 'undo', now);
  note(data, `${player.name} re-opened for bidding`, now);
});

/** "Wrong player / start over": send whoever is on screen back to the pool and reset the screen. */
on('unblock', 'host', ({ data }, _p, _a, now) => {
  const pl = currentPlayer(data);
  if (data.live.phase === 'idle' || !pl) throw new AuctionError('Nobody is on the block');
  const hadBids = data.live.bids.length;
  if (pl.status !== 'available') resetPlayer(pl); // a sold player is refunded, an unsold one rejoins the pool
  clearBlock(data);
  emit(data, 'idle', now);
  note(data, `${pl.name} sent back to the pool${hadBids ? ` (${hadBids} bid${hadBids === 1 ? '' : 's'} discarded)` : ''}`, now);
});

on('round.next', 'host', ({ data }, _p, _a, now) => {
  assertNoBreak(data);
  if (data.live.phase === 'spinning' || data.live.phase === 'bidding') throw new AuctionError('Finish the current player first');
  const unsold = data.players.filter((p) => p.status === 'unsold');
  if (unsold.length === 0) throw new AuctionError('There are no unsold players to carry over');
  for (const p of unsold) p.status = 'available';
  data.round += 1;
  clearBlock(data);
  emit(data, 'round', now);
  note(data, `Round ${data.round} started with ${unsold.length} unsold players`, now);
});

on('screen.set', 'host', ({ data }, p) => {
  data.live.screen = p.screen === 'board' ? 'board' : 'stage';
});

/** The auctioneer chooses how the team lists are ordered on the big screen: by price, or in the order bought. */
on('squad.sort', 'host', ({ data }, p) => {
  data.live.squadSort = p.sort === 'added' ? 'added' : 'price';
});

on('reset', 'admin', ({ data }, _p, _a, now) => {
  for (const p of data.players) Object.assign(p, { status: 'available', teamId: null, price: 0, soldRound: 0 });
  data.round = 1;
  const { screen, seq, squadSort } = data.live;
  data.live = { ...emptyLive(), screen, seq, squadSort };
  emit(data, 'idle', now);
  note(data, data.practice ? 'Practice restarted' : 'Auction reset', now);
});

// ---- strategy break ---------------------------------------------------------------------------

on('break.start', 'host', ({ data }, p, _a, now) => {
  const live = data.live;
  if (live.break) throw new AuctionError('A break is already running');
  if (live.phase === 'spinning' || live.phase === 'bidding')
    throw new AuctionError('Finish the current player (or send them back to the pool) before a break');
  const seconds = Number(p.seconds);
  if (!Number.isFinite(seconds) || seconds < 10 || seconds > 7200) throw new AuctionError('Choose a break between 10 seconds and 2 hours');
  clearBlock(data); // a lingering SOLD stamp makes way for the break
  live.break = { startedAt: now, endsAt: now + Math.round(seconds) * 1000, label: str(p.label, 'Strategy break', 60) || 'Strategy break' };
  emit(data, 'break', now, { amount: Math.round(seconds) });
  note(data, `Strategy break started (${Math.round(seconds)} s)`, now);
});

on('break.extend', 'host', ({ data }, p, _a, now) => {
  const b = data.live.break;
  if (!b) throw new AuctionError('There is no break running');
  const seconds = Math.round(Number(p.seconds ?? 60));
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 3600) throw new AuctionError('Add between 5 seconds and 1 hour');
  b.endsAt = Math.min(b.endsAt + seconds * 1000, now + 7200_000);
  emit(data, 'breakext', now, { amount: seconds });
});

on('break.end', 'host', ({ data }, _p, _a, now) => {
  if (!data.live.break) throw new AuctionError('There is no break running');
  data.live.break = null;
  emit(data, 'breakend', now);
  note(data, 'Strategy break ended early', now);
});

// ---- practice run -----------------------------------------------------------------------------

/**
 * Starts a rehearsal with the real teams and players. The real auction is parked untouched and put
 * back by `practice.end`, so nothing that happens in between can affect it.
 */
on('practice.start', 'admin', (store, _p, _a, now) => {
  const { data } = store;
  if (data.practice) throw new AuctionError('A practice run is already going');
  if (data.captains.length < 2 || data.players.length === 0) throw new AuctionError('Add at least two teams and some players first');
  store.stash = structuredClone({
    players: data.players,
    budgets: Object.fromEntries(data.captains.map((c) => [c.id, c.budget])),
    round: data.round,
    live: data.live,
    log: data.log,
  });
  for (const pl of data.players) resetPlayer(pl);
  data.round = 1;
  const { screen, seq, squadSort } = data.live;
  data.live = { ...emptyLive(), screen, seq, squadSort };
  data.log = [];
  data.practice = true;
  emit(data, 'practice', now);
  note(data, 'Practice run started — nothing here affects the real auction', now);
});

on('practice.end', 'admin', (store, _p, _a, now) => {
  const { data, stash } = store;
  if (!data.practice) throw new AuctionError('No practice run is going');
  if (stash) {
    data.players = stash.players;
    for (const c of data.captains) if (stash.budgets[c.id] !== undefined) c.budget = stash.budgets[c.id];
    data.round = stash.round;
    data.log = stash.log;
    const seq = data.live.seq;
    data.live = { ...stash.live, seq };
  } else {
    // (should not happen) no stash to restore: just leave a clean board
    for (const pl of data.players) resetPlayer(pl);
    data.round = 1;
    data.live = { ...emptyLive(), screen: data.live.screen, seq: data.live.seq, squadSort: data.live.squadSort };
  }
  store.stash = null;
  data.practice = false;
  emit(data, 'practice', now); // (no log line: the real record stays exactly as it was)
});

// ---- captains' strategy -----------------------------------------------------------------------

const planOf = (store: Store, actor: Actor): StrategyItem[] => {
  const c = getCaptain(store.data, actor.captainId); // a plan only ever belongs to a team that exists
  return (store.strategies[c.id] ??= []);
};

on('strategy.add', 'captainOnly', (store, p, actor) => {
  const pl = getPlayer(store.data, p.playerId);
  const plan = planOf(store, actor);
  if (pl.status === 'sold') throw new AuctionError(`${pl.name} has already been sold`);
  if (plan.some((i) => i.playerId === pl.id)) throw new AuctionError(`${pl.name} is already in your plan`);
  if (plan.length >= 100) throw new AuctionError('Your plan is full (100 players)');
  plan.push({ playerId: pl.id, budget: num(p.budget, effectiveBase(store.data.settings, pl), 0), note: str(p.note, '', 140) });
});

on('strategy.update', 'captainOnly', (store, p, actor) => {
  const item = planOf(store, actor).find((i) => i.playerId === p.playerId);
  if (!item) throw new AuctionError('That player is not in your plan', 404);
  if (p.budget !== undefined) item.budget = num(p.budget, item.budget, 0);
  if (p.note !== undefined) item.note = str(p.note, item.note, 140);
});

on('strategy.remove', 'captainOnly', (store, p, actor) => {
  store.strategies[actor.captainId!] = planOf(store, actor).filter((i) => i.playerId !== p.playerId);
});

// ---- demo data -------------------------------------------------------------------------------

const DEMO_PLAYERS: [string, string, string][] = [
  ['Aarav Mehta', 'Batter', 'Opens the innings and never leaves the crease.'],
  ['Rohan Iyer', 'Bowler', 'Yorker specialist. Terrifying in the last five.'],
  ['Priya Nair', 'All-rounder', 'Handy with both bat and ball — the office MVP.'],
  ['Kabir Singh', 'Batter', 'Big hitter. Has broken two windows this season.'],
  ['Ananya Rao', 'Wicketkeeper', 'Quick hands, sharper tongue.'],
  ['Vikram Shah', 'Bowler', 'Left-arm spin that nobody can read.'],
  ['Meera Kapoor', 'All-rounder', 'Captain material. Calm under pressure.'],
  ['Arjun Das', 'Batter', 'Anchors the innings with grit.'],
  ['Sneha Pillai', 'Bowler', 'Swing queen. Moves it both ways.'],
  ['Dev Malhotra', 'Batter', 'Highest strike rate in the building.'],
  ['Isha Verma', 'All-rounder', 'Fields like a cat, hits like a truck.'],
  ['Karan Joshi', 'Bowler', 'Pace and bounce. Needs ice after every spell.'],
  ['Tanya Bose', 'Batter', 'Elegant cover drives all day.'],
  ['Nikhil Reddy', 'Wicketkeeper', 'Stumps a batter before they blink.'],
  ['Zara Khan', 'All-rounder', 'Plays for the highlight reel.'],
  ['Harsh Vora', 'Bowler', 'Death-over specialist.'],
  ['Pooja Menon', 'Batter', 'Consistent. Boringly, wonderfully consistent.'],
  ['Rahul Gupta', 'Bowler', 'Off-spin with a doosra nobody asked for.'],
  ['Simran Kaur', 'All-rounder', 'Wins matches from nowhere.'],
  ['Aditya Pandey', 'Batter', 'Left-hander with a lovely flick.'],
  ['Neha Saxena', 'Bowler', 'Slower balls. Many, many slower balls.'],
  ['Yash Thakur', 'Batter', 'Finisher. Cool as ice.'],
  ['Divya Chawla', 'All-rounder', 'Does a bit of everything, brilliantly.'],
  ['Manav Kulkarni', 'Wicketkeeper', 'Loud behind the stumps.'],
];

on('demo.load', 'admin', ({ data, secrets }, _p, _a, now) => {
  if (data.captains.length === 0) {
    for (const team of ['Royal Rockets', 'Thunder Hawks', 'Neon Ninjas', 'Blaze Bulls']) {
      const c: Captain = { id: uid(), team, name: '', color: COLORS[data.captains.length % COLORS.length], logo: '', budget: data.settings.defaultBudget };
      data.captains.push(c);
      secrets.captainTokens[c.id] = randomCode(6);
    }
  }
  if (data.players.length === 0) {
    for (const [name, role, description] of DEMO_PLAYERS) data.players.push(newPlayer(data, { name, role, description }));
  }
  note(data, 'Sample teams and players loaded', now);
});

export function actionNames(): string[] {
  return Object.keys(actions);
}

export { maxBid };
