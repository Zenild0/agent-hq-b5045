import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionError, createStore, runAction, tick, SPIN_MS, type Actor, type Store } from './engine';
import { maxBid, nextBidAmount, teamStats } from '../shared/rules';

const ADMIN: Actor = { role: 'admin' };
const HOST: Actor = { role: 'host' };
const L = 100_000;
const CR = 10_000_000;

function setup(settings: Record<string, unknown> = {}, players = 4): { s: Store; teams: string[] } {
  const s = createStore('TEST22', { drawMode: 'manual', defaultBudget: 12 * CR, defaultBasePrice: 20 * L, ...settings });
  const teams = ['Red', 'Blue', 'Green'].map(
    (team) => (runAction(s, ADMIN, 'captain.add', { team }) as { id: string }).id,
  );
  for (let i = 1; i <= players; i++) runAction(s, ADMIN, 'player.add', { name: `Player ${i}`, role: i % 2 ? 'Batter' : 'Bowler' });
  return { s, teams };
}

const captain = (s: Store, id: string): Actor => ({ role: 'captain', captainId: id });
const throwsAuction = (fn: () => unknown, match?: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof AuctionError && (!match || match.test(e.message)));

test('increments follow the tiers: +5L below 1Cr, +10L from 1Cr', () => {
  const { s, teams } = setup();
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  const player = s.data.players[0];
  assert.equal(nextBidAmount(s.data.settings, player, s.data.live.bids), 20 * L);

  runAction(s, captain(s, teams[0]), 'bid', { amount: 20 * L });
  assert.equal(nextBidAmount(s.data.settings, player, s.data.live.bids), 25 * L);

  // jump straight to 95L, then the next step crosses into the 1Cr tier
  runAction(s, captain(s, teams[1]), 'bid', { amount: 95 * L });
  assert.equal(nextBidAmount(s.data.settings, player, s.data.live.bids), 100 * L);
  runAction(s, captain(s, teams[0]), 'bid', { amount: 100 * L });
  assert.equal(nextBidAmount(s.data.settings, player, s.data.live.bids), 110 * L);
});

test('a captain cannot outbid themselves or bid too low', () => {
  const { s, teams } = setup();
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  runAction(s, captain(s, teams[0]), 'bid', { amount: 20 * L });
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'bid', { amount: 25 * L }), /top bid/);
  throwsAuction(() => runAction(s, captain(s, teams[1]), 'bid', { amount: 20 * L }), /Too late/);
});

test('bids over the remaining purse are rejected', () => {
  const { s, teams } = setup({ defaultBudget: 50 * L });
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'bid', { amount: 55 * L }), /budget/);
  runAction(s, captain(s, teams[0]), 'bid', { amount: 50 * L });
});

test('going once / twice / thrice, then sold deducts from the purse', () => {
  const { s, teams } = setup();
  const p = s.data.players[0];
  runAction(s, HOST, 'pick', { playerId: p.id });
  throwsAuction(() => runAction(s, HOST, 'call', {}), /No bids/);
  runAction(s, captain(s, teams[2]), 'bid', { amount: 20 * L });
  runAction(s, HOST, 'call', {});
  runAction(s, HOST, 'call', {});
  runAction(s, HOST, 'call', {});
  assert.equal(s.data.live.call, 3);
  throwsAuction(() => runAction(s, HOST, 'call', {}), /Final call/);
  runAction(s, HOST, 'sold', {});

  assert.equal(s.data.live.phase, 'sold');
  assert.equal(p.status, 'sold');
  assert.equal(p.teamId, teams[2]);
  assert.equal(p.price, 20 * L);
  const green = s.data.captains.find((c) => c.id === teams[2])!;
  assert.equal(teamStats(s.data, green).remaining, 12 * CR - 20 * L);
});

test('a new bid resets the going-once count', () => {
  const { s, teams } = setup();
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  runAction(s, captain(s, teams[0]), 'bid', {});
  runAction(s, HOST, 'call', {});
  runAction(s, HOST, 'call', {});
  assert.equal(s.data.live.call, 2);
  runAction(s, captain(s, teams[1]), 'bid', {});
  assert.equal(s.data.live.call, 0);
});

test('the host can bid on behalf of a captain and undo a bid', () => {
  const { s, teams } = setup();
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  runAction(s, HOST, 'bid', { captainId: teams[0] });
  runAction(s, HOST, 'bid', { captainId: teams[1] });
  assert.equal(s.data.live.bids.length, 2);
  runAction(s, HOST, 'undoBid', {});
  assert.equal(s.data.live.bids.length, 1);
  assert.equal(s.data.live.bids[0].captainId, teams[0]);
});

test('captains cannot run the auction', () => {
  const { s, teams } = setup();
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'pick', { playerId: s.data.players[0].id }), /not allowed/);
  throwsAuction(() => runAction(s, HOST, 'captain.add', { team: 'X' }), /not allowed/);
  throwsAuction(() => runAction(s, { role: 'viewer' }, 'bid', {}), /not allowed/);
});

test('unsold needs zero bids; unsold players return in the next round', () => {
  const { s, teams } = setup({}, 2);
  const [a, b] = s.data.players;
  runAction(s, HOST, 'pick', { playerId: a.id });
  runAction(s, captain(s, teams[0]), 'bid', {});
  throwsAuction(() => runAction(s, HOST, 'unsold', {}), /bids/);
  runAction(s, HOST, 'sold', {});
  runAction(s, HOST, 'next', {});

  runAction(s, HOST, 'pick', { playerId: b.id });
  runAction(s, HOST, 'unsold', {});
  assert.equal(b.status, 'unsold');
  runAction(s, HOST, 'next', {});
  assert.equal(s.data.live.phase, 'idle');

  assert.equal(s.data.round, 1);
  runAction(s, HOST, 'round.next', {});
  assert.equal(s.data.round, 2);
  assert.equal(b.status, 'available');
  assert.equal(a.status, 'sold'); // sold players stay with their team
  throwsAuction(() => runAction(s, HOST, 'round.next', {}), /no unsold/);
});

test('random draw spins the wheel, then opens bidding when the wheel stops', () => {
  const { s, teams } = setup({ drawMode: 'random' }, 6);
  const t0 = 1_000_000;
  runAction(s, HOST, 'draw', {}, t0);
  const live = s.data.live;
  assert.equal(live.phase, 'spinning');
  assert.ok(live.spin && live.spin.candidates.includes(live.spin.targetId));
  assert.equal(live.spin.candidates.length, 6);
  assert.equal(live.playerId, live.spin.targetId);

  // no bidding while the wheel is turning
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'bid', {}, t0 + 1000), /not open/);

  tick(s, t0 + SPIN_MS);
  assert.equal(s.data.live.phase, 'bidding');
  runAction(s, captain(s, teams[0]), 'bid', {}, t0 + SPIN_MS + 10);
});

test('random draw only picks available players and respects the role filter', () => {
  const { s } = setup({ drawMode: 'random' }, 6);
  const sold = s.data.players.find((p) => p.role === 'Bowler')!;
  runAction(s, ADMIN, 'player.assign', { id: sold.id, captainId: s.data.captains[0].id, price: 1 });
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    runAction(s, HOST, 'draw', { role: 'Bowler' }, i * 100_000);
    const p = s.data.players.find((x) => x.id === s.data.live.playerId)!;
    assert.equal(p.role, 'Bowler');
    assert.notEqual(p.id, sold.id);
    seen.add(p.id);
    // wipe the board without touching the sold player
    s.data.live.phase = 'idle';
  }
  assert.equal(seen.size, 2, 'random draw should reach every remaining bowler');
});

test('sequential draw takes the next player in list order', () => {
  const { s } = setup({ drawMode: 'sequential' }, 3);
  runAction(s, HOST, 'draw', {});
  assert.equal(s.data.live.playerId, s.data.players[0].id);
  assert.equal(s.data.live.phase, 'bidding');
});

test('admin can add / subtract / set a purse at any time', () => {
  const { s, teams } = setup();
  const c = s.data.captains.find((x) => x.id === teams[0])!;
  runAction(s, ADMIN, 'captain.budget', { id: c.id, mode: 'add', amount: 3 * CR });
  assert.equal(c.budget, 15 * CR);
  runAction(s, ADMIN, 'captain.budget', { id: c.id, mode: 'subtract', amount: 5 * CR });
  assert.equal(c.budget, 10 * CR);
  runAction(s, ADMIN, 'captain.budget', { id: c.id, mode: 'set', amount: 7 * CR });
  assert.equal(c.budget, 7 * CR);
  runAction(s, ADMIN, 'captains.topup', { amount: 1 * CR });
  assert.ok(s.data.captains.every((x) => x.budget >= 8 * CR));
});

test('mid-event import: players already bought are attached to teams and deducted', () => {
  const { s, teams } = setup({}, 0);
  const res = runAction(s, ADMIN, 'players.import', {
    rows: [
      { name: 'Already Bought', team: 'Red', price: 3 * CR },
      { name: 'Still Free' },
      { name: 'Typo Team', team: 'Purple', price: 1 * CR },
    ],
  }) as { added: number; assigned: number; skipped: string[] };
  assert.equal(res.added, 3);
  assert.equal(res.assigned, 1);
  assert.equal(res.skipped.length, 1);
  const red = s.data.captains.find((c) => c.id === teams[0])!;
  assert.equal(teamStats(s.data, red).remaining, 9 * CR);
  assert.equal(s.data.players.filter((p) => p.status === 'available').length, 2);
});

test('manual assign and release adjust the purse', () => {
  const { s, teams } = setup();
  const p = s.data.players[0];
  runAction(s, ADMIN, 'player.assign', { id: p.id, captainId: teams[1], price: 2 * CR });
  const blue = s.data.captains.find((c) => c.id === teams[1])!;
  assert.equal(teamStats(s.data, blue).remaining, 10 * CR);
  runAction(s, ADMIN, 'player.release', { id: p.id });
  assert.equal(teamStats(s.data, blue).remaining, 12 * CR);
});

test('squad limits: full squads cannot bid; reserve rule protects the minimum squad', () => {
  const { s, teams } = setup({ maxSquad: 1, defaultBudget: 100 * L }, 4);
  runAction(s, ADMIN, 'player.assign', { id: s.data.players[0].id, captainId: teams[0], price: 20 * L });
  runAction(s, HOST, 'pick', { playerId: s.data.players[1].id });
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'bid', {}), /squad is full/);

  const r = setup({ minSquad: 3, reserveRule: true, defaultBudget: 100 * L }, 6);
  const red = r.s.data.captains[0];
  // must keep 2 more base prices (20L each) in reserve after buying this player
  assert.equal(maxBid(r.s.data, red, null), 100 * L - 2 * 20 * L);
  runAction(r.s, HOST, 'pick', { playerId: r.s.data.players[0].id });
  throwsAuction(() => runAction(r.s, captain(r.s, r.teams[0]), 'bid', { amount: 65 * L }), /budget/);
  runAction(r.s, captain(r.s, r.teams[0]), 'bid', { amount: 60 * L });
});

test('selling is refused if the budget was cut after the bid', () => {
  const { s, teams } = setup({ defaultBudget: 100 * L });
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  runAction(s, captain(s, teams[0]), 'bid', { amount: 60 * L });
  runAction(s, ADMIN, 'captain.budget', { id: teams[0], mode: 'set', amount: 40 * L });
  throwsAuction(() => runAction(s, HOST, 'sold', {}), /afford/);
  runAction(s, ADMIN, 'captain.budget', { id: teams[0], mode: 'add', amount: 30 * L });
  runAction(s, HOST, 'sold', {});
  assert.equal(s.data.players[0].price, 60 * L);
});

test('reopen puts a just-sold player back to bidding and refunds the team', () => {
  const { s, teams } = setup();
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  runAction(s, captain(s, teams[0]), 'bid', { amount: 2 * CR });
  runAction(s, HOST, 'sold', {});
  runAction(s, HOST, 'reopen', {});
  const red = s.data.captains[0];
  assert.equal(teamStats(s.data, red).remaining, 12 * CR);
  assert.equal(s.data.live.phase, 'bidding');
  runAction(s, captain(s, teams[1]), 'bid', {}); // continues from the existing top bid
  assert.equal(s.data.live.bids.length, 2);
});

test('settings.update validates increments and keeps the first tier at 0', () => {
  const { s } = setup();
  runAction(s, ADMIN, 'settings.update', { patch: { increments: [{ from: 500, step: 100 }, { from: 5000, step: 250 }] } });
  assert.deepEqual(s.data.settings.increments, [{ from: 0, step: 100 }, { from: 5000, step: 250 }]);
  throwsAuction(() => runAction(s, ADMIN, 'settings.update', { patch: { increments: [] } }), /increment/);
});

test('cannot start the auction with fewer than two teams', () => {
  const s = createStore('TEST22', { drawMode: 'sequential' });
  runAction(s, ADMIN, 'captain.add', { team: 'Solo' });
  runAction(s, ADMIN, 'player.add', { name: 'P' });
  throwsAuction(() => runAction(s, HOST, 'draw', {}), /two teams/);
});

test('re-importing the same names updates players instead of duplicating them', () => {
  const { s, teams } = setup({}, 0);
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'Sam', role: 'Batter' }, { name: 'Alex' }] });
  assert.equal(s.data.players.length, 2);
  const res = runAction(s, ADMIN, 'players.import', {
    rows: [
      { name: 'sam', description: 'Now with a bio', team: 'Red', price: 5 * CR },
      { name: 'Alex' },
      { name: 'New Kid' },
    ],
  }) as { added: number; updated: number; assigned: number };
  assert.deepEqual([res.added, res.updated, res.assigned], [1, 2, 1]);
  assert.equal(s.data.players.length, 3);
  const sam = s.data.players.find((p) => p.name === 'Sam')!;
  assert.equal(sam.role, 'Batter'); // untouched: blank cells never erase data
  assert.equal(sam.description, 'Now with a bio');
  assert.equal(sam.teamId, teams[0]);
  const alex = s.data.players.find((p) => p.name === 'Alex')!;
  assert.equal(alex.status, 'available'); // an empty Team cell does not release anyone
});
