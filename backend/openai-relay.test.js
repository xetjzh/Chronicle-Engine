import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { createRuntime } from './app.js';
import { readConfig, DEFAULT_PROXY_MARKER } from './config.js';

const origin = 'http://localhost:18080', marker = 'relay-test-marker';
const target = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const config = extra => readConfig({ OPENAI_PROXY_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4', OPENAI_PROXY_ALLOWED_ORIGINS: origin, PROXY_HEADER: marker, ...extra });
const body = (extra = {}) => ({ upstreamUrl: target, headers: { Authorization: 'Bearer test-user-key' }, body: { model: 'glm-5.3', messages: [{ role: 'user', content: '测试' }], stream: false }, ...extra });
const post = (url, value = body(), headers = {}, signal) => fetch(url + '/api/openai/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-app-proxy': marker, ...headers }, body: JSON.stringify(value), signal });
async function start(t, settings = config(), deps = {}) {
  const runtime = createRuntime(settings, { logger: { info() {}, warn() {}, error() {} }, ...deps });
  runtime.server.listen(0, '127.0.0.1'); await once(runtime.server, 'listening');
  t.after(() => runtime.shutdown()); return { ...runtime, url: `http://127.0.0.1:${runtime.server.address().port}` };
}

test('relay is opt-in and validates a fixed HTTPS target and explicit origins without echoing values', () => {
  assert.equal(readConfig({}).openaiProxyEndpoint, undefined);
  assert.equal(config().openaiProxyEndpoint, target);
  assert.equal(config({ OPENAI_PROXY_BASE_URL: target + '/' }).openaiProxyEndpoint, target);
  for (const extra of [{ OPENAI_PROXY_ALLOWED_ORIGINS: '' }, { OPENAI_PROXY_ALLOWED_ORIGINS: '*' }, { OPENAI_PROXY_ALLOWED_ORIGINS: origin + '/' }, { OPENAI_PROXY_BASE_URL: 'http://private.test' }, { OPENAI_PROXY_BASE_URL: 'https://user:secret@example.test' }, { OPENAI_PROXY_BASE_URL: 'https://example.test?key=secret' }, { PROXY_HEADER: '' }]) {
    assert.throws(() => config(extra), error => !error.message.includes('secret'));
  }
});

test('relay rejects disabled, foreign origin, target changes, unsafe headers, malformed body and oversize before upstream', async t => {
  let calls = 0; const deps = { fetch: () => { calls++; throw Error('unexpected'); }, getAccessToken: () => { throw Error('Google credentials not needed'); } };
  const off = await start(t, readConfig({}), deps); assert.equal((await post(off.url)).status, 503);
  const runtime = await start(t, config({ API_PAYLOAD_MAX_SIZE: '1kb' }), deps);
  for (const headers of [{ origin: 'https://attacker.test' }, { origin: 'null' }, { 'x-app-proxy': 'wrong' }]) assert.equal((await post(runtime.url, body(), headers)).status, 403);
  for (const value of [body({ upstreamUrl: 'https://attacker.test/chat/completions' }), body({ headers: { Host: 'private.test' } }), body({ body: { model: 'glm-5.3', messages: [], stream: false } }), body({ body: { ...body().body, unexpected: true } }), body({body:{...body().body,reasoning_effort:'disabled'}}), body({body:{...body().body,reasoning_effort:{invalid:true}}})]) assert.equal((await post(runtime.url, value)).status, 400);
  assert.equal((await post(runtime.url, body({ headers: {} }))).status, 401);
  assert.equal((await post(runtime.url, body({ body: { ...body().body, messages: [{role:'user',content:'x'.repeat(2000)}] } }))).status, 413);
  assert.equal((await fetch(runtime.url + '/api/openai/chat/completions')).status, 405); assert.equal(calls, 0);
});

test('relay sends user credentials only to the configured endpoint and returns JSON with Vertex disabled', async t => {
  const runtime = await start(t, config(), { getAccessToken: () => { throw Error('must not use ADC'); }, fetch: async (url, init) => {
    assert.equal(url, target); assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    const headers = new Headers(init.headers); assert.equal(headers.get('authorization'), 'Bearer test-user-key');
    assert.equal(headers.get('cookie'), null); assert.equal(headers.get('origin'), null); assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(JSON.parse(init.body).model, 'glm-5.3'); return Response.json({ choices: [{ message: { content: '服务器回复' } }] });
  } });
  const response = await post(runtime.url, body(), { cookie: 'private-session' }); assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, '服务器回复');
  assert.equal((await (await fetch(runtime.url + '/readyz')).json()).openaiProxyEnabled, true);
});

test('relay preserves SSE bytes and aborts upstream when the browser cancels', async t => {
  let upstreamSignal, canceled = false;
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"实时你好"}}]}\n\n');
  const runtime = await start(t, config(), { fetch: async (_url, init) => {
    upstreamSignal = init.signal;
    return new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 50)); c.enqueue(bytes.slice(50)); }, cancel() { canceled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  } });
  const controller = new AbortController(); const response = await post(runtime.url, body({ body: { ...body().body, stream: true } }), {}, controller.signal);
  assert.match(response.headers.get('content-type'), /text\/event-stream/); const reader = response.body.getReader();
  let received = ''; const decoder = new TextDecoder(); while (!received.endsWith('\n\n')) received += decoder.decode((await reader.read()).value, {stream:true});
  assert.equal(received, new TextDecoder().decode(bytes)); controller.abort(); await reader.cancel().catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(upstreamSignal.aborted, true); assert.equal(canceled, true);
});

test('relay times out body reads and redacts rejected upstream responses and logs', async t => {
  const logs = [], logger = {info(...x){logs.push(x);},warn(...x){logs.push(x);},error(...x){logs.push(x);}};
  const timeout = await start(t, config({ API_TIMEOUT_MS: '100' }), { logger, fetch: async () => new Response(new ReadableStream({ start() {} }), {headers:{'content-type':'application/json'}}) });
  const timed = await post(timeout.url); assert.equal(timed.status, 504); assert.equal(timed.headers.get('x-chronicle-proxy-error'), 'timeout');
  const rejected = await start(t, config(), { logger, fetch: async () => new Response('test-user-key private-prompt', {status:403}) });
  const response = await post(rejected.url); assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /test-user-key|private-prompt/);
  assert.doesNotMatch(JSON.stringify(logs), /test-user-key|private-prompt/);
});

test('relay completes native SSE and marks a late stream error rather than committing partial text', async t => {
  let fail = false;
  const text = 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n';
  const runtime = await start(t, config(), { fetch: async () => new Response(new ReadableStream({ start(c) {
    if (!fail) { c.enqueue(new TextEncoder().encode(text)); c.close(); }
    else { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n')); setTimeout(() => c.error(Error('credential private-prompt')), 10); }
  } }), {headers:{'content-type':'text/event-stream'}}) });
  const response = await post(runtime.url, body({body:{...body().body,stream:true}})); assert.equal(await response.text(), text);
  fail = true; const broken = await post(runtime.url, body({body:{...body().body,stream:true}}));
  const partial = await broken.text(); assert.match(partial, /event: error/); assert.doesNotMatch(partial, /credential|private-prompt/);
  runtime.beginDrain(); assert.equal((await post(runtime.url)).status, 503);
});

test('relay rejects redirects and a JSON response exceeding its memory bound', async t => {
  let redirected = false;
  const runtime = await start(t, config(), { fetch: async (_url, init) => {
    assert.equal(init.redirect, 'error');
    if (!redirected) { redirected = true; return new Response(null, {status:302,headers:{location:'https://private.test'}}); }
    return new Response(' '.repeat(8 * 1024 * 1024 + 1), {headers:{'content-type':'application/json'}});
  } });
  assert.equal((await post(runtime.url)).status, 502); assert.equal((await post(runtime.url)).status, 502);
});

test('actual frontend provider service completes health and streamed generation through the real HTTP relay', async t => {
  let calls = 0;
  const runtime = await start(t, config({ PROXY_HEADER: DEFAULT_PROXY_MARKER }), {fetch: async (_url, init) => {
    calls++; assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-user-key');
    const payload = JSON.parse(init.body);
    if (calls === 1) { assert.equal(payload.reasoning_effort, 'low'); assert.equal(payload.max_tokens, 2048); }
    else assert.equal(payload.reasoning_effort, 'low');
    return payload.stream
      ? new Response('data: {"choices":[{"delta":{"content":"实时回复"}}]}\n\ndata: [DONE]\n\n', {headers:{'content-type':'text/event-stream'}})
      : Response.json({choices:[{message:{content:'就绪'}}]});
  }});
  const require = createRequire(import.meta.url);
  const {loadService} = require('../frontend/testSupport/loadService.cjs');
  const {AIProviderService} = loadService(fileURLToPath(new URL('../frontend/services/aiProviderService.ts', import.meta.url)), {}, {
    Headers, performance, setTimeout, clearTimeout,
    fetch: (path, init) => { assert.equal(path, '/api/openai/chat/completions'); const headers = new Headers(init.headers); headers.set('origin', origin); return fetch(runtime.url + path, {...init,headers}); },
  });
  const input = {activeProvider:'openai_compatible',sampling:{maxTokens:100},openaiCompatible:{baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-5.3',apiKey:'test-user-key',useServerProxy:true}};
  assert.equal((await AIProviderService.testProviderHealth('openai_compatible', input)).ok, true);
  const deltas = []; assert.equal(await AIProviderService.generateText(input,{prompt:'写作',onText:d=>deltas.push(d)}), '实时回复');
  assert.equal(deltas.join(''), '实时回复'); assert.equal(calls, 2);
});

test('an upload admitted before shutdown cannot start a new upstream call after its body finishes', async t => {
  let calls = 0;
  const runtime = await start(t, config(), { fetch: async () => { calls++; return Response.json({choices:[{message:{content:'unexpected'}}]}); } });
  const payload = JSON.stringify(body());
  const response = await new Promise((resolve, reject) => {
    const upload = httpRequest(runtime.url + '/api/openai/chat/completions', {method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(payload),origin,'x-app-proxy':marker}}, res => { res.resume(); res.once('end', () => resolve(res.statusCode)); });
    upload.once('error', reject);
    // The app's request listener has already admitted this upload and attached
    // express.json; its full body is intentionally withheld until shutdown.
    runtime.server.once('request', () => { void runtime.shutdown(); upload.end(payload.slice(20)); });
    upload.write(payload.slice(0,20));
  });
  assert.equal(response, 503); assert.equal(calls, 0);
});
