import { chromium } from 'playwright-core';
import { IRCTC_BASE_URL } from './constants.js';
import { toDDMMYYYY, fromISO } from './dates.js';
import { waitUntil, formatIST } from './schedule.js';
import { sel, paths, classLabel, quotaLabel } from './selectors.js';
import { BERTHS, GENDERS } from './constants.js';

/*
 * What this module does NOT do, by design (and tests/e2e asserts the first three):
 *   - never types into the login, captcha, OTP or UPI/VPA fields -- those are "human gates";
 *   - never reads or logs page content except the final confirmation text (for the PNR);
 *   - never records traces, HARs, videos or screenshots (they would contain credentials);
 *   - never persists cookies/storage: the browser context is incognito-style and discarded;
 *   - never retries faster than once every `retryDelayMs`, and runs exactly one session.
 */

const DEFAULTS = {
  baseUrl: IRCTC_BASE_URL,
  headless: false,
  loginTimeoutMs: 15 * 60_000,
  humanTimeoutMs: 10 * 60_000,
  paymentTimeoutMs: 15 * 60_000,
  stepTimeoutMs: 15_000,
  maxSearchAttempts: 12,
  retryDelayMs: 1500,
  prefillLeadMs: 20_000,
  keepOpenMs: 20_000,
};

export async function launchBrowser({ headless, executablePath } = {}) {
  const path = executablePath || process.env.IRCTC_BROWSER_PATH;
  const common = { headless: Boolean(headless) };
  if (path) return chromium.launch({ ...common, executablePath: path });
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ ...common, channel });
    } catch {
      /* try the next one */
    }
  }
  return chromium.launch(common); // Playwright's own Chromium, if the user ran `npx playwright-core install chromium`
}

export async function runBooking({ request, passengers, contact = {}, options = {}, openAt, bus, hooks = {}, signal, ...cfg }) {
  const c = { ...DEFAULTS, ...cfg };
  const log = (stage, message, extra) => bus?.log(stage, message, extra);
  const origin = new URL(c.baseUrl).origin;
  let browser;
  const abort = () => browser?.close().catch(() => {});
  signal?.addEventListener('abort', abort, { once: true });

  try {
    log('launch', 'Opening a private browser window (nothing is saved to disk).');
    browser = await launchBrowser(c);
    // A fresh, non-persistent context: no profile dir, no storageState, no trace/HAR/video.
    const context = await browser.newContext({ locale: 'en-IN', timezoneId: 'Asia/Kolkata', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    const onSite = () => {
      try {
        return new URL(page.url()).origin === origin;
      } catch {
        return false;
      }
    };
    const human = async (stage, message, done, timeout = c.humanTimeoutMs) => {
      log(stage, `YOUR TURN: ${message}`, { needsHuman: true });
      await page.bringToFront().catch(() => {});
      await hooks.onHumanNeeded?.({ stage, message, page });
      const ok = await poll(done, timeout, signal);
      if (!ok) throw new Error(`Timed out waiting for you at step "${stage}".`);
      log(stage, 'Done, continuing.');
    };
    // Run an automatic step; if it fails (or IRCTC's markup changed) ask the human to do just that step.
    const auto = async (stage, run, done, manualHint) => {
      try {
        await run();
        if (await poll(done, c.stepTimeoutMs, signal)) return;
        log(stage, 'Did not reach the expected page automatically.');
      } catch (e) {
        if (signal?.aborted || e instanceof StopError) throw e;
        log(stage, `Automatic step failed (${firstLine(e)}).`);
      }
      await human(stage, manualHint, done);
    };
    const urlIs = (re) => async () => onSite() && re.test(page.url());
    const visible = (loc) => async () => loc().isVisible().catch(() => false);

    // ---------------- 1. login (human) ----------------
    log('login', 'Opening IRCTC.');
    await page.goto(c.baseUrl + paths.search, { waitUntil: 'domcontentloaded' });
    await sel.loginButton(page).click({ timeout: 5000 }).catch(() => {});
    if (!(await visible(() => sel.loggedInMarker(page))())) {
      await human('login', 'Log in to IRCTC in the browser window: user ID, password, captcha and any OTP. I never touch these fields.', visible(() => sel.loggedInMarker(page)), c.loginTimeoutMs);
    }

    // ---------------- 2. wait for the booking window ----------------
    const fillJourneyExceptDate = async () => {
      await pickStation(page, sel.origin(page), request.from);
      await pickStation(page, sel.destination(page), request.to);
      await sel.classDropdown(page).click();
      await sel.dropdownOption(page, classLabel(request.travelClass)).click();
      await sel.quotaDropdown(page).click();
      await sel.dropdownOption(page, quotaLabel(request.quota)).click();
    };
    if (openAt && openAt.getTime() - Date.now() > 0) {
      log('wait', `Booking for ${request.date} opens at ${formatIST(openAt)}. Waiting - keep this computer awake and online.`);
      const prefillAt = new Date(openAt.getTime() - c.prefillLeadMs);
      await waitUntil(prefillAt, { signal, onTick: (left) => left % 60000 < 1000 && log('wait', `${Math.round(left / 1000)}s to go`) });
      if (!(await visible(() => sel.loggedInMarker(page))())) {
        await human('login', 'You were logged out. Log in again.', visible(() => sel.loggedInMarker(page)), c.loginTimeoutMs);
      }
      await fillJourneyExceptDate().catch((e) => log('search', `Pre-fill skipped (${firstLine(e)}); will fill at opening time.`));
      await waitUntil(openAt, { signal });
    } else {
      log('wait', 'Booking window is already open - going straight to search.');
    }

    // ---------------- 3. search (retry politely until the date opens) ----------------
    let found = false;
    for (let attempt = 1; attempt <= c.maxSearchAttempts && !found; attempt++) {
      try {
        if (!(await sel.origin(page).inputValue().catch(() => ''))) await fillJourneyExceptDate();
        await sel.dateInput(page).fill(toDDMMYYYY(fromISO(request.date)));
        await sel.dateInput(page).press('Enter').catch(() => {});
        await sel.searchButton(page).click();
        found = await poll(urlIs(paths.trainList), 6000, signal);
      } catch (e) {
        if (signal?.aborted) throw e;
        log('search', `Attempt ${attempt} failed (${firstLine(e)}).`);
      }
      if (!found) {
        const msg = await sel.toast(page).textContent({ timeout: 500 }).catch(() => '');
        log('search', `Attempt ${attempt}/${c.maxSearchAttempts}: not available yet${msg ? ` ("${msg.trim().slice(0, 80)}")` : ''}. Retrying in ${c.retryDelayMs}ms.`);
        await sleep(c.retryDelayMs, signal);
      }
    }
    if (!found) await human('search', 'Search for the train yourself (stations, date, class) and open the results list.', urlIs(paths.trainList));

    // ---------------- 4. pick train / class / date ----------------
    let status = '';
    await auto('select', async () => {
      const card = sel.trainCard(page, request.trainNo);
      await card.waitFor({ state: 'visible', timeout: c.stepTimeoutMs });
      await sel.classTab(card, request.travelClass).click();
      const cell = sel.availabilityCell(card, request.date);
      await cell.waitFor({ state: 'visible', timeout: c.stepTimeoutMs });
      status = ((await cell.innerText()) ?? '').replace(/\s+/g, ' ').trim();
      log('select', `Availability: ${status}`);
      if (!/available/i.test(status) && !(options.acceptWaitlist && /\b(rac|wl|gnwl|rlwl)/i.test(status))) {
        throw new StopError(`Not booking - status is "${status}". (Allow RAC/waitlist in your profile options to override.)`);
      }
      await cell.click();
      await sel.bookNow(card).click();
    }, urlIs(paths.passengers), 'Pick the train, class and date, then press "Book Now".');

    // ---------------- 5. passengers ----------------
    await auto('passengers', async () => {
      await sel.passengerRows(page).first().waitFor({ timeout: c.stepTimeoutMs });
      for (let i = 0; i < passengers.length; i++) {
        if ((await sel.passengerRows(page).count()) <= i) await sel.addPassenger(page).click();
        const row = sel.passengerRows(page).nth(i);
        const p = passengers[i];
        await sel.pName(row).fill(p.name);
        await sel.pAge(row).fill(String(p.age));
        await sel.pGender(row).selectOption({ label: GENDERS[p.gender] });
        if (p.berth && p.berth !== 'NP') await sel.pBerth(row).selectOption({ label: BERTHS[p.berth] }).catch(() => log('passengers', `Berth preference for passenger ${i + 1} not offered for this class; skipped.`));
      }
      if (contact.mobile) await sel.mobile(page).fill(contact.mobile).catch(() => {});
      await setChecked(sel.autoUpgrade(page), Boolean(options.autoUpgrade));
      await setChecked(sel.confirmOnly(page), Boolean(options.confirmBerthsOnly));
      if (!options.travelInsurance) await sel.insuranceNo(page).click({ timeout: 2000 }).catch(() => {});
      await sel.payUPI(page).click({ timeout: 3000 }).catch(() => log('passengers', 'Could not preselect UPI; choose it at the payment step.'));
      log('passengers', `Filled ${passengers.length} passenger(s). Please eyeball them.`);
      await sel.continueButton(page).click();
    }, urlIs(paths.review), 'Fill the passenger details and press Continue.');

    // ---------------- 6. review page: captcha (human) ----------------
    await human('captcha', 'Check the passenger/fare summary, type the CAPTCHA shown and press Continue. I do not read the captcha.', urlIs(paths.payment));

    // ---------------- 7. payment page: select UPI and hand over ----------------
    await sel.payUPI(page).click({ timeout: 3000 }).catch(() => {});
    await sel.payAndBook(page).click({ timeout: 5000 }).catch(() => log('payment', 'Press "Pay & Book" yourself.'));
    await human('payment', 'Pay with UPI: enter your UPI ID on the payment page and approve the request in your UPI app. I do not see or store it.', urlIs(paths.confirm), c.paymentTimeoutMs);

    // ---------------- 8. confirmation ----------------
    const text = ((await sel.confirmText(page).innerText({ timeout: 5000 }).catch(() => '')) ?? '').replace(/[ \t]+/g, ' ');
    const pnr = /PNR[^0-9]{0,25}(\d{10})/i.exec(text)?.[1] ?? null;
    const ticketStatus = /\b(CNF|CONFIRMED|RAC|WL\s*\d+|RLWL\s*\d+|GNWL\s*\d+)\b/i.exec(text)?.[1] ?? null;
    log('done', pnr ? `Booked! PNR ${pnr}${ticketStatus ? ` (${ticketStatus})` : ''}.` : 'Reached the confirmation page - read the PNR from the browser window.', { pnr });
    await sleep(c.keepOpenMs, signal);
    return { pnr, status: ticketStatus, request };
  } finally {
    signal?.removeEventListener('abort', abort);
    await browser?.close().catch(() => {});
  }
}

export class StopError extends Error {}

// ---------- helpers ----------
async function pickStation(page, input, value) {
  await input.click();
  await input.fill('');
  await input.pressSequentially(value, { delay: 60 });
  const opts = sel.autocompleteOptions(page);
  await opts.first().waitFor({ timeout: 5000 });
  const isCode = /^[A-Z]{2,5}$/.test(value);
  const want = isCode ? new RegExp(`-\\s*${value}\\s*$`, 'i') : new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const match = opts.filter({ hasText: want }).first();
  if (!(await match.count())) throw new Error(`No station suggestion matching "${value}"`);
  await match.click();
}

async function setChecked(locator, want) {
  const el = locator;
  if ((await el.count().catch(() => 0)) === 0) return;
  if ((await el.isChecked().catch(() => want)) !== want) await el.click({ timeout: 2000 }).catch(() => {});
}

async function poll(fn, timeoutMs, signal) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (signal?.aborted) throw new Error('Cancelled');
    if (await fn().catch(() => false)) return true;
    await sleep(250, signal);
  }
  return false;
}

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(id), resolve()), { once: true });
  });
const firstLine = (e) => String(e?.message ?? e).split('\n')[0].slice(0, 120);
