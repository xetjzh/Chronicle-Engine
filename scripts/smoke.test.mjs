import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { verifyDeployment } from './smoke.mjs';

async function fixture(t, overrides = {}) {
  const routes = {
    '/healthz': [200, 'application/json', '{"status":"ok"}'],
    '/readyz': [200, 'application/json', '{"status":"ready","aiProxyEnabled":false}'],
    '/': [200, 'text/html', '<div id="root"></div><script src="/assets/app-123.js"></script><link rel="stylesheet" href="/assets/app-123.css">', 'no-cache'],
    '/index.html': [200, 'text/html', '<div id="root"></div>', 'no-cache'],
    '/assets/app-123.js': [200, 'application/javascript', 'console.log("ok")', 'public, max-age=31536000, immutable'],
    '/assets/app-123.css': [200, 'text/css', 'body {}', 'public, max-age=31536000, immutable'],
    '/api-proxy': [503, 'application/json', '{"error":"AI proxy disabled"}'],
    ...overrides,
  };
  const server = createServer((req, res) => {
    const [status, contentType, body, cache = 'no-store'] = routes[req.url] || [404, 'application/json', '{}'];
    res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': cache });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('smoke accepts a working no-credential deployment and verifies its assets', async t => {
  const result = await verifyDeployment(await fixture(t));
  assert.equal(result.aiProxyEnabled, false);
  assert.equal(result.assetsChecked, 2);
});

test('smoke rejects HTML fallback hiding a missing JavaScript bundle', async t => {
  const base = await fixture(t, { '/assets/app-123.js': [200, 'text/html', '<html></html>'] });
  await assert.rejects(verifyDeployment(base), /JavaScript|javascript/i);
});

test('smoke rejects unready service and cacheable entry HTML', async t => {
  const unready = await fixture(t, { '/readyz': [503, 'application/json', '{"status":"draining"}'] });
  await assert.rejects(verifyDeployment(unready), /readyz.*503/i);
  const stale = await fixture(t, { '/index.html': [200, 'text/html', '<html></html>', 'public, max-age=31536000'] });
  await assert.rejects(verifyDeployment(stale), /index.html.*cache/i);
});

test('a credential-free delivery check rejects an unexpectedly enabled AI proxy', async t => {
  const enabled = await fixture(t, { '/readyz': [200, 'application/json', '{"status":"ready","aiProxyEnabled":true}'] });
  await assert.rejects(verifyDeployment(enabled, { expectedAiProxyEnabled: false }), /AI proxy state/i);
  assert.equal((await verifyDeployment(enabled)).aiProxyEnabled, true);
});
