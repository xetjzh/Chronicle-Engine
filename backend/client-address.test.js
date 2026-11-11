import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTrustedClientIp } from './client-address.js';
const req = (peer, forwarded) => ({ socket: { remoteAddress: peer }, headers: { 'x-forwarded-for': forwarded } });
test('WS trusts forwarded addresses only through approved peers and walks from the nearest proxy', () => {
  const trust = value => ['127.0.0.1', '10.0.0.1'].includes(value);
  assert.equal(resolveTrustedClientIp(req('192.0.2.4', '203.0.113.8'), trust), '192.0.2.4');
  assert.equal(resolveTrustedClientIp(req('127.0.0.1', '203.0.113.8, 10.0.0.1'), trust), '203.0.113.8');
  assert.equal(resolveTrustedClientIp(req('127.0.0.1', '203.0.113.8, 192.0.2.9'), trust), '192.0.2.9');
  assert.equal(resolveTrustedClientIp(req('127.0.0.1', 'invented, header'), trust), '127.0.0.1');
  assert.equal(resolveTrustedClientIp(req('::ffff:192.0.2.4', '203.0.113.8'), () => false), '192.0.2.4');
});
