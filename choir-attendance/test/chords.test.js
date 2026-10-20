import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-chords-')), 'db.json');
process.env.CHOIR_TRIAL_DAYS = '0'; // members have no trial here, so only a paid child gets in
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
const { transposeChord, keyAfter, parseSheet, chordsUsed, normaliseSheet, chordShape, isChord } = await import('../public/chordpro.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('chords move up and down, keep sharps or flats sensibly and draw a fingering', () => {
  assert.equal(transposeChord('G', 2), 'A');
  assert.equal(transposeChord('Em7', 3), 'Gm7');
  assert.equal(transposeChord('D/F#', -2, true), 'C/E');
  assert.equal(keyAfter('G', 3), 'Bb', 'a flat key is written with flats');
  assert.equal(keyAfter('G', 1), 'Ab');
  assert.equal(keyAfter('Am', 3), 'Cm');
  assert.ok(isChord('F#m7') && isChord('Cmaj7') && isChord('G/B') && !isChord('Hello') && !isChord('Verse'));
  assert.deepEqual(chordShape('G').frets, [3, 2, 0, 0, 0, 3]);
  assert.deepEqual(chordShape('F').frets, [1, 3, 3, 2, 1, 1], 'a moveable barre shape');
  assert.equal(chordShape('Xyz'), null);
});

test('a sheet pasted with chords above the words becomes [bracketed] and parses into lines', () => {
  const pasted = 'G       C      G\nAmazing grace, how sweet\n\nChorus:\nD        G\nthe sound';
  const sheet = normaliseSheet(pasted);
  assert.match(sheet, /^\[G\]Amazing \[C\]grace, \[G\]how sweet/);
  assert.deepEqual(chordsUsed(sheet), ['G', 'C', 'D']);
  const lines = parseSheet(sheet);
  assert.equal(lines.find((l) => l.kind === 'section').text, 'Chorus');
  assert.deepEqual(lines[0].segs.map((s) => s.chord), ['G', 'C', 'G']);
});

test('the teacher builds the library; students need the paid version and the teacher switch', async () => {
  const kid = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Chord Kid' } })).data;
  assert.equal((await j('/api/me/chords', { code: kid.code })).status, 403, 'switched off by default');
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { chordsEnabled: true } })).status, 200);
  assert.equal((await j('/api/public')).data.settings.chordsEnabled, true);
  const add = (body) => j('/api/teacher/chords', { method: 'POST', body });
  const ok = await add({ title: 'Amazing Grace', kind: 'hymn', category: 'Recessional', body: 'G       C\nAmazing grace\nD       G\nhow sweet' });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.key, 'G', 'the key is guessed from the first chord');
  assert.deepEqual(ok.data.chords, ['G', 'C', 'D']);
  assert.equal((await add({ title: 'amazing grace', kind: 'hymn', body: '[G]x' })).status, 409, 'no duplicates');
  assert.equal((await add({ title: 'No chords', kind: 'song', body: 'just words' })).status, 400);
  assert.equal((await add({ title: 'Bad key', kind: 'song', key: 'Q', body: '[G]x' })).status, 400);
  assert.equal((await add({ title: 'Shout to the Lord', kind: 'song', key: 'G', body: '[G]My Jesus [D]my Saviour' })).status, 201);
  const locked = (await j('/api/me/chords', { code: kid.code })).data;
  assert.equal(locked.locked, true);
  assert.equal(locked.count, 2);
  assert.ok(!('songs' in locked), 'no sheets for a child outside the trial');
  assert.equal((await j(`/api/me/chords/${ok.data.id}`, { code: kid.code })).status, 402);
  await j(`/api/teacher/children/${kid.id}/game`, { method: 'PUT', body: { paid: true } });
  const lib = (await j('/api/me/chords', { code: kid.code })).data;
  assert.equal(lib.locked, false);
  assert.deepEqual(lib.songs.map((s) => s.title), ['Amazing Grace', 'Shout to the Lord']);
  assert.ok(!('body' in lib.songs[0]), 'the list is light; a sheet is fetched when needed');
  const full = (await j(`/api/me/chords/${ok.data.id}`, { code: kid.code })).data;
  assert.match(full.body, /\[G\]Amazing \[C\]grace/);
  // the teacher edits it: the version number changes so phones refresh their copy
  const before = lib.songs[0].v;
  await new Promise((r) => setTimeout(r, 5));
  assert.equal((await j(`/api/teacher/chords/${ok.data.id}`, { method: 'PUT', body: { category: 'Entrance' } })).status, 200);
  assert.ok((await j('/api/me/chords', { code: kid.code })).data.songs[0].v > before);
  assert.equal((await j(`/api/teacher/chords/${ok.data.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await j('/api/me/chords', { code: kid.code })).data.songs.length, 1);
});

test('a guest gets the short free trial of the Chord Book', async () => {
  await j('/api/teacher/guests', { method: 'POST', body: { text: 'Trial Guest', newEvent: 'Carols' } });
  const g = (await j('/api/teacher/children')).data.children.find((c) => c.name === 'Trial Guest');
  const r = (await j('/api/me/chords', { code: g.code })).data;
  assert.equal(r.locked, false);
  assert.equal(r.trial.active, true);
});
