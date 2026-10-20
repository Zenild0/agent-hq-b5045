import { test, before, after } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fake = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  if (req.url.startsWith('/nopre')) return res.end('<html><title>Plain</title><body><p>Just words, no chords here</p></body></html>');
  res.end('<html><head><title>Amazing Grace Chords | Sheets</title></head><body><nav>menu</nav><pre>short</pre><pre>G        C\nAmazing grace, how <b>sweet</b>\nD        G\nthe sound &amp; more</pre><script>var x = 1</script></body></html>');
});
await new Promise((ok) => fake.listen(0, ok));
process.env.CHOIR_ALLOW_PRIVATE_FETCH = '1'; // the pretend site is on this machine
process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-chords-')), 'db.json');
process.env.CHOIR_TRIAL_DAYS = '0'; // members have no trial here, so only a paid child gets in
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
const { FREE_CHORDS } = await import('../lib/freechords.js');
const { detectKey, fingersFor, chordSvg, transposeChord, keyAfter, parseSheet, chordsUsed, normaliseSheet, chordShape, isChord } = await import('../public/chordpro.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => { server.close(); fake.close(); });
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

test('chords above the words, chords before the words, or a mix of both all work (the pasted sheet that failed)', () => {
  const pasted = `[Verse 1]
G              D              Em
  Seeking You as a precious jewel
                Bm          C
Lord to give up, I'd be a fool
            Dsus4 D  Gsus4   G
You are my all   in all

[Chorus]
G D Em Bm`;
  const sheet = normaliseSheet(pasted);
  assert.match(sheet, /^\{Verse 1\}\n\[G\]/);
  assert.match(sheet, /\{Chorus\}\n\[G\] \[D\] \[Em\] \[Bm\]$/, 'a chord-only line stays as chords');
  assert.deepEqual(chordsUsed(sheet), ['G', 'D', 'Em', 'Bm', 'C', 'Dsus4', 'Gsus4']);
  const lines = parseSheet(sheet);
  assert.equal(lines[0].kind, 'section');
  assert.equal(lines[1].segs.filter((g) => g.chord).length, 3, 'three chords sit on the first lyric line');
  assert.ok(!lines.some((l) => l.kind === 'line' && l.segs.some((g) => g.chord === 'Verse 1')), 'a [Verse 1] label is a heading, not a chord');
  // already in brackets: left alone; mixed: only the chord-over-words part is converted
  assert.equal(normaliseSheet('[G]Amazing [C]grace'), '[G]Amazing [C]grace');
  assert.equal(normaliseSheet('[G]Amazing grace\nD    G\nhow sweet'), '[G]Amazing grace\n[D]how [G]sweet');
  // a chord that lands a letter or two into a word moves to the word start; one in the middle stays
  assert.equal(normaliseSheet('C\nSeeking'), '[C]Seeking');
  assert.equal(normaliseSheet('  G\nSeeking You'), '[G]Seeking You');
  assert.equal(normaliseSheet('    G\nA-ma-zing'), 'A-ma[G]-zing');
  assert.equal(normaliseSheet('G D\nHi'), '[G]Hi[D]');
  assert.equal(normaliseSheet('G  D\nOh'), '[G]Oh [D]', 'chords past the last word hang after one space');
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

test('the teacher can pull a chord sheet from a link; the spacing that lines the chords up is kept', async () => {
  const url = `http://localhost:${fake.address().port}/sheet`;
  const r = await j('/api/teacher/chord-link', { method: 'POST', body: { url } });
  assert.equal(r.status, 200);
  assert.match(r.data.title, /Amazing Grace Chords/);
  assert.match(r.data.text, /^G {8}C\nAmazing grace, how sweet\nD {8}G\nthe sound & more$/);
  assert.match(normaliseSheet(r.data.text), /^\[G\]Amazing \[C\]grace/);
  const none = await j('/api/teacher/chord-link', { method: 'POST', body: { url: `http://localhost:${fake.address().port}/nopre` } });
  assert.equal(none.status, 400);
  assert.match(none.data.error, /copy the chords and paste/);
  assert.equal((await j('/api/teacher/chord-link', { method: 'POST', body: { url: 'nope' } })).status, 400);
});

test('the free library holds public-domain sheets that are all well-formed, and saves with one tap', async () => {
  assert.ok(FREE_CHORDS.length >= 25);
  assert.equal(new Set(FREE_CHORDS.map((f) => f.id)).size, FREE_CHORDS.length, 'unique ids');
  for (const f of FREE_CHORDS) {
    assert.ok(isChord(f.key), `${f.title}: key`);
    assert.ok(f.body.length < 12000);
    const inside = [...f.body.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
    assert.ok(inside.length >= 4 && inside.every(isChord), `${f.title}: every bracket is a chord`);
    assert.equal(normaliseSheet(f.body), f.body, `${f.title}: already in the stored shape`);
  }
  const list = (await j('/api/teacher/free-chords')).data.songs;
  assert.equal(list.length, FREE_CHORDS.length);
  assert.ok(list.every((f) => f.inLibrary === false || f.title === 'Shout to the Lord'));
  const one = await j('/api/teacher/free-chords/silent-night', { method: 'POST', body: {} });
  assert.equal(one.status, 201);
  assert.equal(one.data.title, 'Silent Night');
  assert.equal((await j('/api/teacher/free-chords/silent-night', { method: 'POST', body: {} })).status, 409, 'not twice');
  assert.equal((await j('/api/teacher/free-chords/nope', { method: 'POST', body: {} })).status, 404);
  const all = await j('/api/teacher/free-chords/all', { method: 'POST', body: {} });
  assert.equal(all.data.added, FREE_CHORDS.length - 1);
  assert.ok((await j('/api/teacher/free-chords')).data.songs.every((f) => f.inLibrary));
});

test('a student can request a song that is missing; the teacher sees one line per song and adding it answers the request', async () => {
  const kids = [];
  for (const name of ['Req One', 'Req Two']) { const c = (await j('/api/teacher/children', { method: 'POST', body: { name } })).data; await j(`/api/teacher/children/${c.id}/game`, { method: 'PUT', body: { paid: true } }); kids.push(c); }
  const ask = (c, title) => j('/api/me/chords/request', { method: 'POST', code: c.code, body: { title } });
  assert.equal((await ask(kids[0], 'Oceans (Where Feet May Fail)')).status, 200);
  assert.equal((await ask(kids[1], 'oceans where feet may fail')).data.count, 2, 'the same song asked twice is one line with two names');
  assert.equal((await ask(kids[1], 'x')).status, 400);
  assert.equal((await ask(kids[0], 'Silent Night')).status, 409, 'already in the book');
  const list = (await j('/api/teacher/chord-requests')).data.requests;
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].names.sort(), ['Req One', 'Req Two']);
  assert.deepEqual((await j('/api/me/chords', { code: kids[0].code })).data.requested, ['Oceans (Where Feet May Fail)']);
  for (let i = 0; i < 4; i++) await ask(kids[0], `Song number ${i}`);
  assert.equal((await ask(kids[0], 'One too many')).status, 400, 'five waiting songs at most per child');
  const dismissed = await j(`/api/teacher/chord-requests/${list[0].id}`, { method: 'DELETE' });
  assert.equal(dismissed.data.requests.length, 4);
  const mine = (await j('/api/teacher/chord-requests')).data.requests.find((r) => r.title === 'Song number 0');
  assert.equal((await j('/api/teacher/chords', { method: 'POST', body: { title: 'song number 0', kind: 'song', body: '[G]La la' } })).status, 201);
  assert.ok(!(await j('/api/teacher/chord-requests')).data.requests.some((r) => r.id === mine.id), 'adding the song clears its request');
  const out = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Unpaid Req' } })).data;
  assert.equal((await ask(out, 'Anything')).status, 402);
});

test('the key is worked out from the chords, and the fingering has numbered fingers and barres', async () => {
  const key = (s) => detectKey(s.split(' ').map((c) => `[${c}]`).join(''));
  assert.equal(key('G C D Em G'), 'G');
  assert.equal(key('D G A Bm D'), 'D');
  assert.equal(key('Am F C G Am'), 'Am', 'a minor song that starts and ends on Am');
  assert.equal(key('Em C G D Em'), 'Em');
  assert.equal(key('Eb Bb Cm Ab Eb'), 'Eb');
  assert.equal(key('Dm Bb F C Dm'), 'Dm');
  assert.equal(key('G G7 C G Em D G'), 'G', 'seventh chords do not confuse it');
  assert.equal(detectKey('no chords at all'), '');
  // every free sheet is detected as its stated key, or its relative key
  const REL = { Em: 'G', Cm: 'Eb', Am: 'C', Dm: 'F', Bm: 'D', Gm: 'Bb' };
  let same = 0;
  for (const f of FREE_CHORDS) { const k = detectKey(f.body); if (k === f.key || REL[k] === f.key || REL[f.key] === k) same += 1; }
  assert.ok(same >= FREE_CHORDS.length - 3, `detected the key of ${same} of ${FREE_CHORDS.length} sheets`);
  // the key is filled in on the server when it is left empty
  const r = await j('/api/teacher/chords', { method: 'POST', body: { title: 'Key Test', kind: 'song', body: '[D]a [G]b [A]c [Bm]d [D]e' } });
  assert.equal(r.data.key, 'D');
  const d = fingersFor([-1, -1, 0, 2, 3, 2]);
  assert.deepEqual(d.fingers, [0, 0, 0, 1, 3, 2]);
  assert.equal(d.barre, null);
  const f = fingersFor([1, 3, 3, 2, 1, 1]);
  assert.deepEqual(f.barre, { fret: 1, from: 0, to: 5 });
  assert.equal(f.fingers[0], 1);
  assert.match(chordSvg({ frets: [-1, 2, 4, 4, 3, 2], label: 'Bm' }), /<rect[^>]+rx="5"/, 'a barre is drawn as a bar');
});
