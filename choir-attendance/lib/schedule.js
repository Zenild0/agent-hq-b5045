// Practice schedule: "every Saturday at 7 pm" plus exceptions (a changed time, a cancelled day,
// or a special day such as a feast rehearsal). All dates and times are Indian time (IST).

export const IST_OFFSET_MIN = 330;
const DAY = 86400000;
const PRACTICE_MINUTES = 120; // today's practice stays "next" until this long after it starts

export const defaultSchedule = (from) => ({ weekday: 6, time: '19:00', note: 'Carry your books', from, days: {} });

const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const ms = (date) => Date.parse(`${date}T00:00:00Z`);

// "Now" in IST as { date: 'YYYY-MM-DD', minutes: minutes since midnight }.
export function istNow(nowMs = Date.now()) {
  const d = new Date(nowMs + IST_OFFSET_MIN * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(ms(v)) === v;

// Every practice day between two dates (inclusive), oldest first. Cancelled days stay in the list, flagged.
export function scheduleDays(schedule, start, end) {
  const out = new Map();
  const add = (date, extra = {}) => {
    const o = schedule.days[date] || {};
    out.set(date, {
      date, time: o.time || schedule.time, cancelled: Boolean(o.cancelled),
      label: o.label || '', note: o.note || '', special: Boolean(o.special) || Boolean(extra.special),
    });
  };
  for (let t = ms(start); t <= ms(end); t += DAY) {
    const date = iso(t);
    if (new Date(t).getUTCDay() === schedule.weekday && date >= schedule.from) add(date);
  }
  for (const [date, o] of Object.entries(schedule.days)) {
    if (o.special && date >= start && date <= end) add(date, { special: true });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// The next practice that has not been cancelled (today's counts until it has been on for a while).
export function nextPractice(schedule, now = istNow()) {
  const end = iso(ms(now.date) + 400 * DAY);
  return scheduleDays(schedule, now.date, end).find((d) => {
    if (d.cancelled) return false;
    return d.date > now.date || toMinutes(d.time) + PRACTICE_MINUTES > now.minutes;
  }) || null;
}

export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY);
export const shiftDate = (date, n) => iso(ms(date) + n * DAY);
