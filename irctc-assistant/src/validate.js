import { CLASSES, QUOTAS, GENDERS, BERTHS, MAX_PASSENGERS, ARP_DAYS, MAX_AHEAD_DAYS, NAME_MAX } from './constants.js';
import { istToday, fromISO, diffDays } from './dates.js';

/** Returns {errors, warnings}. Errors block booking; warnings are shown but allowed. */
export function validateBooking({ request, passengers, contact }, now = new Date()) {
  const errors = [];
  const warnings = [];
  const r = request ?? {};

  if (!/^\d{5}$/.test(r.trainNo ?? '')) errors.push('Train number must be 5 digits.');
  if (!r.from || !r.to) errors.push('Both stations are required.');
  else if (String(r.from).toLowerCase() === String(r.to).toLowerCase()) errors.push('From and To are the same station.');
  if (!CLASSES[r.travelClass]) errors.push(`Class must be one of ${Object.keys(CLASSES).join(', ')}.`);
  if (!QUOTAS[r.quota]) errors.push(`Quota must be one of ${Object.keys(QUOTAS).join(', ')}.`);

  const date = fromISO(r.date);
  if (!date) errors.push('Journey date must be a real date (YYYY-MM-DD).');
  else {
    const ahead = diffDays(date, istToday(now));
    if (ahead < 0) errors.push('Journey date is in the past.');
    else if (ahead > MAX_AHEAD_DAYS) errors.push(`Journey date is more than ${MAX_AHEAD_DAYS} days away.`);
    else if (ahead > ARP_DAYS) warnings.push(`Booking for this date is not open yet (opens ${ahead - ARP_DAYS} day(s) from now); the assistant will wait until it opens.`);
  }

  const pv = validatePassengers(passengers, contact);
  errors.push(...pv.errors);
  warnings.push(...pv.warnings);
  return { errors, warnings };
}

export function validatePassengers(passengers, contact) {
  const errors = [];
  const warnings = [];
  const ps = passengers ?? [];
  if (ps.length < 1) errors.push('Add at least one passenger.');
  if (ps.length > MAX_PASSENGERS) errors.push(`At most ${MAX_PASSENGERS} passengers per ticket.`);
  ps.forEach((p, i) => {
    const who = `Passenger ${i + 1}`;
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(p?.name ?? '')) errors.push(`${who}: name must be letters only.`);
    else if (p.name.length > NAME_MAX) warnings.push(`${who}: IRCTC limits names to about ${NAME_MAX} characters; "${p.name}" may be rejected.`);
    if (!Number.isInteger(p?.age) || p.age < 1 || p.age > 125) errors.push(`${who}: age must be 1-125.`);
    if (!GENDERS[p?.gender]) errors.push(`${who}: gender must be M, F or T.`);
    if (p?.berth && !BERTHS[p.berth]) errors.push(`${who}: berth must be one of ${Object.keys(BERTHS).join(', ')}.`);
  });

  if (contact?.mobile && !/^[6-9]\d{9}$/.test(contact.mobile)) errors.push('Mobile number must be 10 digits starting 6-9.');
  return { errors, warnings };
}
