import express, { type NextFunction, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Me, Snapshot } from '../shared/types';
import { AuctionError, createStore, randomCode, runAction, tick, type Actor, type Store } from './engine';
import { DATA_DIR, flushAll, loadAll, saveSoon, UPLOADS_DIR } from './persist';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 2000);
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const events = loadAll();
console.log(`ZenoBid · data in ${DATA_DIR} · ${events.size} auction(s) loaded`);

// ---------------------------------------------------------------------------------------------
// Live connections
// ---------------------------------------------------------------------------------------------

interface Client {
  res: Response;
  me: Me;
  isAdmin: boolean;
}
const clients = new Map<string, Set<Client>>();
const spinTimers = new Map<string, NodeJS.Timeout>();

function resolveActor(store: Store, key: unknown): Actor & { isAdmin: boolean } {
  if (typeof key === 'string' && key) {
    if (key === store.secrets.adminKey) return { role: 'admin', isAdmin: true };
    if (key === store.secrets.hostKey) return { role: 'host', isAdmin: false };
    for (const [captainId, token] of Object.entries(store.secrets.captainTokens)) {
      if (token === key.toUpperCase()) return { role: 'captain', captainId, isAdmin: false };
    }
  }
  return { role: 'viewer', isAdmin: false };
}

function presenceOf(code: string) {
  const set = clients.get(code) ?? new Set<Client>();
  const captains = new Set<string>();
  for (const c of set) if (c.me.captainId) captains.add(c.me.captainId);
  return { captains: [...captains], viewers: set.size };
}

function snapshot(store: Store, me: Me, isAdmin: boolean, now = Date.now()): Snapshot {
  const snap: Snapshot = { ...store.data, now, me, presence: presenceOf(store.data.code) };
  if (isAdmin) snap.secrets = store.secrets;
  return snap;
}

function broadcast(store: Store) {
  const set = clients.get(store.data.code);
  if (!set || set.size === 0) return;
  const now = Date.now();
  const presence = presenceOf(store.data.code);
  const base = { ...store.data, now, presence };
  // Serialise once for everyone, once more for admins (they also receive the secrets).
  const plain = new Map<string, string>();
  for (const c of set) {
    const cacheKey = c.isAdmin ? 'admin' : `${c.me.role}:${c.me.captainId ?? ''}`;
    let payload = plain.get(cacheKey);
    if (!payload) {
      const snap: Snapshot = { ...base, me: c.me };
      if (c.isAdmin) snap.secrets = store.secrets;
      payload = `data: ${JSON.stringify(snap)}\n\n`;
      plain.set(cacheKey, payload);
    }
    c.res.write(payload);
  }
}

let presenceTimer: NodeJS.Timeout | null = null;
function broadcastPresenceSoon(store: Store) {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    broadcast(store);
  }, 400);
}

/** When the wheel stops the server flips to "bidding" and tells everyone, even if nobody clicks. */
function scheduleSpinEnd(store: Store) {
  const { live } = store.data;
  const code = store.data.code;
  clearTimeout(spinTimers.get(code));
  spinTimers.delete(code);
  if (live.phase !== 'spinning' || !live.spin) return;
  const delay = Math.max(0, live.spin.endsAt - Date.now()) + 25;
  spinTimers.set(
    code,
    setTimeout(() => {
      if (tick(store, Date.now())) {
        saveSoon(store);
        broadcast(store);
      }
    }, delay),
  );
}
for (const s of events.values()) {
  tick(s, Date.now());
  scheduleSpinEnd(s);
}

// ---------------------------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------------------------

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const wrap =
  (fn: (req: Request, res: Response) => void) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res);
    } catch (err) {
      next(err);
    }
  };

function findEvent(req: Request): Store {
  const code = String(req.params.code ?? '').toUpperCase();
  const store = events.get(code);
  if (!store) throw new AuctionError('Auction not found — check the code', 404);
  tick(store, Date.now());
  return store;
}

app.post(
  '/api/events',
  wrap((req, res) => {
    if (events.size >= MAX_EVENTS) throw new AuctionError('This server is full', 503);
    let code = randomCode(6);
    while (events.has(code)) code = randomCode(6);
    const store = createStore(code, req.body?.settings);
    events.set(code, store);
    saveSoon(store);
    res.status(201).json({ code, adminKey: store.secrets.adminKey, hostKey: store.secrets.hostKey });
  }),
);

/** Lets the join screen say "found it" before sending people into the room. */
app.get(
  '/api/events/:code/exists',
  wrap((req, res) => {
    const store = findEvent(req);
    res.json({ code: store.data.code, name: store.data.settings.name, sport: store.data.settings.sport });
  }),
);

app.get(
  '/api/events/:code/state',
  wrap((req, res) => {
    const store = findEvent(req);
    const actor = resolveActor(store, req.query.key);
    res.json(snapshot(store, { role: actor.role, captainId: actor.captainId }, actor.isAdmin));
  }),
);

app.get('/api/events/:code/stream', (req, res, next) => {
  let store: Store;
  try {
    store = findEvent(req);
  } catch (err) {
    return next(err);
  }
  const actor = resolveActor(store, req.query.key);
  const client: Client = { res, me: { role: actor.role, captainId: actor.captainId }, isAdmin: actor.isAdmin };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');

  let set = clients.get(store.data.code);
  if (!set) clients.set(store.data.code, (set = new Set()));
  set.add(client);
  res.write(`data: ${JSON.stringify(snapshot(store, client.me, client.isAdmin))}\n\n`);
  broadcastPresenceSoon(store);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    set!.delete(client);
    broadcastPresenceSoon(store);
  });
});

app.post(
  '/api/events/:code/cmd',
  wrap((req, res) => {
    const store = findEvent(req);
    const key = req.header('x-key') ?? req.body?.key;
    const actor = resolveActor(store, key);
    const action = String(req.body?.action ?? '');
    const result = runAction(store, actor, action, req.body?.params);
    saveSoon(store);
    scheduleSpinEnd(store);
    broadcast(store);
    res.json({ ok: true, result: result ?? null });
  }),
);

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Raw image upload (the browser resizes first). Returns a URL to store on a player or team. */
app.post(
  '/api/events/:code/upload',
  express.raw({ type: Object.keys(EXT), limit: MAX_UPLOAD_BYTES }),
  wrap((req, res) => {
    const store = findEvent(req);
    const actor = resolveActor(store, req.header('x-key'));
    if (actor.role !== 'admin') throw new AuctionError('You are not allowed to do that', 403);
    const ext = EXT[String(req.header('content-type') ?? '').split(';')[0]];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new AuctionError('Upload a JPEG, PNG or WebP image');
    const dir = path.join(UPLOADS_DIR, store.data.code);
    mkdirSync(dir, { recursive: true });
    const name = `${randomBytes(6).toString('hex')}.${ext}`;
    writeFileSync(path.join(dir, name), req.body);
    res.status(201).json({ url: `/uploads/${store.data.code}/${name}` });
  }),
);

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', immutable: true, index: false }));
app.get('/api/health', (_req, res) => res.json({ ok: true, auctions: events.size }));

// Built web app (production). In development Vite serves the UI and proxies /api here.
const WEB_DIST = path.resolve('dist/web');
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AuctionError) return res.status(err.status).json({ ok: false, error: err.message });
  const e = err as { status?: number; type?: string; message?: string };
  if (e?.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'That upload is too large' });
  if (e?.status && e.status < 500) return res.status(e.status).json({ ok: false, error: e.message ?? 'Bad request' });
  console.error(err);
  res.status(500).json({ ok: false, error: 'Something went wrong' });
});

const server = app.listen(PORT, () => console.log(`ZenoBid listening on http://localhost:${PORT}`));

function shutdown() {
  flushAll(events.values());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
