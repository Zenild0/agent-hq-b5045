import type { Bid, Captain, EventData, EventSettings, IncrementTier, Player } from './types';

/** The step applied to a bid that currently stands at `current`. */
export function stepFor(increments: IncrementTier[], current: number): number {
  let step = increments[0]?.step ?? 1;
  for (const t of increments) {
    if (current >= t.from) step = t.step;
  }
  return step;
}

export function effectiveBase(settings: EventSettings, player: Player): number {
  return player.basePrice > 0 ? player.basePrice : settings.defaultBasePrice;
}

/** What the next bid has to be: the base price for an opening bid, otherwise top bid + step. */
export function nextBidAmount(settings: EventSettings, player: Player, bids: Bid[]): number {
  const top = bids[bids.length - 1];
  if (!top) return effectiveBase(settings, player);
  return top.amount + stepFor(settings.increments, top.amount);
}

export interface TeamStats {
  spent: number;
  remaining: number;
  count: number;
  players: Player[];
}

export function teamStats(data: Pick<EventData, 'players'>, captain: Captain): TeamStats {
  const players = data.players.filter((p) => p.status === 'sold' && p.teamId === captain.id);
  const spent = players.reduce((sum, p) => sum + p.price, 0);
  return { spent, remaining: captain.budget - spent, count: players.length, players };
}

/**
 * The most this captain can bid right now: purse left minus whatever they must keep back to still
 * reach the minimum squad size (priced at the cheapest players left in the pool).
 */
export function maxBid(data: EventData, captain: Captain, excludePlayerId?: string | null): number {
  const { settings } = data;
  const { remaining, count } = teamStats(data, captain);
  if (!settings.reserveRule || settings.minSquad <= 0) return remaining;
  const slotsAfterThis = Math.max(0, settings.minSquad - count - 1);
  if (slotsAfterThis === 0) return remaining;
  const cheapest = data.players
    .filter((p) => p.status !== 'sold' && p.id !== excludePlayerId)
    .map((p) => effectiveBase(settings, p))
    .sort((a, b) => a - b)
    .slice(0, slotsAfterThis);
  return remaining - cheapest.reduce((a, b) => a + b, 0);
}

export type BidBlock =
  | { ok: true }
  | { ok: false; reason: string };

/** Everything that stops `captain` from bidding `amount` on the current player. */
export function checkBid(data: EventData, captain: Captain, amount: number): BidBlock {
  const { live, settings } = data;
  const player = data.players.find((p) => p.id === live.playerId);
  if (live.phase !== 'bidding' || !player) return { ok: false, reason: 'Bidding is not open' };
  const { count } = teamStats(data, captain);
  if (settings.maxSquad > 0 && count >= settings.maxSquad) return { ok: false, reason: 'Your squad is full' };
  const top = live.bids[live.bids.length - 1];
  if (top?.captainId === captain.id) return { ok: false, reason: 'You hold the top bid' };
  const limit = maxBid(data, captain, player.id);
  if (amount > limit) return { ok: false, reason: 'Over your budget' };
  return { ok: true };
}

export function sortedTiers(tiers: IncrementTier[]): IncrementTier[] {
  return [...tiers].sort((a, b) => a.from - b.from);
}

/** The last part of a spin where the winning name flashes before bidding opens. */
export const SPIN_FLASH_MS = 1800;
