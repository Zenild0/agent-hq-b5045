import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { plan, runJob } from './job.js';
import { loadProfile, saveProfile, loadHistory } from './store.js';
import { validatePassengers } from './validate.js';
import { createBus } from './log.js';
import { formatIST } from './schedule.js';

const INDEX = fileURLToPath(new URL('../ui/index.html', import.meta.url));

/**
 * Local-only control panel. Safe-by-construction against other web pages / other machines:
 * bound to 127.0.0.1, per-run random token on every request, Host header must be loopback
 * (blocks DNS rebinding), and no CORS headers are ever sent.
 */
export async function startServer({ port = 0 } = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  const bus = createBus();
  const history = []; // events of the current/last job
  bus.on('event', (e) => history.push(e) > 500 && history.shift());
  let job = null; // {abort, mode, request}
  const clients = new Set();
  bus.on('event', (e) => clients.forEach((res) => res.write(`data: ${JSON.stringify(e)}\n\n`)));

  const okToken = (t) => typeof t === 'string' && t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token));
  const readBody = (req) => new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 100_000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
    try {
      const host = (req.headers.host ?? '').split(':')[0];
      if (!['127.0.0.1', 'localhost'].includes(host)) return send(403, { error: 'bad host' });
      if (url.pathname === '/favicon.ico') return res.writeHead(204).end();
      if (!okToken(url.searchParams.get('t'))) return send(403, { error: 'bad token - open the URL printed in your terminal' });

      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
          'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'" });
        return res.end(fs.readFileSync(INDEX));
      }
      if (url.pathname === '/api/state') {
        return send(200, { profile: loadProfile(), history: loadHistory(), running: job ? { mode: job.mode, request: job.request } : null, events: history });
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.write(': hi\n\n');
        clients.add(res);
        return req.on('close', () => clients.delete(res));
      }
      if (req.method !== 'POST') return send(404, { error: 'not found' });
      const body = await readBody(req);

      if (url.pathname === '/api/profile') {
        const { errors: real } = validatePassengers(body.passengers, body.contact);
        if (real.length) return send(400, { error: real.join(' ') });
        return send(200, { profile: saveProfile({ ...loadProfile(), ...body }) });
      }
      if (url.pathname === '/api/plan') {
        const p = plan(body.text, loadProfile());
        return send(200, { ...p, openAtText: p.openAt ? formatIST(p.openAt) : null });
      }
      if (url.pathname === '/api/arm') {
        if (job) return send(409, { error: 'A booking is already running. Stop it first.' });
        let profile = loadProfile();
        if (body.mode !== 'assist') {
          if (!body.acceptRisk && !profile.riskAcknowledged) return send(400, { error: 'Please tick the box to accept the IRCTC automation risk, or use assist-only mode.' });
          if (!profile.riskAcknowledged) profile = saveProfile({ ...profile, riskAcknowledged: true });
        }
        const p = plan(body.text, profile);
        if (p.problems.length) return send(400, { error: p.problems.join(' ') });
        const ac = new AbortController();
        job = { abort: () => ac.abort(), mode: body.mode === 'assist' ? 'assist' : 'auto', request: p.request };
        history.length = 0;
        runJob({ mode: job.mode, request: p.request, profile, openAt: p.openNow ? null : p.openAt, bus, signal: ac.signal })
          .then((r) => bus.log('finished', r?.pnr ? `Done. PNR ${r.pnr}` : 'Done.'))
          .catch((e) => bus.log('error', String(e.message ?? e)))
          .finally(() => { job = null; });
        return send(200, { ok: true });
      }
      if (url.pathname === '/api/stop') {
        job?.abort();
        return send(200, { ok: true });
      }
      return send(404, { error: 'not found' });
    } catch (e) {
      return send(400, { error: String(e.message ?? e) });
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const addr = server.address();
  return { url: `http://127.0.0.1:${addr.port}/?t=${token}`, close: () => { job?.abort(); clients.forEach((c) => c.end()); return new Promise((r) => server.close(r)); } };
}
