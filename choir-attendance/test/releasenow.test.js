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
  for (const t of ['Count Your Blessings', 'Do, Lord']) assert.ok(!hymns.some((x) => x.title === t), `${t} is not in this Catholic batch`);
  assert.ok(hymns.some((x) => x.title === 'Kyrie Eleison (chant)' && x.category === 'LHM'), 'the Kyrie goes in the Lord Have Mercy group');
});

test('songs from the first version of the batch are taken out again, unless the teacher changed them', async () => {
  const find = async (t) => (await get('/api/hymns')).hymns.find((x) => x.title === t);
  const kept = await find('Ave Verum Corpus');
  const put = await fetch(`${base}/api/teacher/hymns/${kept.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: 'We sing this in Lent' }) });
  assert.equal(put.status, 200);
  const r = addNewSongs('test-remove', [], Date.now(), ['Panis Angelicus', 'Ave Verum Corpus']);
  assert.equal(r.removed, 1);
  assert.equal(await find('Panis Angelicus'), undefined, 'an untouched one is taken out');
  assert.ok(await find('Ave Verum Corpus'), 'one the teacher changed stays');
  const chords = (await get('/api/teacher/chords')).songs.map((x) => x.title);
  assert.ok(!chords.includes('Panis Angelicus') && chords.includes('Ave Verum Corpus'), 'its chord sheet goes with it');
});

test('the whole free library goes into the Chord Book and the hymn list, without nursery rhymes', async () => {
  const chords = (await get('/api/teacher/chords')).songs.map((s) => s.title);
  const hymns = (await get('/api/hymns')).hymns.map((h) => h.title);
  for (const t of ['Hail, Redeemer, King Divine', 'On This Day, O Beautiful Mother', 'Immaculate Mary (Lourdes Hymn)', 'Holy God, We Praise Thy Name']) {
    assert.ok(chords.includes(t), `${t} has chords`);
    assert.ok(hymns.includes(t), `${t} is in the hymn list`);
  }
  assert.ok(chords.includes('Jingle Bells') && !hymns.includes('Jingle Bells'), 'a secular Christmas song gets chords only');
  assert.ok(!chords.includes('Twinkle, Twinkle, Little Star'), 'no nursery rhymes');
  assert.ok(!chords.includes('Blessed Assurance'), 'no evangelical gospel songs');
});
