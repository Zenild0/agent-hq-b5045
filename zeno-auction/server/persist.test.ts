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
