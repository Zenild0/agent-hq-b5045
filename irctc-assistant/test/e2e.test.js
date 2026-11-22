import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startMock } from '../src/mock/mock-irctc.js';
import { runBooking } from '../src/driver.js';
import { createBus } from '../src/log.js';

const CHROME = ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', process.env.IRCTC_BROWSER_PATH].find((p) => p && fs.existsSync(p));

const request = { trainNo: '12951', from: 'NDLS', to: 'BCT', date: '2026-12-25', travelClass: '3A', quota: 'GN' };
const passengers = [
  { name: 'Asha Rao', age: 31, gender: 'F', berth: 'LB' },
  { name: 'Ravi Rao', age: 34, gender: 'M', berth: 'NP' },
];

// This plays the *human*: it logs in elsewhere, types the captcha and the UPI ID.
function human(mock, seen) {
  return async ({ stage, page }) => {
    seen.push(stage);
    const typeAsHuman = async (fn) => { await page.evaluate(() => (window.__human = true)); await fn(); await page.evaluate(() => (window.__human = false)).catch(() => {}); };
    if (stage === 'login') await fetch(mock.url + '/__test/login', { method: 'POST' });
    if (stage === 'captcha') await typeAsHuman(async () => { await page.fill('#captcha', 'x7Kp9'); await page.click('#go'); });
    if (stage === 'payment') await typeAsHuman(async () => { await page.fill('#vpa', 'asha@okhdfcbank'); await page.click('#paynow'); });
  };
}

test('end to end against the mock: waits for 8 AM, retries politely, fills forms, hands off to the human, reads PNR',
  { skip: !CHROME && 'no Chrome available', timeout: 90_000 }, async () => {
    const openAt = new Date(Date.now() + 3500);
    const mock = await startMock({ openAt: openAt.getTime() + 2000 }); // server opens 2 s "later" than our clock => forces retries
    const bus = createBus();
    const events = [];
    bus.on('event', (e) => events.push(e));
    const seen = [];
    try {
      const result = await runBooking({
        request, passengers, contact: { mobile: '9876543210' }, options: { autoUpgrade: true }, openAt, bus,
        hooks: { onHumanNeeded: human(mock, seen) },
        baseUrl: mock.url, headless: true, executablePath: CHROME,
        prefillLeadMs: 1500, retryDelayMs: 400, stepTimeoutMs: 6000, keepOpenMs: 0,
      });
      assert.equal(result.pnr, '4412345678');
      assert.deepEqual(seen, ['login', 'captcha', 'payment']); // the ONLY steps a human is asked to do
      // timing: no accepted search before the server opened; and we did retry rather than give up
      assert.ok(mock.state.searchAttempts >= 2, `expected retries, got ${mock.state.searchAttempts}`);
      assert.ok(mock.state.searches[0].at >= mock.state.openAt);
      assert.equal(mock.state.searches[0].date, '25/12/2026');
      assert.match(mock.state.searches[0].from, /NDLS/);
      assert.match(mock.state.searches[0].cls, /3A/);
      // forms
      const b = mock.state.bookings[0];
      assert.deepEqual(b.passengers.map((p) => [p.name, p.age, p.gender, p.berth]), [['Asha Rao', '31', 'Female', 'Lower'], ['Ravi Rao', '34', 'Male', 'No Preference']]);
      assert.equal(b.mobile, '9876543210');
      assert.equal(b.autoUpgrade, true);
      assert.equal(b.confirmOnly, false);
      assert.equal(b.insuranceNo, true);
      assert.equal(b.upi, true);
      // privacy: every keystroke into credential / captcha / UPI fields came from the human
      const driverTouches = mock.state.touches.filter((t) => !t.human);
      assert.deepEqual(driverTouches, [], 'driver must never type into secret fields');
      assert.ok(mock.state.touches.some((t) => t.id === 'captcha' && t.human) && mock.state.touches.some((t) => t.id === 'vpa' && t.human));
      assert.ok(!JSON.stringify(events).includes('x7Kp9') && !JSON.stringify(events).includes('okhdfcbank'), 'secrets must not appear in logs');
    } finally {
      await mock.close();
    }
  });

test('refuses to book a waitlisted/RAC status unless the profile allows it', { skip: !CHROME && 'no Chrome available', timeout: 60_000 }, async () => {
  const mock = await startMock({ openAt: Date.now() - 1000 });
  try {
    await assert.rejects(
      runBooking({ request: { ...request, date: '2026-12-26' }, passengers, openAt: null, bus: createBus(),
        hooks: { onHumanNeeded: human(mock, []) }, baseUrl: mock.url, headless: true, executablePath: CHROME, stepTimeoutMs: 4000, keepOpenMs: 0 }),
      /status is "Sat, 26 Dec RAC 4"/);
    assert.equal(mock.state.bookings.length, 0);
  } finally {
    await mock.close();
  }
});
