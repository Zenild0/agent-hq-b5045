import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('a change is on disk within a tick, and the default data folder is the project folder', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zeno-'));
  process.env.DATA_DIR = dir;
  const persist = await import('./persist');
  const { createStore, runAction } = await import('./engine');
  const s = createStore('DURA01', { drawMode: 'manual' });
  runAction(s, { role: 'admin' }, 'captain.add', { team: 'A' });
  persist.saveSoon(s);
  await new Promise((r) => setTimeout(r, 25)); // far less than the old 250 ms window
  const file = path.join(dir, 'events', 'DURA01.json');
  assert.ok(existsSync(file), 'saved almost immediately');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).data.captains[0].team, 'A');
  // and it loads back
  assert.equal(persist.loadAll().get('DURA01')?.data.captains.length, 1);
  delete process.env.DATA_DIR;
});

test('deleting an auction removes its file, its photos, and cancels a pending save', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  process.env.DATA_DIR ??= mkdtempSync(path.join(tmpdir(), 'zeno-del-'));
  const persist = await import('./persist');
  const dir = persist.DATA_DIR; // (the folder is fixed when the module is first loaded)
  const { createStore } = await import('./engine');
  const s = createStore('GONE01', {});
  persist.saveNow(s);
  mkdirSync(path.join(dir, 'uploads', 'GONE01'), { recursive: true });
  writeFileSync(path.join(dir, 'uploads', 'GONE01', 'a.png'), 'x');
  persist.saveSoon(s); // a save is queued…
  persist.deleteEventFiles('GONE01'); // …but the delete wins
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(!existsSync(path.join(dir, 'events', 'GONE01.json')), 'file gone and not brought back');
  assert.ok(!existsSync(path.join(dir, 'uploads', 'GONE01')), 'photos gone');
  assert.equal(persist.readUpload('GONE01', 'a.png'), null);
  delete process.env.DATA_DIR;
});

test('an auction saved by the first version of ZenoBid opens in the current one and keeps working', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  process.env.DATA_DIR ??= mkdtempSync(path.join(tmpdir(), 'zeno-mig-'));
  const persist = await import('./persist');
  const { createStore, runAction } = await import('./engine');
  // build a store, then strip everything that was added after the first server release
  const s = createStore('OLD001', { name: 'Saved long ago', drawMode: 'manual' });
  runAction(s, { role: 'admin' }, 'captain.add', { team: 'A' });
  runAction(s, { role: 'admin' }, 'captain.add', { team: 'B' });
  runAction(s, { role: 'admin' }, 'player.add', { name: 'P1' });
  const raw = JSON.parse(JSON.stringify(s));
  delete raw.access;
  delete raw.stash;
  delete raw.strategies;
  delete raw.data.nextTopup;
  delete raw.data.practice;
  delete raw.data.live.squadSort;
  delete raw.data.live.break;
  delete raw.data.settings.theme;
  delete raw.data.settings.mode;
  delete raw.data.settings.brand;
  mkdirSync(path.join(persist.DATA_DIR, 'events'), { recursive: true });
  writeFileSync(path.join(persist.DATA_DIR, 'events', 'OLD001.json'), JSON.stringify(raw));

  const loaded = persist.loadAll().get('OLD001')!;
  assert.ok(loaded, 'the old file loads');
  assert.equal(loaded.access.status, 'free', 'an old auction is never locked behind a payment');
  assert.equal(loaded.data.settings.theme, 'midnight-gold');
  assert.equal(loaded.data.settings.mode, 'dark');
  assert.equal(loaded.data.settings.brand.eventLogoStyle, 'side');
  assert.equal(loaded.data.live.squadSort, 'price');
  assert.equal(loaded.data.nextTopup, 0);
  assert.equal(loaded.data.practice, false);
  assert.deepEqual(loaded.strategies, {});
  // and it still runs: settings change, a live player, a round change, a practice run
  runAction(loaded, { role: 'admin' }, 'settings.update', { patch: { theme: 'christmas', mode: 'light' } });
  assert.equal(loaded.data.settings.theme, 'christmas');
  runAction(loaded, { role: 'host' }, 'pick', { playerId: loaded.data.players[0].id });
  runAction(loaded, { role: 'host' }, 'unsold', {});
  runAction(loaded, { role: 'host' }, 'next', {});
  runAction(loaded, { role: 'host' }, 'round.next', {});
  assert.equal(loaded.data.round, 2);
  runAction(loaded, { role: 'admin' }, 'practice.start', {});
  runAction(loaded, { role: 'admin' }, 'practice.end', {});
});
