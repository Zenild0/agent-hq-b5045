import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionError, createStore, nextDue, runAction, tick, type Actor, type Store } from './engine';
import { nextBidAmount, teamStats } from '../shared/rules';

/**
 * Randomised stress test: throw thousands of random actions (valid and nonsense) from every role at
 * the engine, and after EVERY step check the rules that must always hold. A failure prints the seed
 * and the action trail so it can be replayed.
 */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ADMIN: Actor = { role: 'admin' };
const HOST: Actor = { role: 'host' };
const L = 100_000;

function check(s: Store, ctx: string, strictMoney = false) {
  const { data } = s;
  const fail = (msg: string) => assert.fail(`${msg}\n  after: ${ctx}`);
  const captainIds = new Set(data.captains.map((c) => c.id));
  const playerIds = new Set(data.players.map((p) => p.id));

  for (const p of data.players) {
    if (p.status === 'sold') {
      if (!p.teamId || !captainIds.has(p.teamId)) fail(`${p.name} is sold to a team that does not exist`);
      if (p.price < 0) fail(`${p.name} has a negative price`);
    } else {
      if (p.teamId !== null) fail(`${p.name} is ${p.status} but still has a team`);
      if (p.price !== 0) fail(`${p.name} is ${p.status} but still has a price`);
    }
  }
  if (new Set(data.players.map((p) => p.id)).size !== data.players.length) fail('duplicate player ids');
  if (new Set(data.captains.map((c) => c.id)).size !== data.captains.length) fail('duplicate team ids');

  const live = data.live;
  const onBlock = live.playerId ? data.players.find((p) => p.id === live.playerId) : null;
  if (live.playerId && !onBlock) fail('the player on the block no longer exists');

  switch (live.phase) {
    case 'idle':
      if (live.playerId || live.bids.length || live.spin || live.result || live.call) fail('idle screen has leftovers');
      break;
    case 'spinning':
      if (!live.spin || !onBlock) fail('spinning without a spin/player');
      if (live.bids.length || live.result) fail('spinning with bids/result');
      if (live.spin && !live.spin.candidates.includes(live.spin.targetId)) fail('wheel does not contain its target');
      if (live.spin && live.spin.targetId !== live.playerId) fail('wheel target differs from the player on the block');
      break;
    case 'bidding':
      if (!onBlock) fail('bidding with nobody on the block');
      if (live.result) fail('bidding but a result is showing');
      if (onBlock && onBlock.status === 'sold') fail('bidding on a player who is already sold');
      if (live.call > 0 && live.bids.length === 0) fail('a going-once call with no bids');
      break;
    case 'sold':
      if (!onBlock || !live.result || live.result.kind !== 'sold') fail('sold screen without a sold result');
      else {
        if (onBlock.status !== 'sold') fail('SOLD stamp shown but the player is not sold');
        if (onBlock.teamId !== live.result.captainId) fail('SOLD stamp names a different team than the player has');
        if (onBlock.price !== live.result.price) fail('SOLD stamp price differs from the player price');
      }
      break;
    case 'unsold':
      if (!onBlock || !live.result || live.result.kind !== 'unsold') fail('unsold screen without an unsold result');
      else if (onBlock.status !== 'unsold') fail('UNSOLD stamp shown but the player is not unsold');
      break;
  }

  // bids: each one higher than the last, never the same team twice running, only real teams
  for (let i = 0; i < live.bids.length; i++) {
    const b = live.bids[i];
    if (live.phase !== 'sold' && !captainIds.has(b.captainId)) fail('a bid from a team that no longer exists');
    if (i > 0 && b.amount <= live.bids[i - 1].amount) fail('bids are not strictly increasing');
    if (i > 0 && b.captainId === live.bids[i - 1].captainId) fail('the same team bid twice in a row');
  }
  if (live.break) {
    if (live.phase !== 'idle') fail('a break is running while a player is on screen');
    if (live.break.endsAt <= live.break.startedAt) fail('break ends before it starts');
  }
  if (data.practice && !s.stash) fail('practice run with nothing stashed');
  if (!data.practice && s.stash) fail('stash left behind after practice');
  for (const [capId, plan] of Object.entries(s.strategies)) {
    if (!captainIds.has(capId)) fail('strategy kept for a deleted team');
    for (const item of plan) if (!playerIds.has(item.playerId)) fail('strategy points at a deleted player');
  }
  for (const id of Object.keys(s.secrets.captainTokens)) if (!captainIds.has(id)) fail('token kept for a deleted team');
  for (const c of data.captains) if (!s.secrets.captainTokens[c.id]) fail('a team without a token');
  if (data.settings.increments[0].from !== 0) fail('first increment tier must start at 0');
  if (data.settings.increments.some((t) => t.step <= 0)) fail('non-positive bid step');

  if (strictMoney) {
    // with only normal auction flow (no admin money edits), nobody can ever spend more than they have
    for (const c of data.captains) if (teamStats(data, c).remaining < 0) fail(`${c.team} has a negative purse`);
  }

  // the whole store must survive being saved to disk and loaded back
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, `store changed in a JSON round-trip\n  after: ${ctx}`);
}

function run(seed: number, steps: number) {
  const r = rng(seed);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  const chance = (p: number) => r() < p;
  const s = createStore('FUZZ01', { drawMode: pick(['random', 'manual', 'sequential']), defaultBudget: 50 * L, defaultBasePrice: 2 * L, increments: [{ from: 0, step: 1 * L }, { from: 20 * L, step: 5 * L }], minSquad: chance(0.3) ? 2 : 0, maxSquad: chance(0.3) ? 3 : 0, reserveRule: chance(0.5) });
  for (let i = 0; i < 4; i++) runAction(s, ADMIN, 'captain.add', { team: `T${i}`, name: `C${i}` });
  for (let i = 0; i < 14; i++) runAction(s, ADMIN, 'player.add', { name: `P${i}`, role: pick(['A', 'B', '']), basePrice: chance(0.3) ? pick([1, 3, 5]) * L : 0 });

  let now = 1_000_000;
  let moneyEdited = false;
  const MONEY_EDITS = new Set(['captain.budget', 'captains.topup', 'player.assign', 'players.import', 'settings.update', 'captain.add']);
  const trail: string[] = [];
  const caps = () => s.data.captains;
  const anyPlayer = () => (chance(0.05) ? 'nope' : (s.data.players.length ? pick(s.data.players).id : 'x'));
  const anyTeam = () => (chance(0.05) ? 'nope' : (caps().length ? pick(caps()).id : 'x'));
  const captainActor = (): Actor => (caps().length && chance(0.97) ? { role: 'captain', captainId: pick(caps()).id } : { role: 'captain', captainId: 'ghost' });
  const junk = () => pick([null, undefined, 'str', 7, [], {}, -5, NaN, { amount: 'x' }]);

  type Gen = () => [Actor, string, unknown];
  const gens: [number, Gen][] = [
    [8, () => [HOST, 'draw', chance(0.3) ? { mode: pick(['random', 'sequential', 'manual']), role: chance(0.5) ? pick(['A', 'B']) : undefined } : {}]],
    [6, () => [HOST, 'pick', { playerId: anyPlayer() }]],
    [6, () => [HOST, 'next', {}]],
    [14, () => [captainActor(), 'bid', chance(0.5) ? {} : { amount: (chance(0.2) ? -1 : 1) * Math.round(r() * 60) * L * (chance(0.1) ? 0.5 : 1) }]],
    [4, () => [HOST, 'bid', { captainId: anyTeam(), amount: chance(0.5) ? undefined : Math.round(r() * 40) * L }]],
    [3, () => [HOST, 'undoBid', {}]],
    [7, () => [HOST, 'call', {}]],
    [6, () => [HOST, 'sold', {}]],
    [3, () => [HOST, 'unsold', {}]],
    [3, () => [HOST, 'reopen', {}]],
    [3, () => [HOST, 'unblock', {}]],
    [2, () => [HOST, 'round.next', {}]],
    [1, () => [HOST, 'screen.set', { screen: pick(['stage', 'board', 'junk']) }]],
    [2, () => [HOST, 'break.start', { seconds: pick([5, 10, 30, 120, 99999, 'x']) }]],
    [1, () => [HOST, 'break.extend', { seconds: pick([1, 30, 60, 99999]) }]],
    [2, () => [HOST, 'break.end', {}]],
    [3, () => [ADMIN, 'player.assign', { id: anyPlayer(), captainId: anyTeam(), price: pick([0, 1 * L, 10 * L, 60 * L, -3]) }]],
    [2, () => [ADMIN, 'player.release', { id: anyPlayer() }]],
    [4, () => [ADMIN, 'player.setStatus', { id: anyPlayer(), status: pick(['available', 'unsold', 'block', 'sold', 'junk']) }]],
    [1, () => [ADMIN, 'player.remove', { id: anyPlayer() }]],
    [2, () => [ADMIN, 'player.add', { name: pick(['New', '', '  ', 'X'.repeat(200)]) }]],
    [1, () => [ADMIN, 'player.update', { id: anyPlayer(), patch: { name: pick(['Renamed', '', 5]), basePrice: pick([-1, 3 * L, 'x']) } }]],
    [2, () => [ADMIN, 'players.import', { rows: [{ name: pick(['P1', 'P2', 'Fresh']), team: chance(0.5) ? pick(['T0', 'T1', 'Nobody']) : '', price: pick([0, 5 * L]) }, junk()] }]],
    [2, () => [ADMIN, 'captain.budget', { id: anyTeam(), mode: pick(['add', 'subtract', 'set', 'junk']), amount: pick([0, 5 * L, 80 * L, -1, 'x']) }]],
    [1, () => [ADMIN, 'captains.topup', { amount: pick([5 * L, -5 * L, 0, 'x']) }]],
    [1, () => [ADMIN, 'captain.add', { team: pick(['NewTeam', '', 'T0']), budget: pick([10 * L, 'x']) }]],
    [1, () => [ADMIN, 'captain.remove', { id: anyTeam() }]],
    [1, () => [ADMIN, 'captain.update', { id: anyTeam(), team: pick(['Renamed', '']), color: pick(['#ffffff', 'bad']) }]],
    [1, () => [ADMIN, 'settings.update', { patch: { increments: pick([[{ from: 0, step: 2 * L }], [{ from: 30, step: 1 }, { from: 0, step: 5 }], [], 'x']), minSquad: pick([0, 2, 'x']), maxSquad: pick([0, 3, -1]), drawMode: pick(['random', 'manual', 'junk']) } }]],
    [1, () => [ADMIN, 'reset', {}]],
    [1, () => [ADMIN, 'practice.start', {}]],
    [2, () => [ADMIN, 'practice.end', {}]],
    [3, () => [captainActor(), 'strategy.add', { playerId: anyPlayer(), budget: pick([undefined, 5 * L, -1, 'x']) }]],
    [2, () => [captainActor(), 'strategy.update', { playerId: anyPlayer(), budget: 3 * L, note: pick(['hi', 5]) }]],
    [2, () => [captainActor(), 'strategy.remove', { playerId: anyPlayer() }]],
    [1, () => [pick([HOST, ADMIN, { role: 'viewer' } as Actor]), pick(['nope', '', '__proto__', 'constructor', 'toString']), junk()]],
    [1, () => [pick([{ role: 'viewer' } as Actor, { role: 'captain', captainId: anyTeam() } as Actor]), pick(['player.add', 'sold', 'practice.start', 'settings.update', 'draw']), {}]],
  ];
  const total = gens.reduce((a, [w]) => a + w, 0);
  const choose = () => {
    let x = r() * total;
    for (const [w, g] of gens) if ((x -= w) < 0) return g;
    return gens[0][1];
  };

  for (let i = 0; i < steps; i++) {
    now += chance(0.08) ? 9000 : Math.floor(r() * 2500);
    const [actor, name, params] = choose()();
    trail.push(`${actor.role}:${name}(${JSON.stringify(params)})`);
    if (trail.length > 8) trail.shift();
    try {
      if (MONEY_EDITS.has(name) && actor.role === 'admin') moneyEdited = true;
      runAction(s, actor, name, params, now);
    } catch (e) {
      if (!(e instanceof AuctionError)) {
        throw new Error(`seed ${seed} step ${i}: ${name} threw a non-AuctionError: ${(e as Error).stack}\n  trail: ${trail.join(' → ')}`);
      }
    }
    if (chance(0.15) && nextDue(s) !== null) tick(s, now + 8000);
    try {
      check(s, `seed ${seed} step ${i}\n  trail: ${trail.join('\n         ')}`, !moneyEdited);
    } catch (e) {
      throw e;
    }
  }
  return s;
}

const SESSIONS = Number(process.env.FUZZ_SESSIONS ?? 600);
test(`engine invariants hold under ${SESSIONS} random sessions of 250 actions`, () => {
  for (let seed = 1; seed <= SESSIONS; seed++) run(seed, 250);
});

test('bids always follow the increment ladder from the opening price', () => {
  // replay many bidding wars and confirm every accepted bid equals the engine's own "next bid"
  const r = rng(99);
  for (let g = 0; g < 200; g++) {
    const s = createStore('LADDER', { drawMode: 'manual', defaultBudget: 500 * L, defaultBasePrice: 2 * L, increments: [{ from: 0, step: 1 * L }, { from: 20 * L, step: 5 * L }, { from: 100 * L, step: 20 * L }] });
    const ids = ['A', 'B', 'C'].map((team) => (runAction(s, ADMIN, 'captain.add', { team }) as { id: string }).id);
    runAction(s, ADMIN, 'player.add', { name: 'X' });
    runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
    let last = -1;
    for (let i = 0; i < 40; i++) {
      const who = ids[Math.floor(r() * ids.length)];
      const player = s.data.players[0];
      const expected = nextBidAmount(s.data.settings, player, s.data.live.bids);
      try {
        runAction(s, { role: 'captain', captainId: who }, 'bid', {});
        const top = s.data.live.bids[s.data.live.bids.length - 1];
        assert.equal(top.amount, expected);
        assert.ok(top.amount > last);
        last = top.amount;
      } catch (e) {
        assert.ok(e instanceof AuctionError);
      }
    }
    void teamStats;
  }
});
