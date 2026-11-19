import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-queue-')), 'db.json');
process.env.CHOIR_TRIAL_DAYS = '0'; process.env.CHOIR_TRIAL_GUEST_DAYS = '0';
delete process.env.CHOIR_PIN;
const { server, songDrip } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const songs = (n) => Array.from({ length: n }, (_, i) => `{title: Song ${String(i + 1).padStart(2, '0')}}\n[C]Words of song ${i + 1} [G]here`).join('\n{new_song}\n');

test('a songbook is queued in order, ten are released at once, then ten every Friday evening, oldest first', async () => {
  await j('/api/teacher/settings', { method: 'PUT', body: { chordsEnabled: true } });
  const q = (await j('/api/teacher/song-queue', { method: 'POST', body: { text: songs(25) + '\n{new_song}\n{title: No Chords}\nJust words' } })).data;
  assert.equal(q.added, 25);
  assert.equal(q.skipped.length, 1, 'a song with no chords is reported, not queued');
  assert.equal((await j('/api/teacher/song-queue', { method: 'POST', body: { text: songs(3) } })).data.duplicates, 3, 'a song already queued is not added twice');
  const kid = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Reader Kid' } })).data;
  await j(`/api/teacher/children/${kid.id}/game`, { method: 'PUT', body: { paid: true } });
  const lib = async () => (await j('/api/me/chords', { code: kid.code })).data.songs.map((s) => s.title);
  assert.deepEqual(await lib(), [], 'nothing is visible until the teacher starts the release');
  const s = (await j('/api/teacher/song-queue/start', { method: 'POST', body: { perWeek: 10 } })).data;
  assert.equal(s.first, 10); assert.equal(s.waiting, 15); assert.equal(s.on, true);
  const first = await lib();
  assert.equal(first.length, 10);
  assert.ok(first.includes('Song 01') && first.includes('Song 10') && !first.includes('Song 11'), 'the first ten, in the order they were added');
  songDrip.tick(Date.parse(s.next) - 1000);
  assert.equal((await lib()).length, 10, 'nothing before Friday evening');
  songDrip.tick(Date.parse(s.next) + 1000);
  const second = await lib();
  assert.equal(second.length, 20); assert.ok(second.includes('Song 20') && !second.includes('Song 21'));
  songDrip.tick(Date.parse(s.next) + 7 * 86400000 + 1000);
  assert.equal((await lib()).length, 25, 'the last five come the week after');
  const done = (await j('/api/teacher/song-queue')).data;
  assert.equal(done.waiting, 0); assert.equal(done.released, 25);
  assert.ok((await j('/api/me/chords', { code: kid.code })).data.songs.every((x) => x.rel > 0), 'released songs say when they arrived, so the app can mark them new');
});

test('the release can be paused, run early for one batch, and a queued song removed', async () => {
  await j('/api/teacher/song-queue', { method: 'POST', body: { text: songs(30).replaceAll('Song ', 'Later ') } });
  await j('/api/teacher/song-queue/pause', { method: 'POST', body: {} });
  const r = (await j('/api/teacher/song-queue', {})).data;
  assert.equal(r.on, false);
  songDrip.tick(Date.now() + 40 * 86400000);
  assert.equal((await j('/api/teacher/song-queue')).data.waiting, 30, 'paused: nothing is released');
  const one = r.queue[0];
  assert.equal((await j(`/api/teacher/song-queue/${one.id}`, { method: 'DELETE' })).data.waiting, 29);
  assert.equal((await j('/api/teacher/song-queue/release', { method: 'POST', body: {} })).data.first, 10, 'release one batch now');
});
