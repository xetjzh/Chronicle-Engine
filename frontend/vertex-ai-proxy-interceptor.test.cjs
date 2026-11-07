const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const target = 'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-test:generateContent';
function browser(fetchImpl = async () => new Response('{}')) {
  const calls = [];
  class Socket { constructor(...args) { this.args = args; } }
  Object.assign(Socket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  const scope = {
    fetch: (...args) => { calls.push(args); return fetchImpl(...args); },
    WebSocket: Socket, URL, Request, Headers, Response, TextDecoder, DOMException,
    location: { protocol: 'https:', host: 'writing.test' },
    console: { log() {}, error() {} },
  };
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'vertex-ai-proxy-interceptor.js'), 'utf8'), scope);
  return { scope, calls, Socket };
}

test('proxy accepts URL inputs and sends JSON body through the local transport', async () => {
  const { scope, calls } = browser();
  await scope.fetch(new URL(target + '?alt=sse'), { method: 'POST', body: '{"contents":[]}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(calls[0][0], '/api-proxy');
  const envelope = JSON.parse(calls[0][1].body);
  assert.equal(envelope.originalUrl, target);
  assert.equal(envelope.body, '{"contents":[]}');
  assert.equal(envelope.headers['content-type'], 'application/json');
});

test('proxy preserves Request body, method, allowed headers and caller cancellation', async () => {
  const controller = new AbortController();
  const request = new Request(target, { method: 'POST', body: '{"contents":[{"parts":[{"text":"hello"}]}]}', signal: controller.signal,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Client': 'sdk/test', Authorization: 'Bearer private-key', 'X-Goog-Api-Key': 'private-key' } });
  const { scope, calls } = browser();
  await scope.fetch(request);
  const envelope = JSON.parse(calls[0][1].body);
  assert.equal(envelope.method, 'POST');
  assert.equal(envelope.body, '{"contents":[{"parts":[{"text":"hello"}]}]}');
  assert.equal(envelope.headers['x-goog-api-client'], 'sdk/test');
  assert.equal(envelope.headers.authorization, undefined);
  assert.equal(envelope.headers['x-goog-api-key'], undefined);
  controller.abort();
  assert.equal(calls[0][1].signal.aborted, true);
});

test('aborted requests reject without being sent and transport errors remain rejected fetches', async () => {
  const { scope, calls } = browser();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(scope.fetch(target, { method: 'POST', body: '{}', signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls.length, 0);
  const unavailable = browser(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(unavailable.scope.fetch(target, { method: 'POST', body: '{}' }), { name: 'TypeError' });
});

test('cancellation aborts the real proxy request and stops reading a pending request body', async () => {
  const controller = new AbortController();
  const remote = browser((_input, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    queueMicrotask(() => controller.abort());
  }));
  await assert.rejects(remote.scope.fetch(target, { method: 'POST', body: '{}', signal: controller.signal }), { name: 'AbortError' });
  let cancelled = false;
  const pendingBody = new ReadableStream({ cancel() { cancelled = true; } });
  const readerController = new AbortController();
  const request = new Request(target, { method: 'POST', body: pendingBody, duplex: 'half', signal: readerController.signal });
  const { scope, calls } = browser();
  const pending = scope.fetch(request);
  readerController.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, true);
  assert.equal(calls.length, 0);
});

test('unrelated requests retain native fetch arguments and live sockets keep protocol constants', async () => {
  const { scope, calls, Socket } = browser();
  const input = new Request('https://other.test/data');
  const init = { headers: { accept: 'text/plain' } };
  await scope.fetch(input, init);
  assert.strictEqual(calls[0][0], input);
  assert.strictEqual(calls[0][1], init);
  const live = 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
  const ws = new scope.WebSocket(live, ['protocol']);
  assert.ok(ws instanceof Socket);
  assert.equal(ws.args[0], 'wss://writing.test/ws-proxy?target=' + encodeURIComponent(live));
  assert.equal(scope.WebSocket.OPEN, 1);
});

test('installed browser Gemini SDK completes generation through the real shim without forwarding its API key', async () => {
  const { GoogleGenAI } = await import('@google/genai/web');
  const { validateProxiedRequestBody } = await import('../backend/proxy-policy.js');
  const { scope, calls } = browser(async () => Response.json({
    candidates: [{ content: { role: 'model', parts: [{ text: '就绪' }] }, finishReason: 'STOP' }],
  }));
  const original = globalThis.fetch;
  globalThis.fetch = scope.fetch;
  try {
    const ai = new GoogleGenAI({ vertexai: true, apiKey: 'sdk-test-placeholder' });
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: '测试', config: {
      temperature: 0.75, maxOutputTokens: 128, thinkingConfig: { thinkingBudget: 0 },
      abortSignal: new AbortController().signal, httpOptions: { timeout: 20000, retryOptions: { attempts: 1 } },
    } });
    assert.equal(response.text, '就绪');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '/api-proxy');
    const envelope = JSON.parse(calls[0][1].body);
    assert.match(envelope.originalUrl, /publishers\/google\/models\/gemini-2\.5-flash:generateContent$/);
    assert.equal(validateProxiedRequestBody(envelope.body, 'generate_content').allowed, true);
    assert.doesNotMatch(calls[0][1].body, /sdk-test-placeholder/);
  } finally {
    globalThis.fetch = original;
  }
});
