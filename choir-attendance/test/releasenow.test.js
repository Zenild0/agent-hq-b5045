// One-time release (19 Nov 2026): the teacher's tips waiting for Friday and every queued song go out when the
// new version first starts, once, and the built-in tips are all open.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = join(mkdtempSync(join(tmpdir(), 'choir-release-')), 'db.json');
const later = Date.now() + 3 * 86400000;
writeFileSync(file, JSON.stringify({
  voiceTips: [{ id: 't-wait', emoji: '💬', title: 'Waiting for Friday', body: 'Hum before you sing.', link: '', publishAt: later }],
  chordQueue: [1, 2, 3].map((i) => ({ id: `q${i}`, title: `Queued Song ${i}`, key: 'C', body: `[C]Line ${i} [G]here`, category: '' })),
  songDrip: { on: true, perWeek: 10, next: later, released: 0 },
}));
process.env.CHOIR_DATA = file;
delete process.env.CHOIR_PIN;
const { server, releaseEverythingNow, addNewSongs } = await import('../server.js');
const { NEW_CHORDS } = await import('../lib/freechords3.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const get = async (p) => (await fetch(base + p)).json();

test('waiting tips and queued songs are published at once, and only once', async () => {
  const tips = await get('/api/teacher/voice-tips');
  assert.equal(tips.own.find((t) => t.id === 't-wait').live, true, 'the Friday tip is out now');
  assert.equal(tips.remaining, 0, 'every built-in tip is open');
  assert.equal(tips.next, null);
  assert.equal(tips.upcoming.length, 0);
  const q = await get('/api/teacher/song-queue');
  assert.equal(q.waiting, 0, 'nothing left in the queue');
  assert.equal(q.released, 3);
  const songs = (await get('/api/teacher/chords')).songs.map((s) => s.title);
  for (const i of [1, 2, 3]) assert.ok(songs.includes(`Queued Song ${i}`));
  assert.deepEqual(releaseEverythingNow(), { tips: 0, songs: 0 }, 'a second start changes nothing');
});

test('the new batch of public-domain songs is in the Chord Book and, as words only, in the hymn list, once', async () => {
  const chords = (await get('/api/teacher/chords')).songs;
  const hymns = (await get('/api/hymns')).hymns ?? (await get('/api/teacher/hymns')).hymns;
  for (const f of NEW_CHORDS) {
    const c = chords.find((x) => x.title === f.title);
    assert.ok(c, `${f.title} is in the Chord Book`);
    const h = hymns.find((x) => x.title === f.title);
    assert.ok(h, `${f.title} is in the hymn list`);
    assert.equal(c.hymnId, h.id, 'the chord sheet is linked to its hymn');
    assert.doesNotMatch(h.lyrics, /\[|\{/, 'the hymn list shows words only');
  }
  assert.match(hymns.find((x) => x.title === 'Panis Angelicus').lyrics, /^Verse:\nPanis angelicus\nFit panis hominum;/);
  assert.deepEqual(addNewSongs(), { songs: 0, hymns: 0 }, 'a second start adds nothing');
});
