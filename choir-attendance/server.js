import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REMARKS, STATUSES, TYPES, EVENTS, OCCASION_TYPES, isValidDate, defaultType, seasonOf, seasonRange,
  seasonLabel, prizeInfo, firstSeason, childStats, scoreboard, monthRange, monthLabel, pointsFor,
  isLeave, sessionKey, photoUrl, monthlyAchievers, yearlyAchievers, occasions, seasonsWithData,
} from './lib/logic.js';
import { openStore, newCode } from './lib/store.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = resolve(here, 'public');
const DATA_FILE = process.env.CHOIR_DATA || join(here, 'data', 'db.json');
const PHOTOS = join(dirname(DATA_FILE), 'photos');
const PORT = Number(process.env.PORT) || 3000;
const PIN = process.env.CHOIR_PIN || ''; // optional teacher PIN
const store = openStore(DATA_FILE);

const today = () => new Date().toISOString().slice(0, 10);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
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

function pinOk(req) {
  if (!PIN) return true;
  const a = Buffer.from(String(req.headers['x-pin'] || ''));
  const b = Buffer.from(PIN);
  return a.length === b.length && timingSafeEqual(a, b);
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

function childDetail(child, season, { teacher = false } = {}) {
  const { db } = store;
  const range = seasonRange(season);
  const history = Object.values(db.sessions)
    .filter((s) => s.date >= range.start && s.date <= range.end && s.entries[child.id]?.status)
    .sort((a, b) => b.date.localeCompare(a.date) || b.type.localeCompare(a.type))
    .map((s) => {
      const e = s.entries[child.id];
      return {
        date: s.date, type: s.type, event: s.event, status: e.status, remarks: e.remarks || [],
        points: pointsFor(e, s.type, db.settings), leave: isLeave(e, s.type, db.settings),
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
    yearRank: yearBoard.find((r) => r.id === child.id)?.rank ?? null, yearRanked: yearBoard.length,
    monthRank: monthBoard.find((r) => r.id === child.id)?.rank ?? null, monthLabel: monthLabel(month),
  };
}

// ---- public (leaderboard + achievers only: no private details) ------------

function publicOverview(q) {
  const { db } = store;
  const season = seasonFromQuery(q);
  const range = seasonRange(season);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('month') || '') ? q.get('month') : today().slice(0, 7);
  const mr = monthRange(month);
  const strip = (rows) => rows.map(({ id, name, photo, points, rank }) => ({ id, name, photo, points, rank }));
  return {
    season, seasonLabel: seasonLabel(season), seasons: seasonsWithData(db, today()),
    settings: { satPoints: db.settings.satPoints, sunPoints: db.settings.sunPoints, feastPoints: db.settings.feastPoints, practicePoints: db.settings.practicePoints },
    month, monthLabel: monthLabel(month),
    monthBoard: strip(scoreboard(db, season, mr.start, mr.end, { hideOut: true })),
    yearBoard: strip(scoreboard(db, season, range.start, range.end, { hideOut: true })),
    monthly: monthlyAchievers(db, season, today()),
    yearly: yearlyAchievers(db, today()),
  };
}

// ---- parent access: one private code per child ---------------------------

const failures = new Map(); // ip -> { n, resetAt }
function childByCode(req) {
  const ip = req.socket.remoteAddress || '?';
  const f = failures.get(ip);
  if (f && f.resetAt > Date.now() && f.n >= 10) throw new HttpError(429, 'Too many wrong codes. Please try again in a few minutes.');
  const code = String(req.headers['x-code'] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const child = code.length >= 8 ? store.db.children.find((c) => c.code === code && c.active) : null;
  if (!child) {
    const cur = f && f.resetAt > Date.now() ? f : { n: 0, resetAt: Date.now() + 10 * 60_000 };
    cur.n += 1;
    failures.set(ip, cur);
    throw new HttpError(401, 'That code was not found. Please check it with your choir teacher.');
  }
  return child;
}

// ---- teacher ------------------------------------------------------------

function checkOccasion(type, event) {
  if (!OCCASION_TYPES.includes(type)) return '';
  const e = text(event, 60, 'Occasion');
  if (!e) throw new HttpError(400, 'Choose which occasion this is for');
  return e;
}

function checkSessionKey(date, type, event) {
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  if (!TYPES.includes(type)) throw new HttpError(400, 'Invalid session type');
  return checkOccasion(type, event);
}

function sessionView(date, type, event) {
  const { db } = store;
  const season = seasonOf(date);
  const sess = db.sessions[sessionKey(date, type, event)];
  return {
    date, type, event, season, settings: db.settings, remarkOptions: REMARKS, events: EVENTS,
    children: db.children.filter((c) => c.active).map((c) => {
      const e = sess?.entries[c.id] || {};
      const st = childStats(db, c.id, season);
      return {
        id: c.id, name: c.name, photo: photoUrl(c), standard: c.standard,
        status: e.status || null, remarks: e.remarks || [], note: e.note || '',
        leaves: st.leaves, exceeded: st.exceeded,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function getOrCreateSession(date, type, event) {
  const { db } = store;
  const key = sessionKey(date, type, event);
  return db.sessions[key] ?? (db.sessions[key] = { date, type, event, entries: {} });
}

function mark(body) {
  const { db } = store;
  const event = checkSessionKey(body.date, body.type, body.event);
  if (!db.children.some((c) => c.id === body.childId)) throw new HttpError(404, 'Child not found');
  const status = body.status ?? null;
  if (status !== null && !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const remarks = Array.isArray(body.remarks) ? body.remarks.filter((r) => REMARKS.includes(r)) : [];
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const sess = getOrCreateSession(body.date, body.type, event);
  if (status === null && !remarks.length && !note) delete sess.entries[body.childId];
  else sess.entries[body.childId] = { status, remarks: [...new Set(remarks)], note };
  if (!Object.keys(sess.entries).length) delete db.sessions[sessionKey(body.date, body.type, event)];
  store.save();
}

function markAllPresent(body) {
  const { db } = store;
  const event = checkSessionKey(body.date, body.type, body.event);
  const sess = getOrCreateSession(body.date, body.type, event);
  for (const c of db.children.filter((x) => x.active)) {
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
  if ('maxLeaves' in body) s.maxLeaves = Math.round(num(body.maxLeaves, 0, 100));
  if ('latePointsFactor' in body) s.latePointsFactor = num(body.latePointsFactor, 0, 1);
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
  };
}

async function teacherApi(req, res, q, parts) {
  const [, b, id, action] = parts;
  const child = id ? store.db.children.find((c) => c.id === id) : null;
  if (id && !child) throw new HttpError(404, 'Child not found');

  if (req.method === 'GET') {
    if (b === 'session') {
      const date = q.get('date') || today();
      const type = q.get('type') || defaultType(date);
      return send(res, 200, sessionView(date, type, checkSessionKey(date, type, q.get('event'))));
    }
    if (b === 'children' && !id) {
      return send(res, 200, {
        children: store.db.children.map((c) => ({ ...profileOf(c), code: c.code, active: c.active })),
        settings: store.db.settings, firstSeason: firstSeason(store.db, today()),
      });
    }
    if (b === 'child' && id) return send(res, 200, { ...childDetail(child, seasonFromQuery(q), { teacher: true }), code: child.code, active: child.active });
    if (b === 'board') return send(res, 200, teacherBoard());
    if (b === 'occasions') {
      const season = seasonFromQuery(q);
      return send(res, 200, { season, seasonLabel: seasonLabel(season), seasons: seasonsWithData(store.db, today()), events: occasions(store.db, season) });
    }
    throw new HttpError(404, 'Not found');
  }

  const body = await readBody(req, b === 'children' && action === 'photo' ? 1_500_000 : 100_000);
  if (req.method === 'PUT' && b === 'mark') { mark(body); return send(res, 200, { ok: true }); }
  if (req.method === 'POST' && b === 'mark-all-present') { markAllPresent(body); return send(res, 200, { ok: true }); }
  if (req.method === 'PUT' && b === 'settings') { updateSettings(body); return send(res, 200, store.db.settings); }
  if (b === 'children') {
    if (req.method === 'POST' && !id) {
      const c = {
        id: randomUUID().slice(0, 8), name: '', active: true, joinedOn: today(), code: newCode(store.db),
        standard: '', joinedYear: Number(today().slice(0, 4)), contact: '', address: '',
        emergencyName: '', emergencyPhone: '', photoVersion: 0,
      };
      applyProfile(c, body, { teacher: true });
      if (!c.name) throw new HttpError(400, 'Name is required');
      store.db.children.push(c);
      store.save();
      return send(res, 201, { ...profileOf(c), code: c.code, active: c.active });
    }
    if (req.method === 'PATCH' && id && !action) {
      applyProfile(child, body, { teacher: true });
      if ('active' in body) child.active = Boolean(body.active);
      store.save();
      return send(res, 200, { ...profileOf(child), code: child.code, active: child.active });
    }
    if (req.method === 'POST' && id && action === 'photo') {
      await savePhoto(child, body.image);
      return send(res, 200, { photo: photoUrl(child) });
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
  if (req.method === 'GET' && a === 'meta') return send(res, 200, { pinRequired: Boolean(PIN) });

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

  if (a !== 'teacher') throw new HttpError(404, 'Not found');
  if (!pinOk(req)) throw new HttpError(401, 'PIN required');
  return teacherApi(req, res, q, parts);
}

async function serveFile(res, file, headers = {}) {
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', ...headers });
    res.end(data);
  } catch {
    throw new HttpError(404, 'Not found');
  }
}

async function serveStatic(res, pathname) {
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
    else if (req.method === 'GET') await serveStatic(res, decodeURIComponent(url.pathname));
    else throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    send(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Choir attendance running on http://localhost:${PORT}  (teacher: /teacher)`);
    if (!PIN) console.log('No CHOIR_PIN set: the teacher page is open to anyone with the link.');
  });
}
