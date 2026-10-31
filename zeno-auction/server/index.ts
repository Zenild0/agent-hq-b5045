import express, { type NextFunction, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Me, Snapshot } from '../shared/types';
import { AuctionError, createStore, nextDue, randomCode, runAction, tick, type Actor, type Store } from './engine';
import { DATA_DIR, flushAll, loadAll, saveSoon, UPLOADS_DIR } from './persist';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 2000);
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_UPLOADS_PER_AUCTION = 1000;

const events = loadAll();
console.log(`ZenoBid · data in ${DATA_DIR} · ${events.size} auction(s) loaded`);
if (process.env.NODE_ENV !== 'production' && events.size > 0) {
  // On your own computer, show how to get back into each auction (the browser forgets them if the
  // address changes, e.g. localhost:5173 → :5174). Not printed on a production server.
  console.log('Your auctions — open on whichever address shows the app:');
  for (const s of events.values()) console.log(`  ${s.data.code}  ${s.data.settings.name}  →  /e/${s.data.code}/admin?k=${s.secrets.adminKey}`);
}

// ---------------------------------------------------------------------------------------------
// Live connections
// ---------------------------------------------------------------------------------------------

/** One connected screen — over a WebSocket (normal) or Server-Sent Events (fallback). */
interface Client {
  send: (json: string) => void;
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

// ---------------------------------------------------------------------------------------------
// Guarding the keys. Captain PINs are short so they are easy to read out on a call; to keep them
// from being guessed, an address that keeps presenting *wrong* keys is throttled. Requests with a
// valid key are never affected, so one misbehaving tab cannot lock out an office behind one IP.
// ---------------------------------------------------------------------------------------------

const BAD_KEY_LIMIT = Number(process.env.BAD_KEY_LIMIT ?? 120); // wrong keys per minute per address
const badKeys = new Map<string, { count: number; reset: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of badKeys) if (now > e.reset) badKeys.delete(ip);
}, 5 * 60_000).unref();

/** Resolves a key to a role, counting wrong keys against the caller's address. */
function authorize(ip: string, store: Store, key: unknown): Actor & { isAdmin: boolean } {
  const actor = resolveActor(store, key);
  if (typeof key === 'string' && key && actor.role === 'viewer') {
    const now = Date.now();
    let e = badKeys.get(ip);
    if (!e || now > e.reset) badKeys.set(ip, (e = { count: 0, reset: now + 60_000 }));
    if (++e.count > BAD_KEY_LIMIT) throw new AuctionError('Too many wrong keys from this connection — wait a minute and try again.', 429);
  }
  return actor;
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
  if (me.captainId) snap.strategy = store.strategies[me.captainId] ?? []; // a captain's plan is private to them
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
      if (c.me.captainId) snap.strategy = store.strategies[c.me.captainId] ?? [];
      payload = JSON.stringify(snap);
      plain.set(cacheKey, payload);
    }
    try {
      c.send(payload);
    } catch {
      /* a dead socket is cleaned up by its own close handler */
    }
  }
}

// One debounce timer per auction (a shared one would drop updates for all but one of them).
const presenceTimers = new Map<string, NodeJS.Timeout>();
function broadcastPresenceSoon(store: Store) {
  const code = store.data.code;
  if (presenceTimers.has(code)) return;
  presenceTimers.set(
    code,
    setTimeout(() => {
      presenceTimers.delete(code);
      broadcast(store);
    }, 400),
  );
}

function register(store: Store, client: Client): () => void {
  let set = clients.get(store.data.code);
  if (!set) clients.set(store.data.code, (set = new Set()));
  set.add(client);
  broadcastPresenceSoon(store);
  return () => {
    set!.delete(client);
    broadcastPresenceSoon(store);
  };
}

/**
 * Things that happen by themselves — the wheel stopping, a strategy break running out — are driven
 * by the server so every screen changes together, even if nobody clicks anything.
 */
function scheduleTimers(store: Store) {
  const code = store.data.code;
  clearTimeout(spinTimers.get(code));
  spinTimers.delete(code);
  const due = nextDue(store);
  if (due === null) return;
  spinTimers.set(
    code,
    setTimeout(() => {
      if (tick(store, Date.now())) {
        saveSoon(store);
        broadcast(store);
      }
      scheduleTimers(store);
    }, Math.max(0, due - Date.now()) + 25),
  );
}
for (const s of events.values()) {
  tick(s, Date.now());
  scheduleTimers(s);
}

// ---------------------------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------------------------

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
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
    const actor = authorize(req.ip ?? '', store, req.query.key);
    res.json(snapshot(store, { role: actor.role, captainId: actor.captainId }, actor.isAdmin));
  }),
);

/** Fallback transport for networks that block WebSockets. The app prefers /ws (see below). */
app.get('/api/events/:code/stream', (req, res, next) => {
  let store: Store;
  try {
    store = findEvent(req);
  } catch (err) {
    return next(err);
  }
  let actor: ReturnType<typeof authorize>;
  try {
    actor = authorize(req.ip ?? '', store, req.query.key);
  } catch (err) {
    return next(err);
  }
  const client: Client = {
    send: (json) => res.write(`data: ${json}\n\n`),
    me: { role: actor.role, captainId: actor.captainId },
    isAdmin: actor.isAdmin,
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  const unregister = register(store, client);
  client.send(JSON.stringify(snapshot(store, client.me, client.isAdmin)));

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unregister();
  });
});

app.post(
  '/api/events/:code/cmd',
  wrap((req, res) => {
    const store = findEvent(req);
    const key = req.header('x-key') ?? req.body?.key;
    const actor = authorize(req.ip ?? '', store, key);
    const action = String(req.body?.action ?? '');
    const result = runAction(store, actor, action, req.body?.params);
    saveSoon(store);
    scheduleTimers(store);
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
    const actor = authorize(req.ip ?? '', store, req.header('x-key'));
    if (actor.role !== 'admin') throw new AuctionError('You are not allowed to do that', 403);
    const ext = EXT[String(req.header('content-type') ?? '').split(';')[0]];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new AuctionError('Upload a JPEG, PNG or WebP image');
    const dir = path.join(UPLOADS_DIR, store.data.code);
    mkdirSync(dir, { recursive: true });
    if (readdirSync(dir).length >= MAX_UPLOADS_PER_AUCTION) throw new AuctionError(`This auction has reached its ${MAX_UPLOADS_PER_AUCTION}-photo limit`);
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
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ Port ${PORT} is already in use — another copy of ZenoBid is probably still running.\n  Close the other terminal window (Ctrl+C) and start again. Auctions are saved on disk, nothing is lost.\n`);
  } else console.error(err);
  process.exit(1);
});

// ---------------------------------------------------------------------------------------------
// WebSocket live updates.
// Browsers allow only ~6 HTTP connections per site, and every open tab used to hold one for its
// live stream — so with 6+ tabs open, button clicks queued forever. WebSockets are not part of
// that pool, so any number of tabs (captains, auctioneer, big screen) work side by side.
// ---------------------------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const alive = new WeakMap<WebSocket, boolean>();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = /^\/api\/events\/([A-Za-z0-9]+)\/ws$/.exec(url.pathname);
  const store = match ? events.get(match[1].toUpperCase()) : undefined;
  if (!match || !store) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  let actor: ReturnType<typeof authorize>;
  try {
    actor = authorize(req.socket.remoteAddress ?? '', store, url.searchParams.get('key'));
  } catch {
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    tick(store, Date.now());
    const client: Client = {
      send: (json) => ws.readyState === ws.OPEN && ws.send(json),
      me: { role: actor.role, captainId: actor.captainId },
      isAdmin: actor.isAdmin,
    };
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', () => ws.terminate());
    const unregister = register(store, client);
    ws.on('close', unregister);
    client.send(JSON.stringify(snapshot(store, client.me, client.isAdmin)));
  });
});

// Drop connections whose browser vanished (closed laptop, lost Wi-Fi) so presence stays truthful.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 25_000);
heartbeat.unref();

function shutdown() {
  flushAll(events.values());
  for (const ws of wss.clients) ws.terminate();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
// A live auction must not die because of one unexpected error in a timer or a callback.
process.on('uncaughtException', (err) => console.error('Uncaught exception (auction keeps running):', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection (auction keeps running):', err));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
