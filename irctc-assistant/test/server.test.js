import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startServer } from '../src/server.js';

process.env.IRCTC_ASSISTANT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'irctc-srv-'));

// fetch() can't override Host, so use raw http for the rebinding check.
const raw = (url, { host, method = 'GET', body } = {}) => new Promise((resolve, reject) => {
  const u = new URL(url);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { ...(host ? { host } : {}), 'content-type': 'application/json' } },
    (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers })); });
  req.on('error', reject);
  req.end(body);
});

test('local server: token, host check, no secrets, risk gate, assist job lifecycle', async () => {
  const s = await startServer();
  const base = new URL(s.url);
  const withT = (p) => `${base.origin}${p}?t=${base.searchParams.get('t')}`;
  const post = (p, o) => raw(withT(p), { method: 'POST', body: JSON.stringify(o) });
  try {
    assert.equal((await raw(`${base.origin}/api/state`)).status, 403); // no token
    assert.equal((await raw(`${base.origin}/api/state?t=wrong`)).status, 403);
    assert.equal((await raw(withT('/api/state'), { host: 'evil.example.com' })).status, 403); // DNS-rebinding style
    const page = await raw(s.url);
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /default-src 'self'/);
    assert.ok(!page.headers['access-control-allow-origin'], 'no CORS');
    assert.ok(!/type="password"/i.test(page.body), 'UI must not contain a password field');

    const bad = await post('/api/profile', { passengers: [{ name: 'asha@okaxis', age: 30, gender: 'F' }], contact: {} });
    assert.equal(bad.status, 400);
    const ok = await post('/api/profile', { passengers: [{ name: 'Asha Rao', age: 31, gender: 'F', berth: 'LB', password: 'x' }], contact: { mobile: '9876543210' } });
    assert.equal(ok.status, 200);
    assert.ok(!fs.readFileSync(path.join(process.env.IRCTC_ASSISTANT_HOME, 'profile.json'), 'utf8').includes('"password"'));

    const pl = JSON.parse((await post('/api/plan', { text: '12951 NDLS BCT 2099-01-01 3A' })).body);
    assert.ok(pl.problems.length >= 0);

    // far-future-but-legal date, automation mode without accepting risk => refused
    const far = '12951 from NDLS to BCT on 2027-06-01 3A';
    assert.equal((await post('/api/arm', { text: far, mode: 'auto' })).status, 400);
    // assist mode needs no automation, starts, blocks a second job, and can be stopped
    assert.equal((await post('/api/arm', { text: far, mode: 'assist' })).status, 200);
    assert.equal((await post('/api/arm', { text: far, mode: 'assist' })).status, 409);
    await post('/api/stop', {});
    await new Promise((r) => setTimeout(r, 300));
    const st = JSON.parse((await raw(withT('/api/state'))).body);
    assert.equal(st.running, null);
    assert.ok(st.events.some((e) => e.stage === 'wait'));
  } finally {
    await s.close();
  }
});
