const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadService } = require('../testSupport/loadService.cjs');
const file = path.join(__dirname, 'textStream.ts');
function response(parts, format) { return new Response(new ReadableStream({ start(c) { for (const p of parts) c.enqueue(new TextEncoder().encode(p)); c.close(); } }), { headers: { 'content-type': format === 'sse' ? 'text/event-stream' : 'application/x-ndjson' } }); }
test('SSE and NDJSON parse real split transport frames incrementally and require a final completion', async () => {
  const { readTextStream } = loadService(file); const deltas = [];
  const text = await readTextStream(response(['data: {"choices":[{"delta":{"content":"你"}}]}\r', '\n\r\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\n', 'data: [DONE]\n\n'], 'sse'), 'sse', x => deltas.push(x));
  assert.equal(text, '你好'); assert.equal(deltas.join('|'), '你|好');
  const nd = await readTextStream(response(['{"message":{"content":"甲"},"done":false}\n{"mess', 'age":{"content":"乙"},"done":true}\n'], 'ndjson'), 'ndjson', () => {}); assert.equal(nd, '甲乙');
  await assert.rejects(readTextStream(response(['data: {"choices":[{"delta":{"content":"残稿"}}]}\n\n'], 'sse'), 'sse', () => {}), /中断|完整/);
});
test('stream errors are redacted and cancellation cancels the underlying reader', async () => {
  const { readTextStream } = loadService(file); const controller = new AbortController(); let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"开始"}}]}\n\n')); }, cancel() { cancelled = true; } });
  await assert.rejects(readTextStream(new Response(body), 'sse', () => controller.abort(), controller.signal), /取消/); assert.equal(cancelled, true);
  await assert.rejects(readTextStream(response(['event: error\ndata: {"error":"SECRET_SHOULD_NOT_BE_SHOWN"}\n\n'], 'sse'), 'sse', () => {}), err => !err.message.includes('SECRET_SHOULD_NOT_BE_SHOWN'));
});
