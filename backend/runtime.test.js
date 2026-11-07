import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { once, EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { readConfig } from './config.js';
import { createRuntime } from './app.js';

const marker = 'public-test-marker';
const origin = 'http://localhost:5173';
const endpoint = 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-test:generateContent';
const liveTarget = 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
const silent = { info() {}, warn() {}, error() {} };
const enabled = (extra = {}) => readConfig({ AI_PROXY_ENABLED: 'true', GOOGLE_CLOUD_PROJECT: 'test-project', GOOGLE_CLOUD_LOCATION: 'us-central1', API_ALLOWED_ORIGINS: origin, PROXY_HEADER: marker, ...extra });

async function start(t, config = readConfig({}), dependencies = {}) {
  const runtime = createRuntime(config, { logger: silent, ...dependencies });
  runtime.server.listen(0, '127.0.0.1');
  await once(runtime.server, 'listening');
  t.after(() => runtime.shutdown());
  return { ...runtime, url: `http://127.0.0.1:${runtime.server.address().port}` };
}

function proxy(url, body, headers = {}) {
  return fetch(`${url}/api-proxy`, { method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-app-proxy': marker, ...headers }, body: JSON.stringify(body) });
}

test('configuration permits credential-free startup and rejects unsafe settings without echoing values', () => {
  assert.equal(readConfig({}).aiProxyEnabled, false);
  assert.equal(readConfig({}).trustProxy, false);
  for (const env of [
    { AI_PROXY_ENABLED: 'yes' }, { API_BACKEND_PORT: '0' }, { API_BACKEND_PORT: '5oops' },
    { API_TIMEOUT_MS: 'Infinity' }, { API_PAYLOAD_MAX_SIZE: '500mb' }, { TRUST_PROXY: 'true' }, { TRUST_PROXY: '1' },
    { TRUST_PROXY: '10.0.0.0/99' }, { AI_PROXY_ENABLED: 'true' },
  ]) assert.throws(() => readConfig(env));
  assert.deepEqual(readConfig({ TRUST_PROXY: '127.0.0.1,10.0.0.0/8' }).trustProxy, ['127.0.0.1', '10.0.0.0/8']);
  for (const value of ['*', 'https://example.test/path', 'https://user:password@example.test', 'null']) {
    assert.throws(() => enabled({ API_ALLOWED_ORIGINS: value }), error => !error.message.includes(value));
  }
});

test('health and readiness do not acquire credentials and disabled proxy is explicit', async t => {
  const runtime = await start(t, readConfig({}), { getAccessToken: () => { throw new Error('credentials should not be requested'); } });
  assert.deepEqual(await (await fetch(`${runtime.url}/healthz`)).json(), { status: 'ok' });
  assert.deepEqual(await (await fetch(`${runtime.url}/readyz`)).json(), { status: 'ready', aiProxyEnabled: false });
  const disabled = await proxy(runtime.url, {});
  assert.equal(disabled.status, 503);
  assert.match(disabled.headers.get('content-type'), /application\/json/);
  runtime.beginDrain();
  assert.equal((await fetch(`${runtime.url}/readyz`)).status, 503);
  assert.equal((await fetch(`${runtime.url}/healthz`)).status, 200);
});

test('static delivery caches hashed assets and never hides missing API or assets with HTML', async t => {
  const checkout = await mkdtemp(join(tmpdir(), 'chronicle-static-'));
  t.after(() => rm(checkout, { recursive: true, force: true }));
  // A checkout's private ancestor is not a requested dotfile. Static delivery
  // must work in hidden worktrees without exposing hidden files in dist.
  const directory = join(checkout, '.worktree', 'frontend', 'dist');
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>fixture</title>');
  await writeFile(join(directory, 'assets', 'index-AbCd1234.js'), 'export {};');
  const runtime = await start(t, readConfig({ SERVE_FRONTEND: 'true' }), { frontendRoot: directory });
  for (const path of ['/', '/index.html', '/writing/desk']) {
    const res = await fetch(runtime.url + path, { headers: { accept: 'text/html' } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /no-cache|no-store/);
    assert.match(await res.text(), /<title>fixture/);
  }
  const asset = await fetch(`${runtime.url}/assets/index-AbCd1234.js`);
  assert.match(asset.headers.get('cache-control'), /max-age=31536000.*immutable/);
  for (const path of ['/api/not-found', '/api-proxy/nope', '/ws-proxy', '/assets/not-found.js', '/assets/missing', '/missing.js', '/.env.local']) {
    const res = await fetch(runtime.url + path, { headers: { accept: 'text/html' } });
    assert.equal(res.status, 404, path);
    assert.doesNotMatch(await res.text(), /<title>fixture/);
  }
});

test('missing frontend build fails before listening', () => {
  assert.throws(() => createRuntime(readConfig({ SERVE_FRONTEND: 'true' }), { frontendRoot: join(tmpdir(), 'chronicle-does-not-exist') }), /frontend/i);
});

test('proxy rejects malformed envelopes and untrusted origins before any upstream call', async t => {
  const runtime = await start(t, enabled(), { getAccessToken: () => { throw new Error('unexpected token'); } });
  for (const body of [null, [], { originalUrl: 1 }, { originalUrl: {} }, { originalUrl: endpoint, headers: [] }, { originalUrl: endpoint, headers: { accept: {} } }]) {
    assert.equal((await proxy(runtime.url, body)).status, 400, JSON.stringify(body));
  }
  for (const untrusted of ['http://localhost:5173.attacker.test', 'null', '']) {
    assert.equal((await proxy(runtime.url, { originalUrl: endpoint, body: '{}' }, { origin: untrusted })).status, 403);
  }
  const missing = await fetch(`${runtime.url}/api-proxy`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-proxy': marker }, body: '{}' });
  assert.equal(missing.status, 403);
  const invalid = await fetch(`${runtime.url}/api-proxy`, { method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-app-proxy': marker }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(await invalid.text(), /SyntaxError|node_modules|stack/);
  assert.equal((await proxy(runtime.url, {}, { 'x-app-proxy': 'wrong-public-marker' })).status, 403);
});

test('rate limit cannot be bypassed by spoofing X-Forwarded-For on a direct connection', async t => {
  const runtime = await start(t, enabled());
  for (let count = 0; count < 100; count++) {
    assert.equal((await proxy(runtime.url, {}, { 'x-forwarded-for': `203.0.113.${count}` })).status, 400);
  }
  assert.equal((await proxy(runtime.url, {}, { 'x-forwarded-for': '203.0.113.200' })).status, 429);
});

test('payload budget applies before cloud credentials and parser errors remain JSON', async t => {
  const runtime = await start(t, enabled({ API_PAYLOAD_MAX_SIZE: '1kb' }), { getAccessToken: () => { throw new Error('must reject before auth'); } });
  const res = await proxy(runtime.url, { originalUrl: endpoint, body: 'x'.repeat(2000) });
  assert.equal(res.status, 413);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.doesNotMatch(await res.text(), /stack|PayloadTooLargeError/);
});

test('proxy preserves body serialization and server credentials while retaining SSRF policies', async t => {
  const runtime = await start(t, enabled(), {
    getAccessToken: async () => 'server-token',
    fetch: async (url, options) => {
      assert.equal(url, 'https://aiplatform.clients6.google.com/v1/projects/test-project/locations/us-central1/publishers/google/models/gemini-test:generateContent');
      assert.equal(options.body, '{"contents":[{"parts":[{"text":"hello"}]}]}');
      const normalizedHeaders = new Headers(options.headers);
      assert.equal(normalizedHeaders.get('authorization'), 'Bearer server-token');
      assert.equal(normalizedHeaders.get('content-type'), 'application/json');
      assert.equal(options.headers['x-attacker-header'], undefined);
      assert.match(options.headers['x-goog-api-client'], /^test-client\/1 .*vertex-agent-studio-app-export\/1$/);
      assert.equal(options.redirect, 'error');
      return Response.json({ result: 'fixture' });
    },
  });
  const res = await proxy(runtime.url, { originalUrl: endpoint, headers: { Authorization: 'Bearer attacker', 'Content-Type': 'application/json', 'x-attacker-header': 'ignore', 'x-goog-api-client': 'test-client/1' }, body: { contents: [{ parts: [{ text: 'hello' }] }] } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { result: 'fixture' });
  for (const originalUrl of [endpoint.replace('aiplatform.googleapis.com', 'evil.test'), endpoint.replace('gemini-test', '..'), endpoint.replace('gemini-test', 'gemini%2fother')]) {
    assert.equal((await proxy(runtime.url, { originalUrl, body: '{}' })).status, 404);
  }
  assert.equal((await proxy(runtime.url, { originalUrl: endpoint, body: { contents: [{ parts: [{ fileData: { fileUri: 'gs://private' } }] }] } })).status, 400);
});

test('proxy failures and auth failures return redacted JSON and logs', async t => {
  const logs = [];
  const logger = { info: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) };
  for (const dependencies of [
    { getAccessToken: async () => { throw new Error('secret-token private-prompt'); } },
    { getAccessToken: async () => 'token', fetch: async () => { throw new Error('secret-token private-prompt'); } },
    { getAccessToken: async () => 'token', fetch: async () => new Response('secret-token private-prompt', { status: 403 }) },
  ]) {
    const runtime = await start(t, enabled(), { ...dependencies, logger });
    const res = await proxy(runtime.url, { originalUrl: endpoint, body: '{}' });
    assert.ok(res.status >= 400);
    assert.doesNotMatch(await res.text(), /secret-token|private-prompt|stack/);
  }
  assert.doesNotMatch(JSON.stringify(logs), /secret-token|private-prompt/);
});

test('streaming requests SSE upstream and forwards coalesced and split UTF-8 chunks without dropping content', async t => {
  const expected = 'data: {"text":"你好"}\n\ndata: {"text":"second"}\n\n';
  const bytes = new TextEncoder().encode(expected);
  const runtime = await start(t, enabled(), {
    getAccessToken: async () => 'token',
    fetch: async (url) => {
      assert.equal(new URL(url).searchParams.get('alt'), 'sse');
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, 17)); controller.enqueue(bytes.slice(17)); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
    },
  });
  const res = await proxy(runtime.url, { originalUrl: endpoint.replace(':generateContent', ':streamGenerateContent'), body: '{}' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  assert.equal(await res.text(), expected);
});

test('upstream timeout covers credential acquisition and aborts upstream work', async t => {
  for (const hangInAuth of [true, false]) {
    let signal;
    const runtime = await start(t, enabled({ API_TIMEOUT_MS: '100' }), {
      getAccessToken: async () => hangInAuth ? new Promise(() => {}) : 'token',
      fetch: async (_url, options) => { signal = options.signal; return new Promise(() => {}); },
    });
    const res = await proxy(runtime.url, { originalUrl: endpoint, body: '{}' });
    assert.equal(res.status, 504);
    if (signal) assert.equal(signal.aborted, true);
  }
});

test('client disconnect aborts an active upstream stream', async t => {
  let finish;
  const aborted = new Promise(resolve => { finish = resolve; });
  const runtime = await start(t, enabled(), {
    getAccessToken: async () => 'token',
    fetch: async (_url, options) => {
      options.signal.addEventListener('abort', finish, { once: true });
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {}\n\n')); } }), { headers: { 'content-type': 'text/event-stream' } });
    },
  });
  await new Promise((resolve, reject) => {
    const req = httpRequest(`${runtime.url}/api-proxy`, { method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-app-proxy': marker } }, res => { res.once('data', () => { res.destroy(); resolve(); }); });
    req.on('error', reject);
    req.end(JSON.stringify({ originalUrl: endpoint.replace(':generateContent', ':streamGenerateContent'), body: '{}' }));
  });
  await Promise.race([aborted, new Promise((_, reject) => setTimeout(() => reject(new Error('upstream did not abort')), 1000))]);
});

test('failed SSE transport sends a redacted SSE error and keeps the process healthy', async t => {
  const runtime = await start(t, enabled(), {
    getAccessToken: async () => 'token',
    fetch: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: {}\n\n')); },
      pull(controller) { controller.error(new Error('secret upstream message')); },
    }), { headers: { 'content-type': 'text/event-stream' } }),
  });
  const res = await proxy(runtime.url, { originalUrl: endpoint.replace(':generateContent', ':streamGenerateContent'), body: '{}' });
  const text = await res.text();
  assert.match(text, /event: error\ndata:/);
  assert.doesNotMatch(text, /secret upstream message/);
  assert.equal((await fetch(`${runtime.url}/healthz`)).status, 200);
});

class FakeUpstream extends EventEmitter {
  static OPEN = 1;
  readyState = 0;
  constructor() { super(); queueMicrotask(() => { this.readyState = 1; this.emit('open'); }); }
  send() {}
  close() { if (this.readyState === 3) return; this.readyState = 3; queueMicrotask(() => this.emit('close', 1000, Buffer.alloc(0))); }
  terminate() { this.close(); }
}

test('WebSocket upgrades require exact Origin and disabled live proxy never acquires credentials', async t => {
  for (const active of [false, true]) {
    const runtime = await start(t, active ? enabled() : readConfig({}), { getAccessToken: () => { throw new Error('must reject first'); } });
    for (const requestOrigin of [undefined, 'https://evil.test']) {
      const ws = new WebSocket(runtime.url.replace('http:', 'ws:') + '/ws-proxy?target=' + encodeURIComponent(liveTarget), requestOrigin ? { origin: requestOrigin } : {});
      const [error] = await once(ws, 'error');
      assert.match(error.message, active ? /403/ : /503/);
    }
  }
});

test('WebSocket routing safely ignores malformed Host grammar', async t => {
  const runtime = await start(t, enabled());
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(runtime.url + '/ws-proxy?target=' + encodeURIComponent(liveTarget), { headers: {
      host: ']', connection: 'Upgrade', upgrade: 'websocket', origin: 'https://untrusted.test',
      'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
    } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 403);
  assert.equal((await fetch(`${runtime.url}/healthz`)).status, 200);
});

test('malformed live setup closes only the connection and abnormal upstream closure is safe', async t => {
  let upstream;
  class CaptureUpstream extends FakeUpstream { constructor(...args) { super(...args); upstream = this; } }
  const runtime = await start(t, enabled(), { getAccessToken: async () => 'token', WebSocket: CaptureUpstream });
  const connect = () => new WebSocket(runtime.url.replace('http:', 'ws:') + '/ws-proxy?target=' + encodeURIComponent(liveTarget), { origin });
  const ws = connect();
  await once(ws, 'open');
  ws.send('{"setup":true}');
  assert.equal((await once(ws, 'close'))[0], 1008);
  const next = connect();
  await once(next, 'open');
  upstream.emit('close', 1006, Buffer.alloc(0));
  assert.equal((await once(next, 'close'))[0], 1011);
  assert.equal((await fetch(`${runtime.url}/healthz`)).status, 200);
});

test('shutdown bounds active HTTP and live connections and reports draining', async t => {
  const runtime = await start(t, enabled({ SHUTDOWN_TIMEOUT_MS: '100' }), { getAccessToken: async () => 'token', WebSocket: FakeUpstream });
  const ws = new WebSocket(runtime.url.replace('http:', 'ws:') + '/ws-proxy?target=' + encodeURIComponent(liveTarget), { origin });
  await once(ws, 'open');
  const closed = once(ws, 'close');
  const started = Date.now();
  await runtime.shutdown();
  assert.equal((await closed)[0], 1001);
  assert.ok(Date.now() - started < 1000);
  assert.equal(runtime.server.listening, false);
});
