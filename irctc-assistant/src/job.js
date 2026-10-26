import { parseRequest } from './parse.js';
import { validateBooking } from './validate.js';
import { openingInstant, formatIST, waitUntil } from './schedule.js';
import { fromISO } from './dates.js';
import { CLASSES, QUOTAS, BERTHS, GENDERS } from './constants.js';
import { runBooking } from './driver.js';
import { appendHistory } from './store.js';
import { notify } from './notify.js';

/** Parse + validate + compute the opening instant. Pure; safe to call on every keystroke. */
export function plan(text, profile, now = new Date()) {
  const { request, issues } = parseRequest(text, now);
  const { errors, warnings } = validateBooking({ request, passengers: profile.passengers, contact: profile.contact }, now);
  const problems = issues.length ? [...issues, ...errors.filter((e) => /assenger|obile/.test(e))] : errors;
  const openAt = fromISO(request.date) ? openingInstant(request.date) : null;
  return { request, problems, warnings, openAt, openNow: openAt ? openAt.getTime() <= now.getTime() : false };
}

export function bookingSheet(request, profile) {
  const lines = [
    `Train ${request.trainNo}   ${request.from} -> ${request.to}   ${request.date}`,
    `Class ${request.travelClass} (${CLASSES[request.travelClass]})   Quota ${QUOTAS[request.quota]}`,
    ...profile.passengers.map((p, i) => `  ${i + 1}. ${p.name}, ${p.age}, ${GENDERS[p.gender]}, berth: ${BERTHS[p.berth ?? 'NP']}`),
    profile.contact.mobile ? `Mobile ${profile.contact.mobile}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * mode 'auto'  : browser assistant (fills forms; you do login, captcha, UPI).
 * mode 'assist': NO automation at all - just the timer, alerts and a copy-ready sheet.
 */
export async function runJob({ mode = 'auto', request, profile, openAt, bus, signal, hooks, driverOptions = {} }) {
  const sheet = bookingSheet(request, profile);
  bus.log('plan', `\n${sheet}`);
  if (mode === 'assist') {
    if (openAt && openAt > Date.now()) {
      bus.log('wait', `Booking opens ${formatIST(openAt)}. You will be alerted 10 minutes before (to log in) and at opening.`);
      const loginAt = new Date(openAt.getTime() - 10 * 60_000);
      if (loginAt > Date.now()) {
        await waitUntil(loginAt, { signal });
        bus.log('login', 'Log in to IRCTC now (check your Aadhaar verification, wallet and passenger list).', { needsHuman: true });
        notify('IRCTC', 'Log in now - booking opens in 10 minutes');
      }
      await waitUntil(openAt, { signal });
    }
    bus.log('open', 'BOOKING IS OPEN - go go go. Details above.', { needsHuman: true });
    notify('IRCTC', 'Booking is open now!');
    return { mode };
  }
  const result = await runBooking({
    request, passengers: profile.passengers, contact: profile.contact, options: profile.options, openAt, bus, signal,
    hooks: { onHumanNeeded: ({ stage, message }) => (notify('IRCTC assistant', `${stage}: ${message}`), hooks?.onHumanNeeded?.({ stage, message })) },
    ...driverOptions,
  });
  appendHistory({ pnr: result.pnr, status: result.status, train: request.trainNo, from: request.from, to: request.to, date: request.date, class: request.travelClass });
  return result;
}
