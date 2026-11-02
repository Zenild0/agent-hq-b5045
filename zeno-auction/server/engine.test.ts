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

test('auctioneer can send the player on screen back to the pool and reset the screen', () => {
  const { s, teams } = setup();
  const p = s.data.players[0];

  // mid-bidding: bids are discarded, the player is back in the pool, the screen is clear
  runAction(s, HOST, 'pick', { playerId: p.id });
  runAction(s, captain(s, teams[0]), 'bid', {});
  runAction(s, HOST, 'unblock', {});
  assert.equal(s.data.live.phase, 'idle');
  assert.equal(s.data.live.playerId, null);
  assert.equal(s.data.live.bids.length, 0);
  assert.equal(p.status, 'available');
  throwsAuction(() => runAction(s, HOST, 'unblock', {}), /Nobody/);

  // while the wheel is still spinning
  const t0 = 5_000_000;
  const spin = createStore('SPIN01', { drawMode: 'random' });
  for (const team of ['A', 'B']) runAction(spin, ADMIN, 'captain.add', { team });
  runAction(spin, ADMIN, 'player.add', { name: 'Only One' });
  runAction(spin, HOST, 'draw', {}, t0);
  assert.equal(spin.data.live.phase, 'spinning');
  runAction(spin, HOST, 'unblock', {}, t0 + 100);
  assert.equal(spin.data.live.phase, 'idle');
  tick(spin, t0 + SPIN_MS + 1000); // the stale spin timer must not reopen bidding
  assert.equal(spin.data.live.phase, 'idle');

  // right after SOLD: the sale is undone and the team refunded
  runAction(s, HOST, 'pick', { playerId: p.id });
  runAction(s, captain(s, teams[1]), 'bid', { amount: 2 * CR });
  runAction(s, HOST, 'sold', {});
  runAction(s, HOST, 'unblock', {});
  assert.equal(p.status, 'available');
  assert.equal(teamStats(s.data, s.data.captains[1]).remaining, 12 * CR);
  assert.equal(s.data.live.phase, 'idle');

  // captains cannot do it
  runAction(s, HOST, 'pick', { playerId: p.id });
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'unblock', {}), /not allowed/);
});

test('admin can set any player to pool / unsold / on the block / sold', () => {
  const { s, teams } = setup({}, 3);
  const [a, b, c] = s.data.players;
  const red = s.data.captains[0];

  runAction(s, ADMIN, 'player.setStatus', { id: a.id, status: 'unsold' });
  assert.equal(a.status, 'unsold');

  // put on the block (from unsold), bid, then switch to another player mid-bidding
  runAction(s, ADMIN, 'player.setStatus', { id: a.id, status: 'block' });
  assert.equal(s.data.live.playerId, a.id);
  assert.equal(s.data.live.phase, 'bidding');
  runAction(s, captain(s, teams[0]), 'bid', {});
  runAction(s, ADMIN, 'player.setStatus', { id: b.id, status: 'block' });
  assert.equal(s.data.live.playerId, b.id);
  assert.equal(s.data.live.bids.length, 0);
  assert.equal(a.status, 'unsold'); // untouched — the admin only moved the spotlight

  // set the player on screen straight to "in the pool": screen clears
  runAction(s, ADMIN, 'player.setStatus', { id: b.id, status: 'available' });
  assert.equal(s.data.live.phase, 'idle');
  assert.equal(b.status, 'available');

  // sold -> unsold refunds; assigning the on-block player replaces the screen instead of failing
  runAction(s, ADMIN, 'player.assign', { id: c.id, captainId: teams[0], price: 3 * CR });
  assert.equal(teamStats(s.data, red).remaining, 9 * CR);
  runAction(s, ADMIN, 'player.setStatus', { id: c.id, status: 'unsold' });
  assert.equal(c.status, 'unsold');
  assert.equal(teamStats(s.data, red).remaining, 12 * CR);
  runAction(s, ADMIN, 'player.setStatus', { id: c.id, status: 'block' });
  runAction(s, ADMIN, 'player.assign', { id: c.id, captainId: teams[1], price: 1 * CR });
  assert.equal(s.data.live.phase, 'idle');
  assert.equal(c.status, 'sold');

  // a sold player can be put straight back on the block (refunded first)
  runAction(s, ADMIN, 'player.setStatus', { id: c.id, status: 'block' });
  assert.equal(s.data.live.playerId, c.id);
  assert.equal(c.status, 'available');

  throwsAuction(() => runAction(s, ADMIN, 'player.setStatus', { id: c.id, status: 'sold' }), /Assign/);
  throwsAuction(() => runAction(s, HOST, 'player.setStatus', { id: c.id, status: 'available' }), /not allowed/);
});

// ---------------------------------------------------------------------------------------------
// practice run
// ---------------------------------------------------------------------------------------------

test('a practice run never touches the real auction', () => {
  const { s, teams } = setup({ defaultBudget: 100 * L }, 4);
  const [a, b] = s.data.players;
  runAction(s, ADMIN, 'player.assign', { id: a.id, captainId: teams[0], price: 30 * L }); // real sale
  runAction(s, HOST, 'pick', { playerId: b.id }); // real player on the block…
  runAction(s, captain(s, teams[1]), 'bid', { amount: 25 * L }); // …with a real bid
  const realBefore = JSON.stringify({ p: s.data.players, c: s.data.captains, r: s.data.round, l: s.data.live.bids, log: s.data.log.length });

  runAction(s, ADMIN, 'practice.start', {});
  assert.equal(s.data.practice, true);
  assert.ok(s.data.players.every((p) => p.status === 'available'), 'practice starts from a clean board');
  assert.equal(s.data.live.phase, 'idle');

  // run a full sale in practice, including a break and a round
  runAction(s, HOST, 'pick', { playerId: a.id });
  runAction(s, captain(s, teams[2]), 'bid', {});
  runAction(s, HOST, 'sold', {});
  assert.equal(a.status, 'sold');
  assert.equal(teamStats(s.data, s.data.captains[2]).count, 1);
  runAction(s, HOST, 'next', {});
  runAction(s, HOST, 'break.start', { seconds: 60 });
  runAction(s, ADMIN, 'player.setStatus', { id: b.id, status: 'unsold' });

  runAction(s, ADMIN, 'practice.end', {});
  assert.equal(s.data.practice, false);
  assert.equal(s.stash, null);
  const realAfter = JSON.stringify({ p: s.data.players, c: s.data.captains, r: s.data.round, l: s.data.live.bids, log: s.data.log.length });
  assert.equal(realAfter, realBefore, 'players, purses, round, bids and log are exactly as before');
  assert.equal(s.data.live.phase, 'bidding'); // the real player is still on the block
  assert.equal(s.data.live.playerId, b.id);
  assert.equal(s.data.live.break, null);
  throwsAuction(() => runAction(s, ADMIN, 'practice.end', {}), /No practice/);
});

test('practice needs a real setup and locks roster edits while it runs', () => {
  const empty = createStore('PRAC01', {});
  throwsAuction(() => runAction(empty, ADMIN, 'practice.start', {}), /at least two teams/);

  const { s, teams } = setup({}, 3);
  runAction(s, ADMIN, 'practice.start', {});
  throwsAuction(() => runAction(s, ADMIN, 'player.add', { name: 'Nope' }), /locked during a practice/);
  throwsAuction(() => runAction(s, ADMIN, 'captain.budget', { id: teams[0], mode: 'add', amount: 1 }), /locked/);
  throwsAuction(() => runAction(s, ADMIN, 'players.import', { rows: [{ name: 'X' }] }), /locked/);
  throwsAuction(() => runAction(s, ADMIN, 'practice.start', {}), /already/);
  runAction(s, ADMIN, 'reset', {}); // "restart practice" is allowed
  runAction(s, ADMIN, 'practice.end', {});
  runAction(s, ADMIN, 'player.add', { name: 'Fine now' }); // editing works again after going live
  assert.equal(s.data.players.length, 4);
});

// ---------------------------------------------------------------------------------------------
// strategy break
// ---------------------------------------------------------------------------------------------

test('a strategy break counts down, blocks drawing, can be extended and ended early', () => {
  const { s } = setup({ drawMode: 'sequential' }, 3);
  const t0 = 9_000_000;
  runAction(s, HOST, 'break.start', { seconds: 120, label: 'Plan round 2' }, t0);
  assert.equal(s.data.live.break!.endsAt, t0 + 120_000);
  assert.equal(s.data.live.break!.label, 'Plan round 2');
  throwsAuction(() => runAction(s, HOST, 'draw', {}, t0 + 1000), /break is running/);
  throwsAuction(() => runAction(s, HOST, 'pick', { playerId: s.data.players[0].id }, t0 + 1000), /break/);
  throwsAuction(() => runAction(s, HOST, 'break.start', { seconds: 30 }, t0 + 1000), /already running/);

  runAction(s, HOST, 'break.extend', { seconds: 60 }, t0 + 5000);
  assert.equal(s.data.live.break!.endsAt, t0 + 180_000);

  runAction(s, HOST, 'break.end', {}, t0 + 10_000); // early end
  assert.equal(s.data.live.break, null);
  runAction(s, HOST, 'draw', {}, t0 + 10_001); // auction continues
  assert.equal(s.data.live.phase, 'bidding');
});

test('a break ends by itself when the timer runs out; only the host can run it', () => {
  const { s, teams } = setup({}, 2);
  const t0 = 1_000_000;
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'break.start', { seconds: 60 }, t0), /not allowed/);
  throwsAuction(() => runAction(s, HOST, 'break.start', { seconds: 3 }, t0), /between/);
  runAction(s, HOST, 'break.start', { seconds: 60 }, t0);
  assert.equal(tick(s, t0 + 59_000), false);
  assert.equal(tick(s, t0 + 60_000), true);
  assert.equal(s.data.live.break, null);
  assert.equal(s.data.live.lastEvent!.type, 'breakend');
});

test('a break can follow a sale (the SOLD stamp is cleared) but not interrupt bidding', () => {
  const { s, teams } = setup({}, 2);
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  throwsAuction(() => runAction(s, HOST, 'break.start', { seconds: 60 }), /Finish the current player/);
  runAction(s, captain(s, teams[0]), 'bid', {});
  runAction(s, HOST, 'sold', {});
  runAction(s, HOST, 'break.start', { seconds: 60 });
  assert.equal(s.data.live.phase, 'idle');
  assert.equal(s.data.players[0].status, 'sold'); // the sale stands
});

// ---------------------------------------------------------------------------------------------
// captains' strategy
// ---------------------------------------------------------------------------------------------

test('captains keep a private plan of players and the most they will pay', () => {
  const { s, teams } = setup({}, 3);
  const [a, b] = s.data.players;
  const me = captain(s, teams[0]);
  const other = captain(s, teams[1]);

  runAction(s, me, 'strategy.add', { playerId: a.id, budget: 4 * CR });
  runAction(s, me, 'strategy.add', { playerId: b.id }); // defaults to the base price
  assert.deepEqual(s.strategies[teams[0]].map((i) => [i.playerId, i.budget]), [[a.id, 4 * CR], [b.id, 20 * L]]);
  assert.equal(s.strategies[teams[1]], undefined, 'other captains see nothing');

  throwsAuction(() => runAction(s, me, 'strategy.add', { playerId: a.id }), /already in your plan/);
  runAction(s, me, 'strategy.update', { playerId: a.id, budget: 3 * CR, note: 'only if cheap' });
  assert.equal(s.strategies[teams[0]][0].budget, 3 * CR);
  runAction(s, other, 'strategy.add', { playerId: a.id, budget: 1 * CR });
  assert.equal(s.strategies[teams[0]][0].budget, 3 * CR, 'plans are independent');

  runAction(s, me, 'strategy.remove', { playerId: b.id });
  assert.equal(s.strategies[teams[0]].length, 1);

  // only captains have a plan; sold players cannot be added; deleting a player cleans plans up
  throwsAuction(() => runAction(s, HOST, 'strategy.add', { playerId: a.id }), /not allowed/);
  runAction(s, ADMIN, 'player.assign', { id: b.id, captainId: teams[2], price: 1 });
  throwsAuction(() => runAction(s, me, 'strategy.add', { playerId: b.id }), /already been sold/);
  runAction(s, ADMIN, 'player.remove', { id: a.id });
  assert.equal(s.strategies[teams[0]].length, 0);
  assert.equal(s.strategies[teams[1]].length, 0);
  runAction(s, ADMIN, 'captain.remove', { id: teams[0] });
  assert.equal(s.strategies[teams[0]], undefined);
});

test('team lists can be ordered by price or by the order players were bought', async () => {
  const { sortSquad } = await import('../shared/rules');
  const { s, teams } = setup({}, 3);
  const [a, b, c] = s.data.players;
  runAction(s, ADMIN, 'player.assign', { id: a.id, captainId: teams[0], price: 30 * L }, 1000);
  runAction(s, ADMIN, 'player.assign', { id: b.id, captainId: teams[0], price: 90 * L }, 2000);
  runAction(s, ADMIN, 'player.assign', { id: c.id, captainId: teams[0], price: 50 * L }, 3000);
  const mine = s.data.players.filter((p) => p.teamId === teams[0]);
  assert.deepEqual(sortSquad(mine, 'price').map((p) => p.name), ['Player 2', 'Player 3', 'Player 1']);
  assert.deepEqual(sortSquad(mine, 'added').map((p) => p.name), ['Player 1', 'Player 2', 'Player 3']);
  // players with no purchase time (placed before the app was used) come first when ordering by purchase
  mine[2].soldAt = 0;
  assert.equal(sortSquad(mine, 'added')[0].name, 'Player 3');
  // only the auctioneer (or admin) can change it, and it survives a reset
  assert.equal(s.data.live.squadSort, 'price');
  throwsAuction(() => runAction(s, captain(s, teams[0]), 'squad.sort', { sort: 'added' }), /not allowed/);
  runAction(s, HOST, 'squad.sort', { sort: 'added' });
  assert.equal(s.data.live.squadSort, 'added');
  runAction(s, ADMIN, 'reset', {});
  assert.equal(s.data.live.squadSort, 'added');
  runAction(s, HOST, 'squad.sort', { sort: 'nonsense' });
  assert.equal(s.data.live.squadSort, 'price');
});

test('names added ahead of time and an extra purse join the auction together when the next round starts', () => {
  const { s, teams } = setup({ reserveRule: true, minSquad: 3 }, 2);
  const [a, b] = s.data.players;
  // two new names for round 2, added ahead of time
  const x = (runAction(s, ADMIN, 'player.add', { name: 'Newcomer X', later: true }) as { id: string }).id;
  runAction(s, ADMIN, 'players.import', { later: true, rows: [{ name: 'Newcomer Y' }, { name: 'Already bought', team: 'Red', price: 5 * L }] });
  const status = (name: string) => s.data.players.find((p) => p.name === name)!.status;
  assert.equal(status('Newcomer X'), 'upcoming');
  assert.equal(status('Newcomer Y'), 'upcoming');
  assert.equal(status('Already bought'), 'sold', 'a row with a team is placed on the team straight away');
  assert.equal(status('Player 1'), 'available');

  // they are not in the pool, cannot be spun, and do not count for the squad reserve rule
  runAction(s, HOST, 'draw', { mode: 'sequential' });
  assert.ok([a.id, b.id].includes(s.data.live.playerId!), 'only pool players come up');
  runAction(s, HOST, 'unsold', {});
  runAction(s, HOST, 'next', {});
  runAction(s, HOST, 'draw', { mode: 'sequential' });
  runAction(s, HOST, 'unsold', {});
  runAction(s, HOST, 'next', {});
  assert.equal(s.data.players.filter((p) => p.status === 'unsold').length, 2);
  throwsAuction(() => runAction(s, HOST, 'draw', {}), /No players left|pool|empty|no players/i);

  // extra money is saved ahead of time; only the admin can set it
  throwsAuction(() => runAction(s, HOST, 'round.topup', { amount: 5 * CR }), /not allowed/);
  runAction(s, ADMIN, 'round.topup', { amount: 2 * CR });
  assert.equal(s.data.nextTopup, 2 * CR);
  const before = s.data.captains.map((c) => c.budget);

  const res = runAction(s, HOST, 'round.next', {}) as { unsold: number; added: number; topup: number };
  assert.deepEqual(res, { unsold: 2, added: 2, topup: 2 * CR });
  assert.equal(s.data.round, 2);
  assert.equal(s.data.players.filter((p) => p.status === 'available').length, 4, '2 unsold + 2 new are all in the pool');
  assert.deepEqual(s.data.captains.map((c) => c.budget), before.map((b) => b + 2 * CR), 'every team got the extra money');
  assert.equal(s.data.nextTopup, 0, 'it is applied once');
  assert.equal(s.data.players.find((p) => p.id === x)!.status, 'available');
  void teams;
});

test('round.next needs someone to bring in, the admin can move players to and from "waiting for the next round", and a reset keeps them waiting', () => {
  const { s } = setup({}, 2);
  throwsAuction(() => runAction(s, HOST, 'round.next', {}), /no unsold or waiting/);
  const p = s.data.players[0];
  runAction(s, ADMIN, 'player.setStatus', { id: p.id, status: 'upcoming' });
  assert.equal(p.status, 'upcoming');
  runAction(s, ADMIN, 'round.topup', { amount: 3 * CR });
  runAction(s, ADMIN, 'reset', {});
  assert.equal(p.status, 'upcoming', 'a reset does not pour round-2 names into the pool');
  assert.equal(s.data.nextTopup, 0, 'a reset clears the saved extra purse');
  runAction(s, ADMIN, 'player.setStatus', { id: p.id, status: 'available' });
  assert.equal(p.status, 'available');
  // practice runs do not touch them
  runAction(s, ADMIN, 'player.setStatus', { id: p.id, status: 'upcoming' });
  runAction(s, ADMIN, 'practice.start', {});
  assert.equal(p.status, 'upcoming');
  throwsAuction(() => runAction(s, ADMIN, 'round.topup', { amount: 1 }), /locked/);
  runAction(s, ADMIN, 'practice.end', {});
  assert.equal(p.status, 'upcoming');
});
