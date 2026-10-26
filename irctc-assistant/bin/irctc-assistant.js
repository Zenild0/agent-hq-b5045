#!/usr/bin/env node
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { plan, runJob } from '../src/job.js';
import { loadProfile, saveProfile, loadHistory, home } from '../src/store.js';
import { validatePassengers } from '../src/validate.js';
import { formatIST, measureClockSkew } from '../src/schedule.js';
import { createBus, printEvents } from '../src/log.js';
import { startServer } from '../src/server.js';
import { startMock } from '../src/mock/mock-irctc.js';
import { launchBrowser } from '../src/driver.js';
import { BERTHS, OPEN_HOUR_IST } from '../src/constants.js';

const HELP = `IRCTC Assistant - you say which train, it handles the 8 AM rush; you do login, captcha and UPI.

  ui                                   open the local control panel (recommended)
  book "<which train>" [--assist]      e.g. book "12951 from NDLS to BCT on 25 Dec 3A"
                                       --assist = timer + alerts only, no automation on IRCTC
  parse "<which train>"                show how I understood it and when booking opens
  profile show | add | remove <n> | mobile <10 digits> | option <name> on|off
  history                              past bookings (PNRs)
  doctor                               check browser, clock and storage
  demo                                 rehearse the whole flow against a local fake IRCTC

Data lives in ${home()} (passengers only - never passwords, OTPs, captchas or UPI IDs).`;

const [cmd = 'ui', ...rest] = process.argv.slice(2);
const bus = createBus();
printEvents(bus);
const ac = new AbortController();
process.on('SIGINT', () => (console.log('\nStopping...'), ac.abort(), setTimeout(() => process.exit(130), 1500)));

async function confirmRisk(profile) {
  if (profile.riskAcknowledged) return true;
  console.log(`\nIMPORTANT: IRCTC's terms restrict automated tools and it actively blocks bots. This assistant keeps you in the loop
(you log in, solve the captcha, pay) and never solves captchas or runs in parallel, but your IRCTC account is still at your own risk.
Use --assist for alerts only, with no automation on the IRCTC site at all.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question('Type "I accept" to continue: ')).trim().toLowerCase();
  rl.close();
  if (ans !== 'i accept') return false;
  saveProfile({ ...profile, riskAcknowledged: true });
  return true;
}

function showPlan(p) {
  const r = p.request;
  console.log(`Train ${r.trainNo ?? '?'}  ${r.from ?? '?'} -> ${r.to ?? '?'}  ${r.date ?? '?'}  class ${r.travelClass ?? '?'}  quota ${r.quota}`);
  if (p.openAt) console.log(`Booking opens: ${formatIST(p.openAt)}${p.openNow ? '  (already open)' : ''}`);
  p.warnings.forEach((w) => console.log(`  ! ${w}`));
  p.problems.forEach((w) => console.log(`  x ${w}`));
}

switch (cmd) {
  case 'help': case '--help': case '-h':
    console.log(HELP);
    break;

  case 'ui': {
    const s = await startServer({ port: Number(process.env.PORT) || 0 });
    console.log(`Open this link in your browser (it contains a one-time access token, keep it private):\n\n  ${s.url}\n\nCtrl+C to quit.`);
    break;
  }

  case 'parse': {
    const p = plan(rest.join(' '), loadProfile());
    showPlan(p);
    process.exitCode = p.problems.length ? 1 : 0;
    break;
  }

  case 'book': {
    const { values, positionals } = parseArgs({ args: rest, options: { assist: { type: 'boolean' } }, allowPositionals: true });
    const profile = loadProfile();
    const p = plan(positionals.join(' '), profile);
    showPlan(p);
    if (p.problems.length) process.exit(1);
    const skew = await measureClockSkew();
    if (skew !== null && Math.abs(skew) > 500) console.log(`  ! Your computer's clock is off by about ${(skew / 1000).toFixed(1)} s. Sync it (enable automatic time) before ${OPEN_HOUR_IST}:00.`);
    if (!values.assist && !(await confirmRisk(profile))) process.exit(1);
    console.log('\nLeave this window open, keep the computer awake and plugged in. Ctrl+C cancels.\n');
    try {
      await runJob({ mode: values.assist ? 'assist' : 'auto', request: p.request, profile, openAt: p.openNow ? null : p.openAt, bus, signal: ac.signal });
    } catch (e) {
      console.error(`\n${e.message}`);
      process.exitCode = 1;
    }
    break;
  }

  case 'profile': {
    const profile = loadProfile();
    const [sub = 'show', ...a] = rest;
    if (sub === 'show') {
      console.log(JSON.stringify({ ...profile, riskAcknowledged: undefined }, null, 2));
    } else if (sub === 'add') {
      const { values } = parseArgs({ args: a, options: { name: { type: 'string' }, age: { type: 'string' }, gender: { type: 'string' }, berth: { type: 'string', default: 'NP' } } });
      const pax = { name: values.name, age: Number(values.age), gender: String(values.gender ?? '').toUpperCase(), berth: values.berth.toUpperCase() };
      const { errors } = validatePassengers([pax], profile.contact);
      if (errors.length) (console.error(errors.join('\n') + `\nBerth is one of: ${Object.keys(BERTHS).join(' ')}`), process.exit(1));
      saveProfile({ ...profile, passengers: [...profile.passengers, pax] });
      console.log('Saved.');
    } else if (sub === 'remove') {
      const i = Number(a[0]) - 1;
      if (!profile.passengers[i]) (console.error('No such passenger number.'), process.exit(1));
      profile.passengers.splice(i, 1);
      saveProfile(profile);
      console.log('Removed.');
    } else if (sub === 'mobile') {
      const { errors } = validatePassengers([{ name: 'X', age: 1, gender: 'M' }], { mobile: a[0] });
      if (errors.length) (console.error(errors.join('\n')), process.exit(1));
      saveProfile({ ...profile, contact: { mobile: a[0] } });
      console.log('Saved.');
    } else if (sub === 'option') {
      if (!(a[0] in profile.options) || !['on', 'off'].includes(a[1])) (console.error(`Usage: profile option <${Object.keys(profile.options).join('|')}> on|off`), process.exit(1));
      saveProfile({ ...profile, options: { ...profile.options, [a[0]]: a[1] === 'on' } });
      console.log('Saved.');
    } else console.log(HELP);
    break;
  }

  case 'history':
    for (const h of loadHistory()) console.log(`${h.at.slice(0, 10)}  ${h.train} ${h.from}->${h.to}  ${h.date} ${h.class}  PNR ${h.pnr ?? '(see browser)'}  ${h.status ?? ''}`);
    break;

  case 'doctor': {
    console.log(`Node ${process.version} ${Number(process.versions.node.split('.')[0]) >= 20 ? 'ok' : '- need 20+'}`);
    console.log(`Data folder: ${home()}`);
    try {
      const b = await launchBrowser({ headless: true });
      console.log(`Browser: ok (${b.version()})`);
      await b.close();
    } catch (e) {
      console.log(`Browser: NOT FOUND - install Google Chrome, or set IRCTC_BROWSER_PATH to a Chrome/Chromium executable.\n  (${String(e.message).split('\n')[0]})`);
    }
    const skew = await measureClockSkew();
    console.log(skew === null ? 'Clock: could not check (offline?)' : `Clock offset: ${skew} ms ${Math.abs(skew) < 500 ? 'ok' : '- SYNC YOUR CLOCK'}`);
    const p = loadProfile();
    console.log(`Passengers saved: ${p.passengers.length}${p.passengers.length ? '' : '  (add with: profile add --name ... --age ... --gender ...)'}`);
    break;
  }

  case 'demo': {
    // Rehearsal against a local fake IRCTC. You play the human: click LOGIN > Sign In, type any captcha, any UPI ID.
    const mock = await startMock({ openAt: Date.now() + 25_000 });
    const profile = loadProfile();
    if (!profile.passengers.length) profile.passengers = [{ name: 'Demo Traveller', age: 30, gender: 'M', berth: 'NP' }];
    const request = { trainNo: '12951', from: 'NDLS', to: 'BCT', date: '2026-12-25', travelClass: '3A', quota: 'GN' };
    console.log(`Fake IRCTC at ${mock.url} (opens for booking in 25 s). Follow the "YOUR TURN" prompts in the browser window.\n`);
    try {
      await runJob({ mode: 'auto', request, profile, openAt: new Date(Date.now() + 20_000), bus, signal: ac.signal,
        driverOptions: { baseUrl: mock.url, prefillLeadMs: 8000, keepOpenMs: 5000 } });
    } catch (e) { console.error(e.message); process.exitCode = 1; }
    await mock.close();
    break;
  }

  default:
    console.log(HELP);
    process.exitCode = 1;
}
