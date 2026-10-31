import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from './net';

test('uses the real visitor address behind a proxy, but never trusts a forged header without one', () => {
  assert.equal(clientIp('172.18.0.2', '203.0.113.9', true), '203.0.113.9'); // Caddy → app
  assert.equal(clientIp('172.18.0.2', '6.6.6.6, 203.0.113.9', true), '203.0.113.9'); // a spoofed first entry is ignored
  assert.equal(clientIp('198.51.100.4', '6.6.6.6', false), '198.51.100.4'); // no proxy configured: header ignored
  assert.equal(clientIp('172.18.0.2', undefined, true), '172.18.0.2');
  assert.equal(clientIp(undefined, undefined, false), '');
  assert.equal(clientIp('10.0.0.1', ['1.1.1.1', '2.2.2.2'], true), '2.2.2.2');
});
