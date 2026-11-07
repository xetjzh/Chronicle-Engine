import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

/** Checks the deployed HTTP contract without calling an AI provider. */
export async function verifyDeployment(address, { expectedAiProxyEnabled } = {}) {
  const base = new URL(address);
  assert(['http:', 'https:'].includes(base.protocol), 'Use an HTTP or HTTPS deployment URL');
  const get = async (path, options) => {
    const response = await fetch(new URL(path, base), {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    return response;
  };
  const jsonProbe = async (path, status) => {
    const response = await get(path);
    assert.equal(response.status, 200, `${path}: expected 200, received ${response.status}`);
    assert.match(response.headers.get('content-type') || '', /application\/json/i, `${path}: expected JSON`);
    const result = await response.json();
    assert.equal(result.status, status, `${path}: unexpected status`);
    return result;
  };
  await jsonProbe('/healthz', 'ok');
  const ready = await jsonProbe('/readyz', 'ready');
  assert.equal(typeof ready.aiProxyEnabled, 'boolean', '/readyz: missing AI proxy state');
  if (expectedAiProxyEnabled !== undefined) {
    assert.equal(ready.aiProxyEnabled, expectedAiProxyEnabled, '/readyz: unexpected AI proxy state');
  }

  let entry;
  for (const path of ['/', '/index.html']) {
    const response = await get(path);
    assert.equal(response.status, 200, `${path}: entry unavailable`);
    assert.match(response.headers.get('content-type') || '', /text\/html/i, `${path}: expected HTML`);
    assert.match(response.headers.get('cache-control') || '', /no-cache|no-store|max-age=0(?:\D|$)/i, `${path}: entry cache must allow immediate upgrades`);
    const html = await response.text();
    assert.match(html, /id=["']root["']/, `${path}: application root missing`);
    if (path === '/') entry = html;
  }

  const assets = [...new Set([...entry.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](\/assets\/[^"'<>]+)["']/gi)].map(match => match[1]))];
  assert(assets.some(path => path.endsWith('.js')), 'Entry must reference a JavaScript bundle');
  assert(assets.some(path => path.endsWith('.css')), 'Entry must reference a CSS bundle');
  for (const path of assets) {
    const response = await get(path);
    assert.equal(response.status, 200, `${path}: asset unavailable`);
    if (path.endsWith('.js')) assert.match(response.headers.get('content-type') || '', /javascript/i, `${path}: expected JavaScript`);
    if (path.endsWith('.css')) assert.match(response.headers.get('content-type') || '', /text\/css/i, `${path}: expected CSS`);
    const cache = response.headers.get('cache-control') || '';
    assert.match(cache, /immutable/i, `${path}: missing immutable cache`);
    assert.match(cache, /max-age=31536000(?:\D|$)/i, `${path}: expected one-year asset cache`);
    assert((await response.arrayBuffer()).byteLength > 0, `${path}: empty asset`);
  }

  for (const path of ['/api/not-found', '/assets/not-found.js']) {
    const response = await get(path);
    assert.equal(response.status, 404, `${path}: unknown routes must return 404`);
    await response.arrayBuffer();
  }
  if (!ready.aiProxyEnabled) {
    const response = await get('/api-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 503, 'Disabled AI proxy must return 503');
    assert.match(response.headers.get('content-type') || '', /application\/json/i, 'Disabled proxy must return JSON');
    await response.arrayBuffer();
  }
  return { aiProxyEnabled: ready.aiProxyEnabled, assetsChecked: assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[3];
    assert(mode === undefined || mode === '--expect-ai-disabled', 'Usage: node scripts/smoke.mjs [URL] [--expect-ai-disabled]');
    const result = await verifyDeployment(process.argv[2] || 'http://127.0.0.1:8080', {
      expectedAiProxyEnabled: mode === '--expect-ai-disabled' ? false : undefined,
    });
    console.log(`Smoke passed: health, readiness, entry, ${result.assetsChecked} assets and route boundaries. AI proxy ${result.aiProxyEnabled ? 'enabled' : 'disabled'}; no provider call made.`);
  } catch (error) {
    console.error(`Smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
