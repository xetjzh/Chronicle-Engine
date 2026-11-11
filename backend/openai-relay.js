import express from 'express';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const headerNames = new Set(['authorization', 'x-api-key', 'api-key', 'openai-organization', 'openai-project']);
const fields = new Set(['model', 'messages', 'stream', 'temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'max_tokens', 'stop']);
const maximumResponseBytes = 8 * 1024 * 1024;

function validBody(body) {
  return object(body) && Object.keys(body).every(key => fields.has(key))
    && typeof body.model === 'string' && body.model.trim().length > 0 && body.model.length <= 256
    && Array.isArray(body.messages) && body.messages.length > 0 && body.messages.length <= 1000
    && body.messages.every(m => object(m) && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    && (body.stream === undefined || typeof body.stream === 'boolean')
    && ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'max_tokens'].every(key => body[key] === undefined || (typeof body[key] === 'number' && Number.isFinite(body[key])))
    && (body.max_tokens === undefined || (Number.isInteger(body.max_tokens) && body.max_tokens > 0))
    && (body.stop === undefined || (Array.isArray(body.stop) && body.stop.length <= 64 && body.stop.every(s => typeof s === 'string' && s.length <= 4096)));
}

/** Fixed operator-selected upstream, per-request credentials, no redirects or arbitrary target proxy. */
export function attachOpenAIRelay(app, config, { upstreamFetch, controllers, abortable, limiter, logger, isDraining }) {
  const path = '/api/openai/chat/completions';
  const error = (res, status, code) => res.set({ 'X-Chronicle-Proxy-Error': code, 'Cache-Control': 'no-store' }).status(status).json({ error: code });
  const gate = (req, res, next) => {
    if (isDraining()) return error(res, 503, 'draining');
    if (!config.openaiProxyEndpoint) return error(res, 503, 'disabled');
    if (!config.openaiProxyOrigins.includes(req.headers.origin)) return error(res, 403, 'origin');
    if (req.headers['x-app-proxy'] !== config.proxyMarker) return error(res, 403, 'marker');
    next();
  };
  app.post(path, gate, limiter, express.json({ limit: config.payloadMaxBytes }), async (req, res) => {
    // Body parsing awaits the client's upload. Shutdown can begin after the
    // gate admitted it, before this handler registers its upstream controller.
    if (isDraining()) return error(res, 503, 'draining');
    const envelope = req.body;
    if (!object(envelope) || envelope.upstreamUrl !== config.openaiProxyEndpoint) return error(res, 400, 'target');
    if (!validBody(envelope.body) || !object(envelope.headers)) return error(res, 400, 'payload');
    const headers = new Headers({ 'content-type': 'application/json', accept: envelope.body.stream ? 'text/event-stream, application/json' : 'application/json' });
    try {
      if (Object.keys(envelope.headers).length > headerNames.size) return error(res, 400, 'headers');
      for (const [name, value] of Object.entries(envelope.headers)) {
        if (!headerNames.has(name.toLowerCase()) || typeof value !== 'string' || value.length > 8192 || headers.has(name)) return error(res, 400, 'headers');
        headers.set(name, value);
      }
    } catch { return error(res, 400, 'headers'); }
    if (!['authorization', 'x-api-key', 'api-key'].some(name => headers.get(name)?.trim())) return error(res, 401, 'authentication');
    const controller = new AbortController(); controllers.add(controller);
    let timedOut = false, reader;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(new Error('timeout')); }, config.apiTimeoutMs);
    const disconnect = () => { if (!res.writableEnded) controller.abort(new Error('disconnect')); };
    res.once('close', disconnect);
    try {
      const upstream = await abortable(() => upstreamFetch(config.openaiProxyEndpoint, { method: 'POST', redirect: 'error', headers, body: JSON.stringify(envelope.body), signal: controller.signal }), controller.signal);
      if (!upstream.ok) {
        void upstream.body?.cancel().catch(() => {});
        logger.warn('openai_upstream_rejected', { status: upstream.status });
        return error(res, upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502, 'upstream');
      }
      const contentType = upstream.headers.get('content-type')?.toLowerCase() || '';
      const streaming = envelope.body.stream && contentType.includes('text/event-stream');
      if (!upstream.body || (!streaming && !contentType.includes('application/json'))) throw new Error('Unexpected upstream format');
      if (streaming) {
        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }); res.flushHeaders();
      }
      reader = upstream.body.getReader(); let size = 0; const chunks = [];
      while (true) {
        const { value, done } = await abortable(() => reader.read(), controller.signal); if (done) break;
        size += value.byteLength; if (size > maximumResponseBytes) throw new Error('Response too large');
        if (streaming) { if (!res.write(value)) await abortable(() => new Promise(resolve => res.once('drain', resolve)), controller.signal); }
        else chunks.push(value);
      }
      if (streaming) res.end();
      else res.set('Cache-Control', 'no-store').json(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      logger.warn('openai_request_failed', { kind: timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : 'upstream' });
      if (!res.destroyed && !res.writableEnded) {
        if (res.headersSent) res.end('\nevent: error\ndata: {"error":"Upstream stream interrupted"}\n\n');
        else error(res, timedOut ? 504 : 502, timedOut ? 'timeout' : 'transport');
      }
    } finally {
      clearTimeout(timeout); controllers.delete(controller); res.removeListener('close', disconnect);
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      controller.abort(new Error('complete'));
    }
  });
  app.all(path, (_req, res) => error(res, config.openaiProxyEndpoint ? 405 : 503, config.openaiProxyEndpoint ? 'method' : 'disabled'));
}
