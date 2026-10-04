import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A tiny pretend lyrics website, so the test never touches the internet.
let mode = 'ok';
const fake = http.createServer((req, res) => {
  if (req.url.startsWith('/page')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<html><head><title>Amazing Grace | Hymns</title></head><body><nav>Menu</nav><article><h1>Amazing Grace</h1><p>Amazing grace,<br>how sweet the sound</p><p>That saved a wretch like me &amp; you</p><script>var x=1</script></article><footer>copyright</footer></body></html>');
  }
  if (req.url.startsWith('/img')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end('x'); }
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
process.env.CHOIR_ALLOW_PRIVATE_FETCH = '1'; // the pretend site is on this machine
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

test('teacher can import words from a pasted link; only the words come back', async () => {
  const post = (url) => fetch(`${base}/api/teacher/lyrics-link`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
  const ok = await post(`http://localhost:${fake.address().port}/page`);
  assert.equal(ok.status, 200);
  const d = await ok.json();
  assert.equal(d.title, 'Amazing Grace');
  assert.match(d.lyrics, /Amazing grace,\nhow sweet the sound/);
  assert.match(d.lyrics, /wretch like me & you/);
  assert.ok(!/Menu|copyright|var x/.test(d.lyrics));
  assert.equal((await post('not a link')).status, 400);
  assert.equal((await post(`http://localhost:${fake.address().port}/img`)).status, 400);
});

test('links to this machine or a home network are refused', async () => {
  const { isPrivateAddress } = await import('../lib/webpage.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.5', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ['8.8.8.8', '104.21.5.9', '2606:4700::1']) assert.ok(!isPrivateAddress(ip), ip);
});
