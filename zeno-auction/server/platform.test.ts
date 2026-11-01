import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The developer key is read when the module loads, so set it (and a temporary data folder) first.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'zeno-plat-'));
process.env.DEV_KEY = 'test-developer-key-123456';
const platform = await import('./platform');
const { AuctionError, createStore, runAction } = await import('./engine');
const { buildArchive, restoreArchive } = await import('./archive');

const ADMIN = { role: 'admin' } as const;
const HOST = { role: 'host' } as const;
const noPhotos = () => null;

function ready(gate: { required: boolean; price: number }) {
  const s = createStore('PAY001', { drawMode: 'manual' }, Date.now(), gate);
  for (const team of ['A', 'B']) runAction(s, ADMIN, 'captain.add', { team });
  runAction(s, ADMIN, 'player.add', { name: 'P1' });
  return s;
}
const blocked = (fn: () => unknown) => assert.throws(fn, (e: unknown) => e instanceof AuctionError && e.status === 402 && /not unlocked/.test(e.message));

test('a locked auction can be set up and practised for free, but not taken live', () => {
  const s = ready({ required: true, price: 499 });
  assert.equal(s.access.status, 'locked');
  const id = s.data.players[0].id;
  blocked(() => runAction(s, HOST, 'pick', { playerId: id }));
  blocked(() => runAction(s, HOST, 'draw', {}));
  runAction(s, ADMIN, 'practice.start', {}); // practice is free
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  assert.equal(s.data.live.phase, 'bidding');
  runAction(s, ADMIN, 'practice.end', {});
  // once unlocked (paid or granted), going live works
  s.access.status = 'unlocked';
  runAction(s, HOST, 'pick', { playerId: s.data.players[0].id });
  assert.equal(s.data.live.phase, 'bidding');
});

test('a pending payment does not unlock; a free auction never asks', () => {
  const s = ready({ required: true, price: 100 });
  s.access.status = 'pending';
  blocked(() => runAction(s, HOST, 'pick', { playerId: s.data.players[0].id }));
  const free = ready({ required: false, price: 0 });
  assert.equal(free.access.status, 'free');
  runAction(free, HOST, 'pick', { playerId: free.data.players[0].id });
});

test('payment settings are validated and saved', () => {
  assert.throws(() => platform.savePlatform({ price: -1 }), AuctionError);
  assert.throws(() => platform.savePlatform({ price: 1.5 }), AuctionError);
  assert.throws(() => platform.savePlatform({ price: 500, upiId: 'not a upi id' }), /valid UPI id/);
  assert.equal(platform.currentGate().required, false, 'nothing is charged until a price and UPI id are set');
  platform.savePlatform({ price: 0, upiId: '', operatorName: 'Zeno', contact: 'a@b.c' });
  assert.equal(platform.currentGate().required, false, 'price 0 = free for everyone');
  const saved = platform.savePlatform({ price: 499, upiId: 'zeno@okaxis', payeeName: 'Zeno Bid', note: 'Thanks!\nfor supporting' });
  assert.equal(saved.note, 'Thanks! for supporting', 'line breaks are removed');
  assert.deepEqual(platform.currentGate(), { required: true, price: 499 });
});

test('waiting auctions open up by themselves if payments are switched off', () => {
  platform.savePlatform({ price: 499, upiId: 'zeno@okaxis' });
  const s = ready({ required: true, price: 499 });
  platform.refreshAccess(s);
  assert.equal(s.access.status, 'locked');
  platform.savePlatform({ price: 0, upiId: '' });
  platform.refreshAccess(s);
  assert.equal(s.access.status, 'free');
  const done = ready({ required: true, price: 499 });
  done.access.status = 'unlocked';
  platform.refreshAccess(done);
  assert.equal(done.access.status, 'unlocked', 'a paid auction stays paid');
});

test('the developer key is compared safely and is off when missing or short', () => {
  assert.equal(platform.isDevKey('test-developer-key-123456'), true);
  for (const bad of ['', 'nope', 'test-developer-key-12345', undefined, null, 42, 'test-developer-key-1234567']) assert.equal(platform.isDevKey(bad), false, String(bad));
  assert.equal(platform.devEnabled(), true);
});

test('an unlock survives "Restore from file" only with the server\'s own signature', () => {
  platform.savePlatform({ price: 499, upiId: 'zeno@okaxis' });
  const gate = platform.currentGate();
  const paid = ready({ required: true, price: 499 });
  paid.access = { ...paid.access, status: 'unlocked', by: 'payment' };
  const file = JSON.parse(JSON.stringify(buildArchive(paid, noPhotos)));
  assert.equal(file.auction.unlock.by, 'payment');
  assert.equal(restoreArchive(file, 'NEW001', Date.now(), gate).store.access.status, 'unlocked', 'a signed unlock carries over');

  const forged = JSON.parse(JSON.stringify(file));
  forged.auction.unlock.proof = 'a'.repeat(64);
  assert.equal(restoreArchive(forged, 'NEW002', Date.now(), gate).store.access.status, 'locked', 'a made-up signature is ignored');
  const edited = JSON.parse(JSON.stringify(file));
  edited.auction.sourceCode = 'OTHER1';
  assert.equal(restoreArchive(edited, 'NEW003', Date.now(), gate).store.access.status, 'locked', 'a signature for another auction is ignored');
  const upgraded = JSON.parse(JSON.stringify(file));
  upgraded.auction.unlock.by = 'grant';
  assert.equal(restoreArchive(upgraded, 'NEW004', Date.now(), gate).store.access.status, 'locked', 'the kind of unlock is part of what is signed');

  const locked = ready({ required: true, price: 499 });
  const lockedFile = JSON.parse(JSON.stringify(buildArchive(locked, noPhotos)));
  assert.equal(lockedFile.auction.unlock, null);
  const handmade = JSON.parse(JSON.stringify(lockedFile));
  handmade.auction.unlock = { by: 'grant', proof: '0'.repeat(64) };
  assert.equal(restoreArchive(handmade, 'NEW005', Date.now(), gate).store.access.status, 'locked', 'adding an unlock by hand does nothing');
  // when nothing is charged, a restore is simply free
  assert.equal(restoreArchive(file, 'NEW006').store.access.status, 'free');
});
