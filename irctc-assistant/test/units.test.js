import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRequest } from '../src/parse.js';
import { validateBooking } from '../src/validate.js';
import { openingInstant, waitUntil, formatIST } from '../src/schedule.js';
import { assertNoSecrets, saveProfile, loadProfile, appendHistory, loadHistory } from '../src/store.js';

const NOW = new Date('2026-10-26T06:00:00Z'); // 11:30 IST, Mon 26 Oct 2026

test('parser: names, codes, classes, quotas, relative dates', () => {
  const p = (t) => parseRequest(t, NOW);
  assert.deepEqual(p('book 12951 from Mumbai Central to New Delhi on 25 Dec in 3A').request, {
    trainNo: '12951', from: 'Mumbai Central', to: 'New Delhi', date: '2026-12-25', travelClass: '3A', quota: 'GN' });
  assert.equal(p('12951 BCT NDLS 2026-12-25 sleeper ladies').request.quota, 'LD');
  assert.equal(p('12951 BCT NDLS 2026-12-25 sleeper ladies').request.travelClass, 'SL');
  assert.equal(p('12301 from NDLS to HWH tomorrow 2A').request.date, '2026-10-27');
  assert.equal(p('12301 NDLS->HWH in 60 days 2A').request.date, '2026-12-25');
  assert.equal(p('12951 ndls to bct 25/12/2026 3a').request.from, 'NDLS');
  assert.equal(p('12951 NDLS BCT 5 jan 3A').request.date, '2027-01-05'); // year rolls over
  assert.equal(p('12951 NDLS BCT 3 oct 3A').request.date, '2027-10-03'); // already past this year
  assert.ok(p('hello').issues.length >= 3);
  assert.ok(p('12951 NDLS BCT 31 feb 2027 3A').issues.some((i) => /does not exist/.test(i)));
});

test('validator: window, passengers, contact', () => {
  const good = { request: { trainNo: '12951', from: 'NDLS', to: 'BCT', date: '2026-12-25', travelClass: '3A', quota: 'GN' },
    passengers: [{ name: 'Asha Rao', age: 31, gender: 'F', berth: 'LB' }], contact: { mobile: '9876543210' } };
  assert.deepEqual(validateBooking(good, NOW).errors, []);
  const far = { ...good, request: { ...good.request, date: '2027-01-30' } };
  assert.match(validateBooking(far, NOW).warnings[0], /not open yet/);
  assert.ok(validateBooking({ ...good, request: { ...good.request, date: '2026-10-01' } }, NOW).errors.some((e) => /past/.test(e)));
  assert.ok(validateBooking({ ...good, passengers: [] }, NOW).errors.length);
  assert.ok(validateBooking({ ...good, passengers: Array(7).fill(good.passengers[0]) }, NOW).errors.some((e) => /At most 6/.test(e)));
  assert.ok(validateBooking({ ...good, contact: { mobile: '12345' } }, NOW).errors.length);
  assert.ok(validateBooking({ ...good, request: { ...good.request, to: 'ndls' } }, NOW).errors.some((e) => /same station/.test(e)));
});

test('schedule: opening is 08:00 IST, 60 days before the journey', () => {
  const t = openingInstant('2026-12-25');
  assert.equal(formatIST(t), '2026-10-26 08:00:00 IST');
  assert.equal(t.toISOString(), '2026-10-26T02:30:00.000Z');
  assert.equal(formatIST(openingInstant('2027-03-01')), '2026-12-31 08:00:00 IST');
});

test('waitUntil returns at (not before) the target, honours abort, survives coarse sleeps', async () => {
  const target = new Date(Date.now() + 400);
  await waitUntil(target);
  assert.ok(Date.now() >= target.getTime());
  assert.ok(Date.now() - target.getTime() < 60);
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 50);
  await assert.rejects(waitUntil(new Date(Date.now() + 10_000), { signal: ac.signal }), /Cancelled/);
});

test('store refuses secrets in any shape', () => {
  for (const bad of [{ password: 'x' }, { a: { upiPin: '1234' } }, { otp: '1' }, { cvv: '1' }, { note: '4111 1111 1111 1111' }, { x: 'me@okhdfcbank' }, { list: [{ captcha: 'a' }] }])
    assert.throws(() => assertNoSecrets(bad), /Refusing/, JSON.stringify(bad));
  assert.doesNotThrow(() => assertNoSecrets({ name: 'Asha Rao', age: 31, mobile: '9876543210' }));
});

test('profile round-trips, drops unknown keys, file is private', () => {
  process.env.IRCTC_ASSISTANT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'irctc-test-'));
  const saved = saveProfile({ contact: { mobile: '9876543210' }, passengers: [{ name: 'Asha Rao', age: '31', gender: 'f', berth: 'lb', password: 'smuggled' }], options: { acceptWaitlist: 1 } });
  assert.equal(saved.passengers[0].password, undefined);
  assert.deepEqual(loadProfile().passengers[0], { name: 'Asha Rao', age: 31, gender: 'F', berth: 'LB' });
  assert.equal(loadProfile().options.acceptWaitlist, true);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(process.env.IRCTC_ASSISTANT_HOME, 'profile.json')).mode & 0o777, 0o600);
  appendHistory({ pnr: '4412345678', train: '12951' });
  assert.equal(loadHistory().length, 1);
  assert.throws(() => saveProfile({ passengers: [{ name: 'asha@okaxis', age: 3, gender: 'M' }] }), /Refusing/);
});
