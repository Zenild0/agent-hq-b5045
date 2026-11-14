import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintTrail, TRAIL_MS } from '../public/trail.js';

const fakeCtx = () => { const calls = []; return new Proxy({ calls }, { get: (t, k) => (k === 'calls' ? calls : (...a) => { calls.push([String(k), ...a]); }), set: () => true }); };

test('the pitch trail draws the band, the line and a dot for the latest reading', () => {
  const ctx = fakeCtx(), now = 5000;
  const trail = [{ t: 1000, d: 0.3 }, { t: 2000, d: 0.1 }, { t: 3000, d: null }, { t: 4000, d: -0.2 }, { t: 4900, d: 0 }];
  const drawn = paintTrail(ctx, 560, 150, trail, now, 0.3, true);
  assert.equal(drawn, 4, 'the gap with no pitch is skipped, not drawn');
  const names = ctx.calls.map((c) => c[0]);
  assert.ok(names.includes('fillRect') && names.includes('stroke') && names.includes('arc'));
  assert.equal(names.filter((n) => n === 'moveTo').length, 2, 'the line is broken at the gap');
});

test('readings older than the window are not drawn, and wild readings stay on the canvas', () => {
  const ctx = fakeCtx();
  const drawn = paintTrail(ctx, 560, 150, [{ t: 0, d: 0 }, { t: TRAIL_MS + 100, d: 40 }, { t: TRAIL_MS + 200, d: -40 }], TRAIL_MS + 300, 0.2, false);
  assert.equal(drawn, 2);
  for (const c of ctx.calls.filter((x) => x[0] === 'lineTo' || x[0] === 'moveTo')) assert.ok(c[2] >= 0 && c[2] <= 150);
  assert.equal(paintTrail(fakeCtx(), 560, 150, [], 100, 0.2, false), 0, 'an empty trail is just the band');
});
