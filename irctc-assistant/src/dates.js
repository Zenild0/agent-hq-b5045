import { IST_OFFSET_MIN } from './constants.js';

// A "ymd" is {y, m, d} (m is 1-12) in India time. All arithmetic goes through
// UTC midnight so the machine's own time zone never matters.

export function istToday(now = new Date()) {
  const t = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const utc = ({ y, m, d }) => Date.UTC(y, m - 1, d);

export function addDays(ymd, n) {
  const t = new Date(utc(ymd) + n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export const diffDays = (a, b) => Math.round((utc(a) - utc(b)) / 86400000);

export function isValidYMD({ y, m, d }) {
  if (![y, m, d].every(Number.isInteger) || y < 2000 || y > 2100) return false;
  const t = new Date(utc({ y, m, d }));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const p2 = (n) => String(n).padStart(2, '0');
export const toISO = ({ y, m, d }) => `${y}-${p2(m)}-${p2(d)}`;
export const toDDMMYYYY = ({ y, m, d }) => `${p2(d)}/${p2(m)}/${y}`;

export function fromISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const ymd = { y: +m[1], m: +m[2], d: +m[3] };
  return isValidYMD(ymd) ? ymd : null;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
