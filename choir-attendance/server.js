import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REMARKS, STATUSES, EXCUSE_REASONS, TYPES, EVENTS, OCCASION_TYPES, isValidDate, defaultType, seasonOf, seasonRange,
  seasonLabel, prizeInfo, firstSeason, childStats, scoreboard, monthRange, monthLabel, pointsFor,
  isLeave, remarkDeduction, remarkBonus, sessionKey, photoUrl, monthlyAchievers, yearlyAchievers, occasions, seasonsWithData,
  compareNames, findOccasion, slug,
} from './lib/logic.js';
import { openStore, newCode } from './lib/store.js';
import { applyRound, applyDaily, weeklyBoard, dailyBoard, dailySeed, dailyStreak, maxPlayable, emptyKid, weekKeyOf, istDate, setPaid, isPaid, warmupsLeft, useWarmup, GameError, PaywallError } from './lib/game.js';
import { LEVELS, DAILY_COUNT, STAGES, stageSpec, isTimed } from './public/levels.js';
import { istNow, isDate, isTime, scheduleDays, nextPractice, shiftDate } from './lib/schedule.js';
import { createTar, readTar } from './lib/tar.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = resolve(here, 'public');
const DATA_FILE = process.env.CHOIR_DATA || join(here, 'data', 'db.json');
const PHOTOS = join(dirname(DATA_FILE), 'photos');
const PORT = Number(process.env.PORT) || 3000;
const PIN_ENV = process.env.CHOIR_PIN || ''; // optional: lets the teacher in from other devices
const store = openStore(DATA_FILE);

const today = () => new Date().toISOString().slice(0, 10);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readBody(req, limit = 100_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Request too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

// The teacher area has no PIN: it simply opens only on the computer that runs the app.
// Requests that arrive through a shared link, a proxy or the network are refused, so
// children's details and parent codes can't be reached by anyone else.
// (Optional: set CHOIR_PIN to also allow the teacher in from another device, with that PIN.)
const pinFailures = new Map(); // ip -> { n, resetAt }
function tooManyFailures(map, ip, limit) {
  const f = map.get(ip);
  return Boolean(f && f.resetAt > Date.now() && f.n >= limit);
}
function noteFailure(map, ip) {
  const f = map.get(ip);
  const cur = f && f.resetAt > Date.now() ? f : { n: 0, resetAt: Date.now() + 30 * 60_000 };
  cur.n += 1;
  map.set(ip, cur);
}

// When hosted behind a proxy (CHOIR_TRUST_PROXY=1), the real visitor is in X-Forwarded-For.
const TRUST_HOPS = Number(process.env.CHOIR_TRUST_PROXY) || 0;
function clientIp(req) {
  if (TRUST_HOPS > 0) {
    const parts = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const ip = parts[parts.length - TRUST_HOPS];
    if (ip) return ip;
  }
  return req.socket.remoteAddress || '?';
}

// Public mode (CHOIR_PUBLIC=1): use this whenever the app is shared through a tunnel or hosting.
// The "this computer is the teacher" shortcut is switched off, so the teacher area always needs CHOIR_PIN.
const PUBLIC_MODE = process.env.CHOIR_PUBLIC === '1';

// Online, the PIN is the only thing between the internet and children's details: refuse weak ones.
if (PUBLIC_MODE && PIN_ENV && PIN_ENV.length < 8) {
  console.error('\nCHOIR_PIN is too short for online use. Choose 8 or more letters/digits.\n(If you use start-choir-online.bat, delete choir-pin.txt and run it again.)\n');
  process.exit(1);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function isLocal(req) {
  if (PUBLIC_MODE) return false;
  const host = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const proxied = ['x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'forwarded', 'cf-connecting-ip'].some((h) => req.headers[h]);
  return LOOPBACK.has(req.socket.remoteAddress) && ['localhost', '127.0.0.1', '::1'].includes(host) && !proxied;
}

function checkTeacher(req) {
  if (isLocal(req)) return;
  if (!PIN_ENV) throw new HttpError(403, 'The teacher area only opens on the computer where the app is running.');
  const ip = clientIp(req);
  if (tooManyFailures(pinFailures, ip, 10)) throw new HttpError(429, 'Too many wrong PINs. Please wait a few minutes.');
  const a = Buffer.from(String(req.headers['x-pin'] ?? ''));
  const b = Buffer.from(PIN_ENV);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    noteFailure(pinFailures, ip);
    throw new HttpError(401, 'PIN required');
  }
}

// ---- input cleaning ----------------------------------------------------

const text = (v, max, label) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length > max) throw new HttpError(400, `${label} is too long (max ${max} characters)`);
  return s;
};
const phone = (v, label) => {
  const s = text(v, 20, label);
  if (!/^[0-9+()\-\s]*$/.test(s)) throw new HttpError(400, `${label} can only have digits, + ( ) - and spaces`);
  return s;
};
const cleanName = (v) => {
  const s = text(v, 80, 'Name').replace(/\s+/g, ' ');
  if (!s) throw new HttpError(400, 'Name is required');
  return s;
};

// Applies only the fields present in `body` onto `child`.
function applyProfile(child, body, { teacher }) {
  if (teacher) {
    if ('name' in body) child.name = cleanName(body.name);
    if ('standard' in body) child.standard = text(body.standard, 20, 'Standard');
    if ('joinedYear' in body) {
      const y = body.joinedYear === '' || body.joinedYear === null ? null : Number(body.joinedYear);
      if (y !== null && (!Number.isInteger(y) || y < 1990 || y > 2100)) throw new HttpError(400, 'Year joined must be a 4-digit year');
      child.joinedYear = y;
    }
  }
  if ('contact' in body) child.contact = phone(body.contact, 'Contact number');
  if ('address' in body) child.address = text(body.address, 300, 'Address');
  if ('emergencyName' in body) child.emergencyName = text(body.emergencyName, 80, 'Parent name');
  if ('emergencyPhone' in body) child.emergencyPhone = phone(body.emergencyPhone, 'Parent number');
}

const profileOf = (c) => ({
  id: c.id, name: c.name, photo: photoUrl(c), standard: c.standard, joinedYear: c.joinedYear,
  contact: c.contact, address: c.address, emergencyName: c.emergencyName, emergencyPhone: c.emergencyPhone,
});

function seasonFromQuery(q) {
  const s = q.get('season');
  return s && /^\d{4}$/.test(s) ? Number(s) : seasonOf(today());
}

// ---- shared child detail (attendance history + stats) --------------------

// Every remark / note given to a child, with its date (all years), newest first. Teacher only.
function remarkLogFor(child) {
  const { db } = store;
  return Object.values(db.sessions)
    .filter((s) => { const e = s.entries[child.id]; return e && (e.remarks?.length || e.note); })
    .sort((a, b) => b.date.localeCompare(a.date) || b.type.localeCompare(a.type))
    .map((s) => {
      const e = s.entries[child.id];
      return {
        date: s.date, type: s.type, event: s.event, status: e.status, remarks: e.remarks || [], note: e.note || '',
        deduction: remarkDeduction(e, db.settings), bonus: remarkBonus(e, db.settings),
      };
    });
}

function childDetail(child, season, { teacher = false } = {}) {
  const { db } = store;
  const range = seasonRange(season);
  const history = Object.values(db.sessions)
    .filter((s) => s.date >= range.start && s.date <= range.end && s.entries[child.id]?.status)
    .sort((a, b) => b.date.localeCompare(a.date) || b.type.localeCompare(a.type))
    .map((s) => {
      const e = s.entries[child.id];
      return {
        date: s.date, type: s.type, event: s.event, status: e.status, reason: e.reason || '', remarks: e.remarks || [],
        points: pointsFor(e, s.type, db.settings), deduction: remarkDeduction(e, db.settings), bonus: remarkBonus(e, db.settings), leave: isLeave(e, s.type, db.settings),
        ...(teacher ? { note: e.note || '' } : {}),
      };
    });
  const month = today().slice(0, 7);
  const mr = monthRange(month);
  const yearBoard = scoreboard(db, season, range.start, range.end, { hideOut: true });
  const monthBoard = scoreboard(db, season, mr.start, mr.end, { hideOut: true });
  return {
    ...profileOf(child), season, seasonLabel: seasonLabel(season), settings: db.settings,
    stats: childStats(db, child.id, season), history,
    ...(teacher ? { remarkLog: remarkLogFor(child), gamePaid: isPaid(db.game.kids[child.id]) } : {}),
    yearRank: yearBoard.find((r) => r.id === child.id)?.rank ?? null, yearRanked: yearBoard.length,
    monthRank: monthBoard.find((r) => r.id === child.id)?.rank ?? null, monthLabel: monthLabel(month),
  };
}

// ---- public (leaderboard + achievers only: no private details) ------------


// ---- practice schedule (Indian time) ---------------------------------------

function scheduleView() {
  const { schedule } = store.db;
  const now = istNow();
  const resolve = (d) => ({ ...d, note: d.note || schedule.note || '' });
  const days = scheduleDays(schedule, shiftDate(now.date, -150), shiftDate(now.date, 200)).map(resolve);
  const next = nextPractice(schedule, now);
  return { today: now.date, next: next ? resolve(next) : null, days, usual: { weekday: schedule.weekday, time: schedule.time, note: schedule.note, from: schedule.from } };
}

function updateSchedule(body) {
  const sc = store.db.schedule;
  if ('time' in body) { if (!isTime(body.time)) throw new HttpError(400, 'Time must look like 19:00'); sc.time = body.time; }
  if ('note' in body) sc.note = text(body.note ?? '', 140, 'Note');
  store.save();
}

function setScheduleDay(body) {
  if (!isDate(body.date)) throw new HttpError(400, 'Pick a valid date');
  const sc = store.db.schedule;
  const o = { ...(sc.days[body.date] || {}) };
  if ('time' in body) { if (body.time === '' || body.time === null) delete o.time; else if (isTime(body.time)) o.time = body.time; else throw new HttpError(400, 'Time must look like 19:00'); }
  if ('cancelled' in body) { if (body.cancelled) o.cancelled = true; else delete o.cancelled; }
  if ('label' in body) { const l = text(body.label ?? '', 40, 'Name'); if (l) o.label = l; else delete o.label; }
  if ('note' in body) { const n = text(body.note ?? '', 140, 'Note'); if (n) o.note = n; else delete o.note; }
  if ('special' in body) { if (body.special) o.special = true; else delete o.special; }
  if (o.special && !o.time) o.time = sc.time;
  if (Object.keys(o).length) sc.days[body.date] = o; else delete sc.days[body.date];
  store.save();
}

function removeScheduleDay(date) {
  if (!isDate(date)) throw new HttpError(400, 'Pick a valid date');
  delete store.db.schedule.days[date];
  store.save();
}


// ---- singing game (scores only: no audio is ever sent or stored) -------------

const GAME_GAP_MS = Number(process.env.CHOIR_GAME_GAP_MS ?? 8000);
const roundGate = new Map(); // child id -> { last, day, n } to stop floods
function gameOn() { if (!store.db.settings.gameEnabled) throw new HttpError(403, 'The singing game is switched off right now'); }
function gameThrottle(id) {
  const now = Date.now();
  const g = roundGate.get(id) || { last: 0, day: istDate(), n: 0 };
  if (g.day !== istDate()) { g.day = istDate(); g.n = 0; }
  if (now - g.last < GAME_GAP_MS || g.n >= 300) throw new HttpError(429, 'Slow down a little and try again');
  g.last = now; g.n += 1; roundGate.set(id, g);
}
const gameChildren = () => store.db.children.filter((c) => c.active);
const boardOut = (rows, meId) => {
  const top = rows.slice(0, 10).map((r) => ({ id: r.id, name: r.name, photo: photoUrl(store.db.children.find((c) => c.id === r.id)), won: r.won, ms: r.ms, rank: r.rank, stars: r.stars }));
  const mine = rows.find((r) => r.id === meId);
  return { top, me: mine && !top.some((t) => t.id === meId) ? { rank: mine.rank, won: mine.won, ms: mine.ms } : null, total: rows.length };
};

function gameState(child, q) {
  const { db } = store;
  const kid = db.game.kids[child.id] ?? emptyKid();
  const today = istDate();
  const level = Math.min(LEVELS.length, Math.max(1, Number(q.get('level')) || Math.min(LEVELS.length, maxPlayable(kid))));
  const week = weekKeyOf(today);
  const daily = db.game.daily[today]?.[child.id] ?? null;
  const paid = isPaid(kid);
  return {
    paid,
    warmupLeft: warmupsLeft(kid),
    pay: paid ? null : { price: db.settings.gamePrice, mobile: db.settings.gamePayMobile, upi: db.settings.gameUpi },
    levels: LEVELS.map(({ id, tier, name, how, tol, hold, count }) => ({ id, tier, name, how, tol, hold, count, timed: isTimed(id), stages: STAGES.map((st) => stageSpec(id, st.stage)) })),
    me: { id: child.id, name: child.name, paid, cleared: kid.cleared, stages: kid.stages ?? {}, best: kid.best, badges: kid.badges, maxPlayable: maxPlayable(kid), dailyStreak: dailyStreak(kid, today) },
    // the daily challenge and the weekly boards are part of the full game
    daily: paid ? { date: today, seed: dailySeed(today), count: DAILY_COUNT, mine: daily, board: boardOut(dailyBoard(db.game, gameChildren(), today), child.id) } : null,
    weekly: paid ? { week, level, board: boardOut(weeklyBoard(db.game, gameChildren(), week, level), child.id) } : { week, level, board: null },
  };
}
async function gameApi(req, res, q, child, action) {
  gameOn();
  if (req.method === 'GET' && !action) return send(res, 200, gameState(child, q));
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (action === 'warmup') { // opening the Warm-up room: 3 free sessions, then part of the full game
    try { const w = useWarmup(store.db.game, child.id, istDate()); store.save(); return send(res, 200, w); }
    catch (e) { if (e instanceof PaywallError) throw new HttpError(403, e.message); throw e; }
  }
  const body = await readBody(req, 20_000);
  gameThrottle(child.id);
  try {
    let out;
    if (action === 'round') out = applyRound(store.db.game, child.id, Number(body.level), Number(body.stage), body.results, istDate());
    else if (action === 'daily') out = applyDaily(store.db.game, child.id, istDate(), body.results);
    else throw new HttpError(404, 'Not found');
    store.save();
    return send(res, 200, { ...out, state: gameState(child, new URLSearchParams({ level: String(Number(body.level) || '') })) });
  } catch (e) {
    if (e instanceof PaywallError) throw new HttpError(403, e.message);
    if (e instanceof GameError) throw new HttpError(400, e.message);
    throw e;
  }
}

function publicOverview(q) {
  const { db } = store;
  const season = seasonFromQuery(q);
  const range = seasonRange(season);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('month') || '') ? q.get('month') : today().slice(0, 7);
  const mr = monthRange(month);
  const strip = (rows) => rows.map(({ id, name, photo, points, rank }) => ({ id, name, photo, points, rank }));
  return {
    season, seasonLabel: seasonLabel(season), seasons: seasonsWithData(db, today()),
    settings: { satPoints: db.settings.satPoints, sunPoints: db.settings.sunPoints, feastPoints: db.settings.feastPoints, practicePoints: db.settings.practicePoints, remarkPenalty: db.settings.remarkPenalty, remarkBonus: db.settings.remarkBonus, gameEnabled: Boolean(db.settings.gameEnabled) },
    schedule: scheduleView(),
    month, monthLabel: monthLabel(month),
    monthBoard: strip(scoreboard(db, season, mr.start, mr.end, { hideOut: true })),
    yearBoard: strip(scoreboard(db, season, range.start, range.end, { hideOut: true })),
    monthly: monthlyAchievers(db, season, today()),
    yearly: yearlyAchievers(db, today()),
  };
}

// ---- parent access: one private code per child ---------------------------

const failures = new Map(); // ip -> { n, resetAt }
// How many devices are currently locked out (teacher sees this and can unlock everyone).
function lockedOutCount() {
  const now = Date.now();
  let n = 0;
  for (const [ip, f] of failures) if (f.resetAt > now && f.n >= (ip === '*all*' ? 100 : 5)) n += 1;
  return n;
}

function childByCode(req) {
  const ip = clientIp(req);
  // Short codes are easier to guess, so wrong tries are limited strictly.
  if (tooManyFailures(failures, ip, 5) || tooManyFailures(failures, '*all*', 100)) {
    throw new HttpError(429, 'Too many wrong codes. Please try again in about half an hour.');
  }
  const code = String(req.headers['x-code'] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const child = code.length >= 3 ? store.db.children.find((c) => c.code === code && c.active) : null;
  if (!child) {
    noteFailure(failures, ip);
    noteFailure(failures, '*all*');
    throw new HttpError(401, 'That code was not found. Please check it with your choir teacher.');
  }
  return child;
}

// ---- teacher ------------------------------------------------------------

// Feast sessions belong to an occasion (with its own roster). Reads are lenient, writes are strict.
function occasionFor(date, type, event, { must = true } = {}) {
  if (!OCCASION_TYPES.includes(type)) return { name: '', occ: null };
  const e = text(event, 60, 'Occasion');
  const occ = e ? findOccasion(store.db, seasonOf(date), e) : null;
  if (!occ && must) throw new HttpError(400, 'Create this occasion first (Occasions tab)');
  return { name: occ?.name ?? e, occ };
}

function checkSessionKey(date, type, event, opts) {
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  if (!TYPES.includes(type)) throw new HttpError(400, 'Invalid session type');
  return occasionFor(date, type, event, opts);
}

// Regular sessions: the main group. Occasions: exactly the people picked for that occasion.
function rosterOf(type, occ) {
  const { db } = store;
  if (OCCASION_TYPES.includes(type)) return (occ?.members ?? []).map((id) => db.children.find((c) => c.id === id)).filter((c) => c?.active);
  return db.children.filter((c) => c.active && !c.guest);
}

// Children over the leave limit whom the teacher has not decided about yet.
function pendingDecisions(season) {
  const { db } = store;
  return db.children.filter((c) => c.active && !c.guest).flatMap((c) => {
    const st = childStats(db, c.id, season);
    return st.exceeded && !st.decision ? [{ id: c.id, name: c.name, leaves: st.leaves }] : [];
  });
}

function sessionView(date, type, eventName) {
  const { db } = store;
  const season = seasonOf(date);
  const { name: event, occ } = checkSessionKey(date, type, eventName, { must: false });
  const sess = db.sessions[sessionKey(date, type, event)];
  return {
    date, type, event, season, settings: db.settings, remarkOptions: REMARKS, excuseReasons: EXCUSE_REASONS,
    occasions: db.occasions.filter((o) => o.season === season).map((o) => o.name).sort(),
    missingOccasion: OCCASION_TYPES.includes(type) && !occ,
    pending: pendingDecisions(season),
    children: rosterOf(type, occ).map((c) => {
      const e = sess?.entries[c.id] || {};
      const st = childStats(db, c.id, season);
      return {
        id: c.id, name: c.name, photo: photoUrl(c), standard: c.standard, guest: Boolean(c.guest),
        status: e.status || null, reason: e.reason || '', remarks: e.remarks || [], note: e.note || '',
        leaves: st.leaves, exceeded: st.exceeded && !c.guest, decision: st.decision?.status ?? null,
      };
    }).sort(compareNames),
  };
}

function getOrCreateSession(date, type, event) {
  const { db } = store;
  const key = sessionKey(date, type, event);
  return db.sessions[key] ?? (db.sessions[key] = { date, type, event, entries: {} });
}

function mark(body) {
  const { db } = store;
  const { name: event, occ } = checkSessionKey(body.date, body.type, body.event);
  if (!rosterOf(body.type, occ).some((c) => c.id === body.childId)) {
    throw new HttpError(400, OCCASION_TYPES.includes(body.type) ? 'That child is not part of this occasion' : 'That child is not in the main group');
  }
  const status = body.status ?? null;
  if (status !== null && !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const remarks = Array.isArray(body.remarks) ? body.remarks.filter((r) => REMARKS.includes(r)) : [];
  const reason = status === 'excused' && EXCUSE_REASONS.includes(body.reason) ? body.reason : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const sess = getOrCreateSession(body.date, body.type, event);
  if (status === null && !remarks.length && !note) delete sess.entries[body.childId];
  else sess.entries[body.childId] = { status, reason, remarks: [...new Set(remarks)], note };
  if (!Object.keys(sess.entries).length) delete db.sessions[sessionKey(body.date, body.type, event)];
  store.save();
}

function markAllPresent(body) {
  const { name: event, occ } = checkSessionKey(body.date, body.type, body.event);
  const sess = getOrCreateSession(body.date, body.type, event);
  for (const c of rosterOf(body.type, occ)) {
    const e = (sess.entries[c.id] ??= { status: null, remarks: [], note: '' });
    if (!e.status) e.status = 'present';
  }
  store.save();
}

function updateSettings(body) {
  const s = store.db.settings;
  const num = (v, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, 'Invalid setting value');
    return n;
  };
  for (const k of ['satPoints', 'sunPoints', 'practicePoints', 'feastPoints']) if (k in body) s[k] = num(body[k], 0, 100);
  if ('publicUrl' in body) {
    const u = text(body.publicUrl, 200, 'Website address').replace(/\/+$/, '');
    if (u && !/^https?:\/\/[^\s]+$/.test(u)) throw new HttpError(400, 'Website address must start with http:// or https://');
    s.publicUrl = u;
  }
  if ('maxLeaves' in body) s.maxLeaves = Math.round(num(body.maxLeaves, 0, 100));
  if ('latePointsFactor' in body) s.latePointsFactor = num(body.latePointsFactor, 0, 1);
  if ('remarkPenalty' in body) s.remarkPenalty = num(body.remarkPenalty, 0, 5);
  if ('remarkBonus' in body) s.remarkBonus = num(body.remarkBonus, 0, 5);
  if ('gameEnabled' in body) s.gameEnabled = Boolean(body.gameEnabled);
  if ('gamePrice' in body) s.gamePrice = Math.round(num(body.gamePrice, 0, 100000));
  if ('gamePayMobile' in body) s.gamePayMobile = phone(body.gamePayMobile ?? '', 'Payment number');
  if ('gameUpi' in body) {
    const u = text(body.gameUpi ?? '', 60, 'UPI ID');
    if (u && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(u)) throw new HttpError(400, 'A UPI ID looks like name@bank');
    s.gameUpi = u;
  }
  if ('countSundayAbsences' in body) s.countSundayAbsences = Boolean(body.countSundayAbsences);
  if ('firstSeason' in body) s.firstSeason = body.firstSeason === null || body.firstSeason === '' ? null : Math.round(num(body.firstSeason, 2000, 2200));
  store.save();
}

async function savePhoto(child, image) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(typeof image === 'string' ? image : '');
  if (!m) throw new HttpError(400, 'Photo must be a JPEG image');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 1_000_000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new HttpError(400, 'Photo is too large or not a valid JPEG');
  await mkdir(PHOTOS, { recursive: true });
  await writeFile(join(PHOTOS, `${child.id}.jpg`), buf);
  child.photoVersion = Date.now();
  store.save();
}

// One child per line: "Name" or "Name, Standard". Numbering / bullets are ignored.
// Guests are children who are not in the main choir (only listed for special occasions).
function createChildren(text, { standard = '', joinedYear = null, guest = false } = {}) {
  const { db } = store;
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 300) throw new HttpError(400, 'Please add at most 300 names at a time');
  const seen = new Set(db.children.map((c) => c.name.toLowerCase()));
  const added = [];
  const skipped = [];
  for (const line of lines) {
    const [rawName, rawStd] = line.replace(/^(?:\d+[.)]|[-*\u2022])\s*/, '').split(/[,\t;]/).map((x) => x.trim());
    try {
      const c = {
        id: randomUUID().slice(0, 8), name: '', active: true, joinedOn: today(), code: newCode(db),
        standard: '', joinedYear: Number(today().slice(0, 4)), contact: '', address: '',
        emergencyName: '', emergencyPhone: '', photoVersion: 0, leaveDecisions: {}, guest,
      };
      const fields = { name: rawName, standard: rawStd || standard || '' };
      if (joinedYear) fields.joinedYear = joinedYear;
      applyProfile(c, fields, { teacher: true });
      if (seen.has(c.name.toLowerCase())) { skipped.push({ line, reason: 'already in the list' }); continue; }
      seen.add(c.name.toLowerCase());
      db.children.push(c); // pushed now so the next code is unique
      added.push(c);
    } catch (err) {
      skipped.push({ line, reason: err.message });
    }
  }
  return { added, skipped };
}

const childOut = (c) => ({ ...profileOf(c), code: c.code, active: c.active, guest: Boolean(c.guest), gamePaid: isPaid(store.db.game.kids[c.id]) });

// Teacher-chosen code (e.g. 1001 or CC01): 3-8 letters/digits, unique.
function customCode(value, child) {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 3 || code.length > 8) throw new HttpError(400, 'A code needs 3 to 8 letters or digits, like 1001 or CC01');
  if (store.db.children.some((c) => c !== child && c.code === code)) throw new HttpError(400, `The code ${code} is already used by another child`);
  return code;
}

function bulkAdd(body) {
  if (!String(body.text ?? '').trim()) throw new HttpError(400, 'Type or paste at least one name');
  const { added, skipped } = createChildren(body.text, { standard: body.standard, joinedYear: body.joinedYear });
  store.save();
  return { added: added.map(childOut), skipped };
}

// ---- occasions (feasts): their own roster of main-group children + guests ----

const occasionName = (v) => {
  const n = text(v, 60, 'Occasion name');
  if (!n) throw new HttpError(400, 'Give the occasion a name');
  return n;
};

function pickMembers(ids, current = []) {
  const { db } = store;
  const list = Array.isArray(ids) ? ids : [];
  return [...new Set(list)].filter((id) => db.children.some((c) => c.id === id && c.active && (!c.guest || current.includes(id))));
}

function hasEntries(occ, childId) {
  return Object.values(store.db.sessions).some((s) => OCCASION_TYPES.includes(s.type) && slug(s.event) === slug(occ.name)
    && s.date >= seasonRange(occ.season).start && s.date <= seasonRange(occ.season).end && s.entries[childId]?.status);
}

function createOccasion(body) {
  const { db } = store;
  const season = Number.isInteger(body.season) ? body.season : seasonOf(today());
  const name = occasionName(body.name);
  if (findOccasion(db, season, name)) throw new HttpError(400, `${name} already exists for this year`);
  const members = pickMembers(body.members);
  const guests = createChildren(body.guests, { standard: body.standard, guest: true });
  const occ = { id: randomUUID().slice(0, 8), season, name, members: [...members, ...guests.added.map((c) => c.id)] };
  db.occasions.push(occ);
  store.save();
  return { id: occ.id, guestsAdded: guests.added.length, skipped: guests.skipped };
}

function updateOccasion(occ, body) {
  const keep = pickMembers(body.members, occ.members);
  for (const id of occ.members) {
    if (!keep.includes(id) && hasEntries(occ, id)) {
      const c = store.db.children.find((x) => x.id === id);
      throw new HttpError(400, `${c?.name ?? 'A child'} already has attendance in ${occ.name}, so can't be removed. Mark them absent instead.`);
    }
  }
  const guests = createChildren(body.guests, { standard: body.standard, guest: true });
  occ.members = [...keep, ...guests.added.map((c) => c.id)];
  store.save();
  return { guestsAdded: guests.added.length, skipped: guests.skipped };
}

function deleteOccasion(occ) {
  if (occ.members.some((id) => hasEntries(occ, id))) throw new HttpError(400, 'This occasion already has attendance recorded, so it can\'t be deleted');
  store.db.occasions = store.db.occasions.filter((o) => o !== occ);
  store.save();
}

// ---- hymn library: hymns taught that are not in the book ----------------------

const HYMN_CATEGORIES = ['Entrance', 'LHM', 'Gloria', 'Response', 'Acclamation', 'Offertory', 'Holy', 'Peace', 'Communion', 'Recessional'];
const HYMN_LABELS = { LHM: 'Lord Have Mercy (LHM)' };
const AUDIO_TYPES = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
  'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
};
const AUDIO_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm' };
const HYMNS_DIR = join(dirname(DATA_FILE), 'hymns');
const MAX_AUDIO = 25_000_000;

const hymnOut = (h) => ({
  id: h.id, title: h.title, category: h.category, link: h.link, notes: h.notes, lyrics: h.lyrics ?? '',
  audio: h.audioExt ? `/hymns/${h.id}.${h.audioExt}?v=${h.audioVersion}` : null,
});

const hymnList = () => ({
  categories: HYMN_CATEGORIES.map((id) => ({ id, label: HYMN_LABELS[id] ?? id })),
  hymns: [...store.db.hymns].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })).map(hymnOut),
});

function applyHymn(h, body) {
  if ('title' in body) {
    const t = text(body.title, 120, 'Title').replace(/\s+/g, ' ');
    if (!t) throw new HttpError(400, 'Hymn title is required');
    h.title = t;
  }
  if ('category' in body) {
    if (!HYMN_CATEGORIES.includes(body.category)) throw new HttpError(400, 'Choose a category from the list');
    h.category = body.category;
  }
  if ('link' in body) {
    const l = text(body.link, 500, 'Link');
    if (l && !/^https?:\/\/[^\s]+$/i.test(l)) throw new HttpError(400, 'The link must start with http:// or https://');
    h.link = l;
  }
  if ('notes' in body) h.notes = text(body.notes, 300, 'Notes');
  if ('lyrics' in body) h.lyrics = text(body.lyrics, 6000, 'Lyrics');
}

const sameHymn = (a, b) => a.category === b.category && a.title.toLowerCase() === b.title.toLowerCase();
const newHymn = () => ({ id: randomUUID().slice(0, 8), title: '', category: '', link: '', notes: '', lyrics: '', audioExt: '', audioVersion: 0 });

function createHymn(body) {
  const h = newHymn();
  applyHymn(h, body);
  if (!h.title || !h.category) throw new HttpError(400, 'A hymn needs a title and a category');
  if (store.db.hymns.some((x) => sameHymn(x, h))) throw new HttpError(400, `${h.title} is already in ${h.category}`);
  store.db.hymns.push(h);
  store.save();
  return hymnOut(h);
}

// Paste many titles for one category. A line is "Title" or "Title | https://link".
function bulkHymns(body) {
  if (!HYMN_CATEGORIES.includes(body.category)) throw new HttpError(400, 'Choose a category first');
  const lines = String(body.text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new HttpError(400, 'Paste at least one hymn title');
  if (lines.length > 300) throw new HttpError(400, 'Please add at most 300 hymns at a time');
  const added = [];
  const skipped = [];
  for (const line of lines) {
    const [title, link = ''] = line.replace(/^(?:\d+[.)]|[-*•])\s*/, '').split('|').map((x) => x.trim());
    try {
      const h = newHymn();
      applyHymn(h, { title, category: body.category, link });
      if (store.db.hymns.some((x) => sameHymn(x, h))) { skipped.push({ line, reason: 'already in the list' }); continue; }
      store.db.hymns.push(h);
      added.push(hymnOut(h));
    } catch (err) {
      skipped.push({ line, reason: err.message });
    }
  }
  store.save();
  return { added, skipped };
}

async function readRaw(req, limit, tooBig = 'That file is too big') {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, tooBig);
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function removeAudio(h) {
  if (h.audioExt) await rm(join(HYMNS_DIR, `${h.id}.${h.audioExt}`), { force: true });
  h.audioExt = '';
  h.audioVersion = 0;
}

async function saveHymnAudio(h, req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = AUDIO_TYPES[type];
  if (!ext) throw new HttpError(400, 'Please upload an MP3, M4A, WAV or OGG recording');
  const buf = await readRaw(req, MAX_AUDIO, 'That recording is too big (max 25 MB)');
  if (!buf.length) throw new HttpError(400, 'That file is empty');
  await mkdir(HYMNS_DIR, { recursive: true });
  await removeAudio(h);
  await writeFile(join(HYMNS_DIR, `${h.id}.${ext}`), buf);
  h.audioExt = ext;
  h.audioVersion = Date.now();
  store.save();
  return hymnOut(h);
}

async function teacherHymns(req, res, method, id, action) {
  const { db } = store;
  const h = id && id !== 'bulk' ? db.hymns.find((x) => x.id === id) : null;
  if (id && id !== 'bulk' && !h) throw new HttpError(404, 'Hymn not found');
  if (h && action === 'audio') {
    if (method === 'PUT') return send(res, 200, await saveHymnAudio(h, req));
    if (method === 'DELETE') { await removeAudio(h); store.save(); return send(res, 200, hymnOut(h)); }
    throw new HttpError(405, 'Method not allowed');
  }
  const body = await readBody(req);
  if (method === 'POST' && id === 'bulk') return send(res, 201, bulkHymns(body));
  if (method === 'POST' && !id) return send(res, 201, createHymn(body));
  if (method === 'PATCH' && h) {
    const draft = { ...h };
    applyHymn(draft, body);
    if (db.hymns.some((x) => x !== h && sameHymn(x, draft))) throw new HttpError(400, `${draft.title} is already in ${draft.category}`);
    Object.assign(h, draft);
    store.save();
    return send(res, 200, hymnOut(h));
  }
  if (method === 'DELETE' && h) {
    await removeAudio(h);
    db.hymns = db.hymns.filter((x) => x !== h);
    store.save();
    return send(res, 200, { ok: true });
  }
  throw new HttpError(404, 'Not found');
}

// Audio with Range support so players can seek.
async function serveAudio(req, res, file, ext) {
  let st;
  try { st = await stat(file); } catch { throw new HttpError(404, 'Not found'); }
  let start = 0;
  let end = st.size - 1;
  let status = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    if (m[1] === '') start = Math.max(0, st.size - Number(m[2]));
    else { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); }
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'content-range': `bytes */${st.size}` });
      return res.end();
    }
    status = 206;
  }
  res.writeHead(status, {
    'content-type': AUDIO_MIME[ext], 'accept-ranges': 'bytes', 'content-length': end - start + 1,
    'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff',
    ...(status === 206 ? { 'content-range': `bytes ${start}-${end}/${st.size}` } : {}),
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file, { start, end }).pipe(res);
}

// ---- backup & restore: one .tar file with the database, photos and recordings ----

const BACKUP_FILE = /^(photos\/[a-f0-9]{8}\.jpg|hymns\/[a-f0-9]{8}\.(mp3|m4a|aac|wav|ogg|webm))$/;

async function buildBackup() {
  const { db } = store;
  const files = [{ name: 'db.json', data: Buffer.from(JSON.stringify(db)) }];
  for (const c of db.children) {
    if (!c.photoVersion) continue;
    try { files.push({ name: `photos/${c.id}.jpg`, data: await readFile(join(PHOTOS, `${c.id}.jpg`)) }); } catch { /* photo file missing */ }
  }
  for (const h of db.hymns) {
    if (!h.audioExt) continue;
    try { files.push({ name: `hymns/${h.id}.${h.audioExt}`, data: await readFile(join(HYMNS_DIR, `${h.id}.${h.audioExt}`)) }); } catch { /* recording missing */ }
  }
  return createTar(files);
}

async function restoreBackup(req) {
  const buf = await readRaw(req, 400_000_000, 'That backup is too big');
  let files;
  try { files = readTar(buf); } catch { throw new HttpError(400, 'That is not a Choir backup file'); }
  const dbFile = files.find((f) => f.name === 'db.json');
  let parsed;
  try { parsed = JSON.parse(dbFile?.data.toString('utf8') ?? ''); } catch { parsed = null; }
  if (!parsed || !Array.isArray(parsed.children) || typeof parsed.sessions !== 'object' || parsed.sessions === null) {
    throw new HttpError(400, 'That is not a Choir backup file');
  }
  await rm(PHOTOS, { recursive: true, force: true });
  await rm(HYMNS_DIR, { recursive: true, force: true });
  await mkdir(PHOTOS, { recursive: true });
  await mkdir(HYMNS_DIR, { recursive: true });
  let restored = 0;
  for (const f of files) {
    if (!BACKUP_FILE.test(f.name)) continue; // only known file names are ever written
    await writeFile(join(f.name.startsWith('photos/') ? PHOTOS : HYMNS_DIR, f.name.split('/')[1]), f.data);
    restored += 1;
  }
  store.replace(parsed);
  return { children: store.db.children.length, files: restored };
}

function teacherBoard() {
  const { db } = store;
  const season = seasonOf(today());
  const range = seasonRange(season);
  const prize = prizeInfo(db, season, today());
  const month = today().slice(0, 7);
  const mr = monthRange(month);
  return {
    season, seasonLabel: seasonLabel(season), prize, month, monthLabel: monthLabel(month),
    prizeBoard: scoreboard(db, season, range.start, prize.date < range.end ? prize.date : range.end),
    monthBoard: scoreboard(db, season, mr.start, mr.end),
    yearBoard: scoreboard(db, season, range.start, range.end),
    pending: pendingDecisions(season),
  };
}

async function teacherApi(req, res, q, parts) {
  const [, b, id, action] = parts;
  const childRoute = b === 'children' || b === 'child';
  const child = id && childRoute ? store.db.children.find((c) => c.id === id) : null;
  if (id && childRoute && !child) throw new HttpError(404, 'Child not found');

  if (req.method === 'GET') {
    if (b === 'session') {
      const date = q.get('date') || today();
      const type = q.get('type') || defaultType(date);
      return send(res, 200, sessionView(date, type, q.get('event')));
    }
    if (b === 'children' && !id) {
      return send(res, 200, {
        children: [...store.db.children].sort(compareNames).map(childOut),
        settings: store.db.settings, firstSeason: firstSeason(store.db, today()),
        pending: pendingDecisions(seasonOf(today())), lockedOut: lockedOutCount(),
      });
    }
    if (b === 'child' && id) return send(res, 200, { ...childDetail(child, seasonFromQuery(q), { teacher: true }), code: child.code, active: child.active, guest: Boolean(child.guest) });
    if (b === 'backup') {
      const tar = await buildBackup();
      res.writeHead(200, {
        'content-type': 'application/x-tar', 'content-length': tar.length, 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="choir-backup-${today()}.tar"`,
      });
      return res.end(tar);
    }
    if (b === 'board') return send(res, 200, teacherBoard());
    if (b === 'schedule') return send(res, 200, scheduleView());
    if (b === 'occasions') {
      const season = seasonFromQuery(q);
      return send(res, 200, {
        season, seasonLabel: seasonLabel(season), seasons: seasonsWithData(store.db, today()), presets: EVENTS,
        events: occasions(store.db, season),
        main: store.db.children.filter((c) => c.active && !c.guest).sort(compareNames).map((c) => ({ id: c.id, name: c.name, photo: photoUrl(c) })),
      });
    }
    throw new HttpError(404, 'Not found');
  }

  if (b === 'hymns') return teacherHymns(req, res, req.method, id, action);
  if (req.method === 'POST' && b === 'restore') return send(res, 200, await restoreBackup(req));

  const body = await readBody(req, b === 'children' && action === 'photo' ? 1_500_000 : 100_000);
  if (req.method === 'PUT' && b === 'mark') { mark(body); return send(res, 200, { ok: true }); }
  if (req.method === 'POST' && b === 'mark-all-present') { markAllPresent(body); return send(res, 200, { ok: true }); }
  if (req.method === 'POST' && b === 'bulk-children') return send(res, 201, bulkAdd(body));
  if (b === 'occasions') {
    const occ = id ? store.db.occasions.find((o) => o.id === id) : null;
    if (id && !occ) throw new HttpError(404, 'Occasion not found');
    if (req.method === 'POST' && !id) return send(res, 201, createOccasion(body));
    if (req.method === 'PUT' && occ) return send(res, 200, updateOccasion(occ, body));
    if (req.method === 'DELETE' && occ) { deleteOccasion(occ); return send(res, 200, { ok: true }); }
  }
  if (req.method === 'POST' && b === 'unlock-codes') {
    const cleared = lockedOutCount();
    failures.clear();
    return send(res, 200, { cleared });
  }
  if (b === 'schedule') {
    if (req.method === 'PUT' && !id) { updateSchedule(body); return send(res, 200, scheduleView()); }
    if (req.method === 'PUT' && id === 'day') { setScheduleDay(body); return send(res, 200, scheduleView()); }
    if (req.method === 'DELETE' && id === 'day') { removeScheduleDay(body.date); return send(res, 200, scheduleView()); }
  }
  if (req.method === 'PUT' && b === 'settings') { updateSettings(body); return send(res, 200, store.db.settings); }
  if (b === 'children') {
    if (req.method === 'POST' && !id) {
      const c = {
        id: randomUUID().slice(0, 8), name: '', active: true, joinedOn: today(), code: newCode(store.db),
        standard: '', joinedYear: Number(today().slice(0, 4)), contact: '', address: '',
        emergencyName: '', emergencyPhone: '', photoVersion: 0, leaveDecisions: {},
      };
      applyProfile(c, body, { teacher: true });
      if (!c.name) throw new HttpError(400, 'Name is required');
      store.db.children.push(c);
      store.save();
      return send(res, 201, childOut(c));
    }
    if (req.method === 'PATCH' && id && !action) {
      applyProfile(child, body, { teacher: true });
      if ('active' in body) child.active = Boolean(body.active);
      if (body.guest === false) child.guest = false; // promote a guest to the main group
      if ('code' in body) child.code = customCode(body.code, child);
      store.save();
      return send(res, 200, childOut(child));
    }
    if (req.method === 'POST' && id && action === 'photo') {
      await savePhoto(child, body.image);
      return send(res, 200, { photo: photoUrl(child) });
    }
    if (req.method === 'PUT' && id && action === 'decision') {
      const season = Number.isInteger(body.season) ? body.season : seasonOf(today());
      if (body.status === null) delete child.leaveDecisions[season];
      else if (body.status === 'keep' || body.status === 'out') child.leaveDecisions[season] = { status: body.status, on: today() };
      else throw new HttpError(400, 'Decision must be keep, out or null');
      store.save();
      return send(res, 200, { decision: child.leaveDecisions[season] ?? null });
    }
    if (req.method === 'PUT' && id && action === 'game') {
      setPaid(store.db.game, child.id, body.paid, istDate());
      store.save();
      return send(res, 200, { gamePaid: isPaid(store.db.game.kids[child.id]) });
    }
    if (req.method === 'POST' && id && action === 'new-code') {
      child.code = newCode(store.db);
      store.save();
      return send(res, 200, { code: child.code });
    }
  }
  throw new HttpError(404, 'Not found');
}

async function api(req, res, url) {
  const q = url.searchParams;
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const [a, b] = parts;

  if (req.method === 'GET' && a === 'public') return send(res, 200, publicOverview(q));
  if (req.method === 'GET' && a === 'hymns') return send(res, 200, hymnList());
  if (req.method === 'GET' && a === 'meta') return send(res, 200, { pinRequired: !isLocal(req) && Boolean(PIN_ENV), teacherAllowed: isLocal(req) || Boolean(PIN_ENV) });

  if (a === 'me') {
    const child = childByCode(req);
    if (req.method === 'GET') return send(res, 200, childDetail(child, seasonFromQuery(q)));
    if (req.method === 'PUT') {
      const body = await readBody(req);
      applyProfile(child, body, { teacher: false }); // parents may only change contact details
      store.save();
      return send(res, 200, profileOf(child));
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (a === 'game') return gameApi(req, res, q, childByCode(req), b);

  if (a !== 'teacher') throw new HttpError(404, 'Not found');
  checkTeacher(req);
  return teacherApi(req, res, q, parts);
}

// App files are never cached by browsers or Cloudflare, so an update shows up on the next page load.
async function serveFile(res, file, headers = { 'cache-control': 'no-store' }) {
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', ...headers });
    res.end(data);
  } catch {
    throw new HttpError(404, 'Not found');
  }
}

async function serveStatic(req, res, pathname) {
  if (pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  const audio = /^\/hymns\/([a-f0-9]{8})\.(mp3|m4a|aac|wav|ogg|webm)$/.exec(pathname);
  if (audio) {
    if (!store.db.hymns.some((h) => h.id === audio[1] && h.audioExt === audio[2])) throw new HttpError(404, 'Not found');
    return serveAudio(req, res, join(HYMNS_DIR, `${audio[1]}.${audio[2]}`), audio[2]);
  }
  const photo = /^\/photos\/([a-f0-9]{8})\.jpg$/.exec(pathname);
  if (photo) return serveFile(res, join(PHOTOS, `${photo[1]}.jpg`), { 'cache-control': 'public, max-age=86400' });
  const rel = pathname === '/' ? 'index.html' : pathname === '/teacher' ? 'teacher.html' : pathname.slice(1);
  const file = normalize(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + sep)) throw new HttpError(404, 'Not found');
  return serveFile(res, file);
}

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET') await serveStatic(req, res, decodeURIComponent(url.pathname));
    else throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    send(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Choir attendance running on http://localhost:${PORT}  (teacher: /teacher)`);
    console.log(PUBLIC_MODE
      ? `Public mode: the teacher pages need your PIN${PIN_ENV ? '' : ' (CHOIR_PIN is not set, so they are locked)'}.`
      : 'Teacher area: open it on this computer only. Other devices cannot reach it.');
  });
}
