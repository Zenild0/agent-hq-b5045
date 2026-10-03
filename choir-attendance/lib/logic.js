// Pure rules for the choir: seasons, leaves, points, leaderboards, achievers.
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

// saturday = regular practice, sunday = regular mass,
// practice = rehearsal for a feast, feast = the feast mass itself.
export const TYPES = ['saturday', 'sunday', 'practice', 'feast'];
export const OCCASION_TYPES = ['practice', 'feast'];

export const EVENTS = [
  'Christmas',
  'New Year',
  'Maundy Thursday',
  'Good Friday',
  'Easter',
  "Mother Mary's Feast",
  'Communion Mass',
  'Confirmation Mass',
];

export const DEFAULT_SETTINGS = {
  satPoints: 1, // Saturday practice
  sunPoints: 2, // Sunday mass
  practicePoints: 1, // each rehearsal for a feast / special mass
  feastPoints: 2, // the feast / special mass itself
  maxLeaves: 5, // more than this in a season => out until next April
  latePointsFactor: 0.5, // a "Late" present earns this share of the points
  countSundayAbsences: false, // by default only Saturday practice absences are leaves
  firstSeason: null, // season (start year) whose private prize date is Easter; null = auto
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

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// One session per date+type; feast sessions are also keyed by occasion.
export function sessionKey(date, type, event) {
  return OCCASION_TYPES.includes(type) ? `${date}|${type}|${slug(event)}` : `${date}|${type}`;
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

// Teacher-only: first season's prize at Easter, every later season at end of December.
export function prizeInfo(db, season, today) {
  const { end } = seasonRange(season);
  if (season === firstSeason(db, today)) {
    const easter = easterDate(season + 1);
    return { label: 'Easter', date: easter > end ? end : easter };
  }
  return { label: 'December', date: `${season}-12-31` };
}

const BASE_POINTS = { saturday: 'satPoints', sunday: 'sunPoints', practice: 'practicePoints', feast: 'feastPoints' };

export function pointsFor(entry, type, settings) {
  if (!entry || entry.status !== 'present') return 0;
  const base = settings[BASE_POINTS[type]] ?? 0;
  return entry.remarks?.includes('Late') ? base * settings.latePointsFactor : base;
}

// Only compulsory sessions can cost a leave; sick / hospital (excused) never does.
export function isLeave(entry, type, settings) {
  if (!entry || entry.status !== 'absent') return false;
  return type === 'saturday' || (type === 'sunday' && settings.countSundayAbsences);
}

export function photoUrl(child) {
  return child.photoVersion ? `/photos/${child.id}.jpg?v=${child.photoVersion}` : null;
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

// Ranked board for [from, to]. A child counts as "out" once the leave limit was
// passed on or before `to`. Ties share a rank.
//   hideOut: drop children who are out (parent-facing boards)
//   includeInactive: also rank children who have left the choir (history)
export function scoreboard(db, season, from, to, { hideOut = false, includeInactive = false } = {}) {
  let rows = db.children
    .filter((c) => c.active || includeInactive)
    .map((c) => {
      const st = childStats(db, c.id, season, from, to);
      return {
        id: c.id, name: c.name, photo: photoUrl(c), points: st.points, leaves: st.leaves,
        present: st.present, late: st.late, eligible: !(st.leftOn && st.leftOn <= to),
      };
    });
  if (hideOut) rows = rows.filter((r) => r.eligible);
  rows.sort((a, b) =>
    Number(b.eligible) - Number(a.eligible) ||
    b.points - a.points || a.leaves - b.leaves || a.name.localeCompare(b.name));
  let rank = 0;
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const tied = prev && prev.eligible === r.eligible && prev.points === r.points; // equal points share a rank
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

export function seasonsWithData(db, today) {
  const set = new Set(Object.values(db.sessions).map((s) => seasonOf(s.date)));
  set.add(seasonOf(today));
  return [...set].sort((a, b) => b - a);
}

// Everyone sharing the highest (non-zero) score wins.
function winnersOf(rows) {
  const top = rows.find((r) => r.eligible)?.points ?? 0;
  if (top <= 0) return [];
  return rows.filter((r) => r.eligible && r.points === top)
    .map(({ id, name, photo, points }) => ({ id, name, photo, points }));
}

const hasSessions = (db, from, to) => Object.values(db.sessions).some((s) => s.date >= from && s.date <= to);

// Month-by-month winners for a season (months that have started and have data).
export function monthlyAchievers(db, season, today) {
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const m = ((i + 3) % 12) + 1;
    const month = `${m >= 4 ? season : season + 1}-${pad(m)}`;
    const { start, end } = monthRange(month);
    if (start > today || !hasSessions(db, start, end)) continue;
    const rows = scoreboard(db, season, start, end, { includeInactive: true });
    out.push({ month, label: monthLabel(month), inProgress: today <= end, winners: winnersOf(rows) });
  }
  return out.reverse();
}

// Whole-season winners, newest first.
export function yearlyAchievers(db, today) {
  const cur = seasonOf(today);
  return seasonsWithData(db, today)
    .filter((s) => { const r = seasonRange(s); return hasSessions(db, r.start, r.end); })
    .map((season) => {
      const r = seasonRange(season);
      const rows = scoreboard(db, season, r.start, r.end, { includeInactive: true });
      return { season, label: seasonLabel(season), inProgress: season === cur, winners: winnersOf(rows) };
    });
}

// Who attended each practice / mass for every special occasion in a season.
export function occasions(db, season) {
  const range = seasonRange(season);
  const sessions = sessionsInRange(db, range.start, range.end).filter((s) => OCCASION_TYPES.includes(s.type));
  const byEvent = new Map();
  for (const s of sessions) {
    if (!byEvent.has(s.event)) byEvent.set(s.event, []);
    byEvent.get(s.event).push(s);
  }
  return [...byEvent].map(([event, list]) => {
    const children = db.children
      .filter((c) => c.active || list.some((s) => s.entries[c.id]?.status))
      .map((c) => {
        const cells = list.map((s) => s.entries[c.id]?.status ?? null);
        const points = list.reduce((sum, s) => sum + pointsFor(s.entries[c.id], s.type, db.settings), 0);
        return {
          id: c.id, name: c.name, photo: photoUrl(c), cells, points,
          attended: cells.filter((x) => x === 'present').length,
        };
      })
      .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name));
    return {
      event,
      sessions: list.map((s, i) => ({
        date: s.date, type: s.type,
        presentCount: children.filter((c) => c.cells[i] === 'present').length,
      })),
      children,
    };
  });
}
