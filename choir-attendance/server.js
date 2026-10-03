import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REMARKS, STATUSES, TYPES, isValidDate, defaultType, seasonOf,
  seasonRange, seasonLabel, prizeInfo, firstSeason, childStats, scoreboard,
  monthRange, monthLabel, pointsFor, isLeave,
} from './lib/logic.js';
import { openStore } from './lib/store.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = resolve(here, 'public');
const PORT = Number(process.env.PORT) || 3000;
const PIN = process.env.CHOIR_PIN || ''; // optional teacher PIN; real logins can come later
const store = openStore(process.env.CHOIR_DATA || join(here, 'data', 'db.json'));

const today = () => new Date().toISOString().slice(0, 10);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 100_000) throw new HttpError(413, 'Request too large');
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

const cleanName = (v) => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (!s || s.length > 80) throw new HttpError(400, 'Name is required (max 80 characters)');
  return s;
};

function seasonFromQuery(q) {
  const s = q.get('season');
  return s && /^\d{4}$/.test(s) ? Number(s) : seasonOf(today());
}

// ---- public (read-only, what parents see) -------------------------------

function publicOverview(q) {
  const { db } = store;
  const season = seasonFromQuery(q);
  const range = seasonRange(season);
  const prize = prizeInfo(db, season, today());
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('month') || '') ? q.get('month') : today().slice(0, 7);
  const mr = monthRange(month);
  return {
    season, seasonLabel: seasonLabel(season), settings: db.settings, prize,
    prizeBoard: scoreboard(db, season, range.start, prize.date < range.end ? prize.date : range.end),
    month, monthLabel: monthLabel(month), monthBoard: scoreboard(db, season, mr.start, mr.end),
    children: db.children.filter((c) => c.active).map((c) => {
      const st = childStats(db, c.id, season);
      return { id: c.id, name: c.name, leaves: st.leaves, exceeded: st.exceeded, points: st.points };
    }).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function childDetail(id, q) {
  const { db } = store;
  const child = db.children.find((c) => c.id === id);
  if (!child) throw new HttpError(404, 'Child not found');
  const season = seasonFromQuery(q);
  const range = seasonRange(season);
  const history = Object.values(db.sessions)
    .filter((s) => s.date >= range.start && s.date <= range.end && s.entries[id]?.status)
    .sort((a, b) => b.date.localeCompare(a.date) || b.type.localeCompare(a.type))
    .map((s) => {
      const e = s.entries[id];
      return {
        date: s.date, type: s.type, status: e.status, remarks: e.remarks || [],
        points: pointsFor(e, s.type, db.settings), leave: isLeave(e, s.type, db.settings),
      };
    });
  const stats = childStats(db, id, season);
  const prize = prizeInfo(db, season, today());
  const board = scoreboard(db, season, range.start, prize.date < range.end ? prize.date : range.end);
  const row = board.find((r) => r.id === id);
  return {
    id, name: child.name, active: child.active, season, seasonLabel: seasonLabel(season),
    settings: db.settings, stats, history, prize, rank: row?.rank ?? null, ranked: board.filter((r) => r.eligible).length,
  };
}

// ---- teacher (writes) ------------------------------------------------------

function sessionView(date, type) {
  const { db } = store;
  const season = seasonOf(date);
  const sess = db.sessions[`${date}|${type}`];
  return {
    date, type, season, settings: db.settings, remarkOptions: REMARKS,
    children: db.children.filter((c) => c.active).map((c) => {
      const e = sess?.entries[c.id] || {};
      const st = childStats(db, c.id, season);
      return {
        id: c.id, name: c.name, status: e.status || null, remarks: e.remarks || [], note: e.note || '',
        leaves: st.leaves, exceeded: st.exceeded,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function checkSessionKey(date, type) {
  if (!isValidDate(date)) throw new HttpError(400, 'Invalid date');
  if (!TYPES.includes(type)) throw new HttpError(400, 'Type must be saturday or sunday');
}

function mark(body) {
  const { db } = store;
  const { date, type, childId } = body;
  checkSessionKey(date, type);
  if (!db.children.some((c) => c.id === childId)) throw new HttpError(404, 'Child not found');
  const status = body.status ?? null;
  if (status !== null && !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const remarks = Array.isArray(body.remarks) ? body.remarks.filter((r) => REMARKS.includes(r)) : [];
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const key = `${date}|${type}`;
  const sess = db.sessions[key] ?? (db.sessions[key] = { date, type, entries: {} });
  if (status === null && !remarks.length && !note) delete sess.entries[childId];
  else sess.entries[childId] = { status, remarks: [...new Set(remarks)], note };
  if (!Object.keys(sess.entries).length) delete db.sessions[key];
  store.save();
}

function markAllPresent(body) {
  const { db } = store;
  checkSessionKey(body.date, body.type);
  const key = `${body.date}|${body.type}`;
  const sess = db.sessions[key] ?? (db.sessions[key] = { date: body.date, type: body.type, entries: {} });
  for (const c of db.children.filter((x) => x.active)) {
    sess.entries[c.id] ??= { status: 'present', remarks: [], note: '' };
    if (!sess.entries[c.id].status) sess.entries[c.id].status = 'present';
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
  if ('satPoints' in body) s.satPoints = num(body.satPoints, 0, 100);
  if ('sunPoints' in body) s.sunPoints = num(body.sunPoints, 0, 100);
  if ('maxLeaves' in body) s.maxLeaves = Math.round(num(body.maxLeaves, 0, 100));
  if ('latePointsFactor' in body) s.latePointsFactor = num(body.latePointsFactor, 0, 1);
  if ('countSundayAbsences' in body) s.countSundayAbsences = Boolean(body.countSundayAbsences);
  if ('firstSeason' in body) s.firstSeason = body.firstSeason === null || body.firstSeason === '' ? null : Math.round(num(body.firstSeason, 2000, 2200));
  store.save();
}

async function api(req, res, url) {
  const q = url.searchParams;
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const [a, b] = parts;

  if (req.method === 'GET' && a === 'public') return send(res, 200, publicOverview(q));
  if (req.method === 'GET' && a === 'child' && b) return send(res, 200, childDetail(b, q));
  if (req.method === 'GET' && a === 'meta') return send(res, 200, { pinRequired: Boolean(PIN) });

  if (a !== 'teacher') throw new HttpError(404, 'Not found');
  if (!pinOk(req)) throw new HttpError(401, 'PIN required');

  if (req.method === 'GET' && b === 'session') {
    const date = q.get('date') || today();
    const type = q.get('type') || defaultType(date);
    checkSessionKey(date, type);
    return send(res, 200, sessionView(date, type));
  }
  if (req.method === 'GET' && b === 'children') {
    return send(res, 200, { children: store.db.children, settings: store.db.settings, firstSeason: firstSeason(store.db, today()) });
  }

  const body = await readBody(req);
  if (req.method === 'PUT' && b === 'mark') { mark(body); return send(res, 200, { ok: true }); }
  if (req.method === 'POST' && b === 'mark-all-present') { markAllPresent(body); return send(res, 200, { ok: true }); }
  if (req.method === 'PUT' && b === 'settings') { updateSettings(body); return send(res, 200, store.db.settings); }
  if (req.method === 'POST' && b === 'children') {
    const child = { id: randomUUID().slice(0, 8), name: cleanName(body.name), active: true, joinedOn: today() };
    store.db.children.push(child);
    store.save();
    return send(res, 201, child);
  }
  if (req.method === 'PATCH' && b === 'children' && parts[2]) {
    const child = store.db.children.find((c) => c.id === parts[2]);
    if (!child) throw new HttpError(404, 'Child not found');
    if ('name' in body) child.name = cleanName(body.name);
    if ('active' in body) child.active = Boolean(body.active);
    store.save();
    return send(res, 200, child);
  }
  throw new HttpError(404, 'Not found');
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname === '/teacher' ? 'teacher.html' : pathname.slice(1);
  const file = normalize(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + sep)) throw new HttpError(404, 'Not found');
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    throw new HttpError(404, 'Not found');
  }
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
