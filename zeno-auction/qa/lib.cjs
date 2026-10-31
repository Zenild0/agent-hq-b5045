const { chromium } = require('playwright');
require('node:fs').mkdirSync(require('node:path').join(__dirname, 'out'), { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const fails = [];
const t = (name, cond, extra = '') => { if (cond) { pass++; } else { fails.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL', name, extra); } };
const api = {
  async create(settings = {}) { return (await fetch(BASE + '/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings }) })).json(); },
  cmd(code, key, action, params = {}) { return fetch(`${BASE}/api/events/${code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': key }, body: JSON.stringify({ action, params }) }).then(r => r.json()); },
  async state(code, key = '') { return (await fetch(`${BASE}/api/events/${code}/state${key ? '?key=' + key : ''}`)).json(); },
};
async function newPage(browser, w, h, errors, label, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) errors.push(`[${label}] console: ${m.text()}`); });
  p.on('dialog', (d) => { if (d.type() === 'alert') errors.push(`[${label}] ALERT FIRED (XSS?): ${d.message()}`); d.accept(); });
  p.on('response', (r) => { if (r.status() >= 500) errors.push(`[${label}] ${r.status()} ${r.url()}`); });
  return p;
}
function done(title, errors) {
  console.log(`\n${title}: ${pass} passed, ${fails.length} failed, ${errors.length} browser errors`);
  errors.slice(0, 15).forEach((e) => console.log('  ', e));
  process.exit(fails.length || errors.length ? 1 : 0);
}
module.exports = { chromium, BASE, sleep, t, api, newPage, done, get pass() { return pass; }, fails };
