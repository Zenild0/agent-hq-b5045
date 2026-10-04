import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A tiny pretend lyrics website, so the test never touches the internet.
let mode = 'ok';
const fake = http.createServer((req, res) => {
  if (mode === 'down') { res.writeHead(500); return res.end('no'); }
  const q = new URL(req.url, 'http://x').searchParams.get('q');
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify([
    { trackName: `Amazing Grace`, artistName: 'John Newton', albumName: 'Hymns', plainLyrics: `Amazing grace\r\nhow sweet the sound (${q})` },
    { trackName: 'Amazing Grace', artistName: 'John Newton', plainLyrics: 'duplicate should be dropped' },
    { trackName: 'Instrumental', artistName: 'X', plainLyrics: null },
  ]));
});
await new Promise((ok) => fake.listen(0, ok));
process.env.CHOIR_LYRICS_URL = `http://localhost:${fake.address().port}/search`;
process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-ly-')), 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => { server.close(); fake.close(); });

test('teacher can search lyrics online; results are cleaned and de-duplicated', async () => {
  const r = await fetch(`${base}/api/teacher/lyrics?q=amazing%20grace`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.results.length, 1);
  assert.equal(d.results[0].title, 'Amazing Grace');
  assert.equal(d.results[0].lyrics, 'Amazing grace\nhow sweet the sound (amazing grace)');
});

test('too-short search is refused, and an offline lyrics site gives a friendly error', async () => {
  assert.equal((await fetch(`${base}/api/teacher/lyrics?q=a`)).status, 400);
  mode = 'down';
  const r = await fetch(`${base}/api/teacher/lyrics?q=amazing`);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /type or paste/);
  mode = 'ok';
});
