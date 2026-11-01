import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionError, createStore, runAction, type Actor, type Store } from './engine';
import { ARCHIVE_FORMAT, buildArchive, restoreArchive } from './archive';

const ADMIN: Actor = { role: 'admin' };
const HOST: Actor = { role: 'host' };
const L = 100_000;
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

/** A small auction part-way through: one player sold, one unsold, one still in the pool. */
function played(): { s: Store; red: string; blue: string } {
  const s = createStore('OLD111', { name: 'Gala Draft', drawMode: 'manual', defaultBudget: 120 * L, defaultBasePrice: 20 * L });
  const red = (runAction(s, ADMIN, 'captain.add', { team: 'Red', name: 'Asha' }) as { id: string }).id;
  const blue = (runAction(s, ADMIN, 'captain.add', { team: 'Blue', logo: '/uploads/OLD111/aaaa1111.png' }) as { id: string }).id;
  for (const n of ['One', 'Two', 'Three']) runAction(s, ADMIN, 'player.add', { name: n, photo: n === 'One' ? '/uploads/OLD111/bbbb2222.png' : '' });
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  runAction(s, { role: 'captain', captainId: red }, 'bid', { amount: 20 * L });
  runAction(s, HOST, 'sold', {});
  runAction(s, HOST, 'pick', { playerId: s.data.players[1].id });
  runAction(s, HOST, 'unsold', {});
  runAction(s, { role: 'captain', captainId: red }, 'strategy.add', { playerId: s.data.players[2].id, budget: 30 * L, note: 'maybe' });
  return { s, red, blue };
}
const photos = (name: string) => (name === 'aaaa1111.png' || name === 'bbbb2222.png' ? PNG : null);

test('save then restore keeps teams, results, PINs, history, photos and plans', () => {
  const { s, red, blue } = played();
  const file = buildArchive(s, photos);
  assert.equal(file.format, ARCHIVE_FORMAT);
  const wire = JSON.parse(JSON.stringify(file)); // it really is plain JSON
  const { store: r, photos: pics } = restoreArchive(wire, 'NEW222');

  assert.equal(r.data.code, 'NEW222');
  assert.notEqual(r.secrets.adminKey, s.secrets.adminKey, 'fresh admin key');
  assert.equal(r.data.settings.name, 'Gala Draft');
  assert.deepEqual(r.data.captains.map((c) => c.team), ['Red', 'Blue']);
  assert.deepEqual(r.secrets.captainTokens, s.secrets.captainTokens, 'the PINs captains already have still work');
  const [one, two, three] = r.data.players;
  assert.equal(one.status, 'sold');
  assert.equal(one.teamId, red);
  assert.equal(one.price, 20 * L);
  assert.equal(two.status, 'unsold');
  assert.equal(three.status, 'available');
  assert.equal(r.data.live.phase, 'idle');
  assert.ok(r.data.log.length >= s.data.log.length, 'history kept');
  assert.equal(r.strategies[red][0].note, 'maybe');
  assert.equal(r.strategies[blue], undefined, "no plan for a team that had none");

  // photos are re-homed under the new code, with new names
  assert.equal(pics.size, 2);
  assert.match(one.photo, /^\/uploads\/NEW222\/[0-9a-f]{12}\.png$/);
  assert.ok(pics.has(one.photo.split('/').pop()!));
  assert.match(r.data.captains[1].logo, /^\/uploads\/NEW222\//);
  assert.ok(!JSON.stringify(r).includes('OLD111'), 'nothing points at the old auction');
});

test('during a practice run the real auction is the one that is saved', () => {
  const { s } = played();
  runAction(s, ADMIN, 'practice.start', {});
  assert.equal(s.data.practice, true);
  const { store: r } = restoreArchive(JSON.parse(JSON.stringify(buildArchive(s, photos))), 'NEW333');
  assert.equal(r.data.practice, false);
  assert.equal(r.stash, null);
  assert.equal(r.data.players.filter((p) => p.status === 'sold').length, 1, 'the real sale, not the practice state');
});

test('a hostile or broken file is cleaned up or refused, never trusted', () => {
  const bad = (f: unknown, m?: RegExp) => assert.throws(() => restoreArchive(f, 'NEW444'), (e: unknown) => e instanceof AuctionError && e.status === 400 && (!m || m.test(e.message)));
  bad(null);
  bad([]);
  bad({ format: 'something-else' });
  bad({ format: ARCHIVE_FORMAT, version: 99, auction: {} }, /newer/);

  const evil = {
    format: ARCHIVE_FORMAT,
    version: 1,
    photos: { 'x.png': 'data:text/html;base64,PGI+', 'y.png': 'data:image/png;base64,!!!' },
    auction: {
      settings: { name: 'x'.repeat(999), accent: 'javascript:1', defaultBudget: -1, increments: [{ from: 0, step: 5 }] },
      round: -4,
      captains: [
        { id: 'a', team: 'A', color: 'red', logo: 'javascript:alert(1)', budget: 'lots' },
        { id: 'a', team: 'Duplicate' },
        { id: '../etc', team: 'Path' },
        { id: 'b', team: '' },
        'junk',
      ],
      captainPins: { a: 'lowercase', b: 'ZZZZZZ' },
      players: [
        { id: 'p1', name: 'Sold to nobody', status: 'sold', teamId: 'ghost', price: 5 },
        { id: 'p1', name: 'Duplicate id' },
        { id: 'p2', name: 'Fine', status: 'sold', teamId: 'a', price: 7, photo: '/uploads/OTHER/x.png' },
        { id: 'p3', name: '' },
        { id: 'p4', name: 'Bad status', status: 'banana', price: 99 },
      ],
      strategies: { ghost: [{ playerId: 'p2' }], a: [{ playerId: 'nobody' }, { playerId: 'p2', budget: 'x', note: 5 }] },
      log: [{ at: 'x', text: 'ok' }, 5, { text: 9 }],
    },
  };
  const { store: r, photos: pics } = restoreArchive(evil, 'NEW444');
  assert.equal(r.data.settings.name.length, 80);
  assert.match(r.data.settings.accent, /^#[0-9a-f]{6}$/i);
  assert.ok(r.data.settings.defaultBudget > 0);
  assert.equal(r.data.round, 1);
  assert.deepEqual(r.data.captains.map((c) => c.id), ['a'], 'duplicate, path-like, nameless and junk teams dropped');
  assert.equal(r.data.captains[0].logo, '');
  assert.match(r.secrets.captainTokens.a, /^[A-Z0-9]{6}$/);
  assert.deepEqual(r.data.players.map((p) => p.id), ['p1', 'p2', 'p4']);
  assert.equal(r.data.players[0].status, 'available', 'a sale to a team that does not exist is undone');
  assert.equal(r.data.players[0].price, 0);
  assert.equal(r.data.players[1].status, 'sold');
  assert.equal(r.data.players[1].photo, '', 'a link into someone else’s photos is dropped');
  assert.equal(r.data.players[2].status, 'available');
  assert.deepEqual(Object.keys(r.strategies), ['a']);
  assert.deepEqual(r.strategies.a.map((x) => x.playerId), ['p2']);
  assert.equal(pics.size, 0, 'only real images are accepted');
});

test('two teams cannot end up sharing a PIN, and missing PINs are filled in', () => {
  const f = {
    format: ARCHIVE_FORMAT,
    version: 1,
    auction: { captains: [{ id: 'a', team: 'A' }, { id: 'b', team: 'B' }, { id: 'c', team: 'C' }], captainPins: { a: 'ABC234', b: 'ABC234' }, players: [] },
  };
  const { store } = restoreArchive(f, 'NEW555');
  const pins = Object.values(store.secrets.captainTokens);
  assert.equal(new Set(pins).size, 3);
  assert.equal(store.secrets.captainTokens.a, 'ABC234');
});
