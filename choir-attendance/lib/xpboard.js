// The training XP leaderboard (server side). The phone earns XP and reports it; the server keeps a small record per child,
// limits what it will believe (a day never counts more than the cap, dates must be recent), and ranks only children whose
// paid year is active. Switched on and off by the teacher in Settings; nothing is kept while it is off.
import { weekKey, titleFor, DAY_CAP } from '../public/xp.js';

const dayMs = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export const emptyXp = () => ({ days: {}, total: 0, streak: 0, best: 0, units: 0, updated: '' });

// days: { 'YYYY-MM-DD': xp earned that day }. Applies the daily cap per day; returns how many XP were accepted.
export function recordXp(kidXp, report, today) {
  const x = kidXp;
  let accepted = 0;
  for (const [d, raw] of Object.entries(report.days ?? {})) {
    if (!isDay(d) || d > today || d < addDays(today, -14)) continue; // only the last two weeks, never the future
    const want = num(raw, DAY_CAP);
    const have = x.days[d] ?? 0;
    const room = Math.max(0, DAY_CAP - have);
    const take = Math.min(want, room);
    if (take > 0) { x.days[d] = have + take; x.total += take; accepted += take; }
  }
  for (const d of Object.keys(x.days)) if (d < addDays(today, -70)) delete x.days[d];
  if ('streak' in report) x.streak = num(report.streak, 400); // only what the phone sent is updated
  if ('best' in report || 'streak' in report) x.best = Math.max(x.best, num(report.best, 400), x.streak);
  if ('units' in report) x.units = num(report.units, 100);
  x.updated = today;
  return accepted;
}

export const weekXpOf = (x, today) => { const wk = weekKey(today); let s = 0; for (const [d, v] of Object.entries(x?.days ?? {})) if (weekKey(d) === wk) s += v; return s; };

// rows: [{ id, name, ... , xp }] ranked with ties sharing a rank.
function rank(rows) {
  rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  let r = 0;
  rows.forEach((row, i) => { if (!(i && rows[i - 1].xp === row.xp)) r += 1; row.rank = r; });
  return rows;
}

// children: [{ id, name, ... }] already limited to the paid, active, non-guest children.
export function buildBoard(xpOf, children, today, meId, decorate) {
  const mk = (kind) => rank(children.map((c) => ({ ...decorate(c), xp: kind === 'week' ? weekXpOf(xpOf(c.id), today) : xpOf(c.id)?.total ?? 0, streak: xpOf(c.id)?.streak ?? 0, units: xpOf(c.id)?.units ?? 0 })).filter((r) => r.xp > 0));
  const out = {};
  for (const kind of ['week', 'all']) {
    const rows = mk(kind);
    const top = rows.slice(0, 10).map((r) => ({ ...r, title: titleFor(kind === 'all' ? r.xp : xpOf(r.id)?.total ?? 0) }));
    const mine = rows.find((r) => r.id === meId);
    out[kind] = { top, me: mine && !top.some((t) => t.id === meId) ? { rank: mine.rank, xp: mine.xp } : null, total: rows.length };
  }
  return { weekLabel: weekKey(today), ...out };
}
