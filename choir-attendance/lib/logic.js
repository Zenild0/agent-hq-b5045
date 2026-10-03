// Pure rules for the choir: seasons, leaves, points, scoreboard.
// A "season" (choir year) runs April 1 -> March 31 and is identified by the
// calendar year it starts in (season 2026 = Apr 2026 .. Mar 2027).

export const REMARKS = [
  'Late',
  'Not paying attention',
  'Book incomplete',
  'Talking / disruptive',
  'Well behaved',
  'Helped others',
];

export const STATUSES = ['present', 'absent', 'excused'];
export const TYPES = ['saturday', 'sunday'];

export const DEFAULT_SETTINGS = {
  satPoints: 1, // Saturday practice
  sunPoints: 2, // Sunday mass
  maxLeaves: 5, // more than this in a season => out until next April
  latePointsFactor: 0.5, // a "Late" present earns this share of the points
  countSundayAbsences: false, // by default only Saturday practice absences are leaves
  firstSeason: null, // season (start year) that ends at Easter; null = auto
};

const pad = (n) => String(n).padStart(2, '0');

export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function defaultType(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? 'sunday' : 'saturday';
}

export function seasonOf(date) {
  const y = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 4 ? y : y - 1;
}

export function seasonRange(season) {
  return { start: `${season}-04-01`, end: `${season + 1}-03-31` };
}

export function seasonLabel(season) {
  return `April ${season} – March ${season + 1}`;
}

// Western (Gregorian) Easter Sunday, "anonymous" algorithm.
export function easterDate(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(month)}-${pad(day)}`;
}

export function firstSeason(db, today) {
  if (Number.isInteger(db.settings.firstSeason)) return db.settings.firstSeason;
  const dates = Object.values(db.sessions).map((s) => s.date).sort();
  return seasonOf(dates[0] ?? today);
}

// First season: prize at Easter. Every later season: prize at end of December.
export function prizeInfo(db, season, today) {
  const { end } = seasonRange(season);
  if (season === firstSeason(db, today)) {
    const easter = easterDate(season + 1);
    return { label: 'Easter', date: easter > end ? end : easter };
  }
  return { label: 'December', date: `${season}-12-31` };
}

export function pointsFor(entry, type, settings) {
  if (!entry || entry.status !== 'present') return 0;
  const base = type === 'sunday' ? settings.sunPoints : settings.satPoints;
  const late = entry.remarks?.includes('Late');
  return late ? base * settings.latePointsFactor : base;
}

export function isLeave(entry, type, settings) {
  if (!entry || entry.status !== 'absent') return false; // 'excused' (sick/hospital) never counts
  return type === 'saturday' || settings.countSundayAbsences;
}

function sessionsInRange(db, from, to) {
  return Object.values(db.sessions)
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

// Season-wide leave tally + points inside [from, to] (defaults to whole season).
export function childStats(db, childId, season, from, to) {
  const range = seasonRange(season);
  const pFrom = from ?? range.start;
  const pTo = to ?? range.end;
  const s = db.settings;
  const stats = {
    leaves: 0, leaveDates: [], points: 0,
    present: 0, late: 0, absent: 0, excused: 0, sessions: 0,
  };
  for (const sess of sessionsInRange(db, range.start, range.end)) {
    const entry = sess.entries[childId];
    if (!entry?.status) continue;
    if (isLeave(entry, sess.type, s)) {
      stats.leaves += 1;
      stats.leaveDates.push(sess.date);
    }
    if (sess.date < pFrom || sess.date > pTo) continue;
    stats.sessions += 1;
    stats.points += pointsFor(entry, sess.type, s);
    if (entry.status === 'present') {
      stats.present += 1;
      if (entry.remarks?.includes('Late')) stats.late += 1;
    } else stats[entry.status] += 1;
  }
  stats.exceeded = stats.leaves > s.maxLeaves;
  stats.leftOn = stats.exceeded ? stats.leaveDates[s.maxLeaves] : null;
  stats.leavesLeft = Math.max(0, s.maxLeaves - stats.leaves);
  return stats;
}

// Ranked board for [from, to]. Children who exceeded the leave limit stay
// visible but are not eligible for the prize. Ties share a rank.
export function scoreboard(db, season, from, to) {
  const rows = db.children
    .filter((c) => c.active)
    .map((c) => {
      const st = childStats(db, c.id, season, from, to);
      return {
        id: c.id, name: c.name, points: st.points, leaves: st.leaves,
        present: st.present, late: st.late, eligible: !st.exceeded,
      };
    })
    .sort((a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      b.points - a.points || a.leaves - b.leaves || a.name.localeCompare(b.name));
  let rank = 0;
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const tied = prev && prev.eligible === r.eligible && prev.points === r.points && prev.leaves === r.leaves;
    if (!tied) rank = i + 1;
    r.rank = r.eligible ? rank : null;
  });
  return rows;
}

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${pad(last)}` };
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
