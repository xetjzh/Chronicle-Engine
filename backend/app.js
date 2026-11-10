/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';
import { WebSocketServer, WebSocket } from 'ws';
import { readConfig } from './config.js';
import { API_CLIENT_MAP, ALLOWED_UPSTREAM_HOSTS, WEB_SOCKET_BODY_POLICY, validateProxiedRequestBody, asProxiedBodyText, extractParams, sanitizeForwardedHeaders, STUDIO_CLIENT_TAG } from './proxy-policy.js';

const LIVE_TARGET = 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
const defaultFrontendRoot = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const jsonError = (res, status, error) => res.status(status).json({ error });

function cloudTokenProvider() {
  let auth;
  return async () => {
    auth ??= new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const token = await (await auth.getClient()).getAccessToken();
    if (!token.token) throw new Error('Token unavailable');
    return token.token;
  };
}

// Credential discovery does not necessarily implement cancellation itself.
function abortable(operation, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolvePromise, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    let pending;
    try { pending = operation(); } catch (error) { pending = Promise.reject(error); }
    Promise.resolve(pending).then(resolvePromise, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function closeCode(code) {
  return (code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999) ? code : 1011;
}

export function createRuntime(config = readConfig(), dependencies = {}) {
  const logger = dependencies.logger ?? { info: console.log, warn: console.warn, error: console.error };
  const upstreamFetch = dependencies.fetch ?? globalThis.fetch;
  const getAccessToken = dependencies.getAccessToken ?? cloudTokenProvider();
  const UpstreamWebSocket = dependencies.WebSocket ?? WebSocket;
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.payloadMaxBytes });
  const controllers = new Set();
  const sockets = new Set();
  const liveConnections = new Set();
  const upgradeAttempts = new Map();
  const allowedOrigins = new Set(config.allowedOrigins);
  let draining = false;
  let shutdownPromise;

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/healthz', (_req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => res.set('Cache-Control', 'no-store').status(draining ? 503 : 200).json(draining ? { status: 'draining' } : { status: 'ready', aiProxyEnabled: config.aiProxyEnabled }));

  function proxyGate(req, res, next) {
    if (draining) return jsonError(res, 503, 'Server is draining');
    if (!config.aiProxyEnabled) return jsonError(res, 503, 'AI proxy is disabled');
    if (!allowedOrigins.has(req.headers.origin)) return jsonError(res, 403, 'Origin not allowed');
    // Public identification only. A network deployment requires an identity
    // gateway covering both HTTP and WebSocket requests.
    if (req.headers['x-app-proxy'] !== config.proxyMarker) return jsonError(res, 403, 'Proxy marker required');
    next();
  }

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false,
    validate: { xForwardedForHeader: false }, message: { error: 'Too many requests' } });
  app.post('/api-proxy', proxyGate, limiter, express.json({ limit: config.payloadMaxBytes }), async (req, res) => {
    const envelope = req.body;
    if (!isObject(envelope) || typeof envelope.originalUrl !== 'string' || envelope.originalUrl.length > 2048 ||
        (envelope.method !== undefined && envelope.method !== 'POST') ||
        (envelope.headers !== undefined && (!isObject(envelope.headers) || Object.values(envelope.headers).some(value => typeof value !== 'string' || value.length > 8192)))) return jsonError(res, 400, 'Invalid proxy request');
    let parameters;
    const apiClient = API_CLIENT_MAP.find(client => {
      const extracted = extractParams(client.patternInfo, envelope.originalUrl);
      if (extracted) parameters = extracted;
      return extracted !== null;
    });
    if (!apiClient) return jsonError(res, 404, 'No proxy handler for this endpoint');
    const body = asProxiedBodyText(envelope.body);
    if (!validateProxiedRequestBody(body, apiClient.bodyPolicy).allowed) return jsonError(res, 400, 'Request body not allowed');
    const upstreamUrl = new URL(apiClient.getApiEndpoint({ projectId: config.project, region: config.location }, parameters));
    if (upstreamUrl.protocol !== 'https:' || !ALLOWED_UPSTREAM_HOSTS.has(upstreamUrl.hostname.toLowerCase())) return jsonError(res, 400, 'Upstream host not allowed');
    // Native SSE remains valid across arbitrary transport chunk boundaries.
    if (apiClient.isStreaming) upstreamUrl.searchParams.set('alt', 'sse');
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(new Error('timeout')); }, config.apiTimeoutMs);
    const disconnect = () => { if (!res.writableEnded) controller.abort(new Error('disconnect')); };
    res.once('close', disconnect);
    let reader;
    try {
      const token = await abortable(() => getAccessToken(), controller.signal);
      const upstream = await abortable(() => upstreamFetch(upstreamUrl.href, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { ...sanitizeForwardedHeaders(envelope.headers), ...requestHeaders(token) }, body: body || undefined,
      }), controller.signal);
      if (!upstream.ok) {
        await upstream.body?.cancel().catch(() => {});
        logger.warn('proxy_upstream_rejected', { status: upstream.status });
        return jsonError(res, upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502, 'Upstream request failed');
      }
      if (apiClient.isStreaming) {
        if (!upstream.body || !upstream.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) throw new Error('Invalid SSE response');
        res.status(upstream.status).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        reader = upstream.body.getReader();
        while (true) {
          const { value, done } = await abortable(() => reader.read(), controller.signal);
          if (done) break;
          if (!res.write(value)) await abortable(() => new Promise(resolvePromise => res.once('drain', resolvePromise)), controller.signal);
        }
        res.end();
      } else {
        const data = await abortable(() => upstream.json(), controller.signal);
        res.status(upstream.status).json(data);
      }
    } catch {
      logger.warn('proxy_request_failed', { kind: timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : 'upstream' });
      if (!res.destroyed && !res.writableEnded) {
        if (res.headersSent) res.end('event: error\ndata: {"error":"Upstream stream interrupted"}\n\n');
        else jsonError(res, timedOut ? 504 : 502, timedOut ? 'Upstream request timed out' : 'AI service unavailable');
      }
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
      res.removeListener('close', disconnect);
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      controller.abort(new Error('complete'));
    }
  });
  app.all('/api-proxy', (_req, res) => jsonError(res, config.aiProxyEnabled ? 405 : 503, config.aiProxyEnabled ? 'Method not allowed' : 'AI proxy is disabled'));

  if (config.serveFrontend) {
    const frontendRoot = resolve(dependencies.frontendRoot ?? defaultFrontendRoot);
    const indexFile = resolve(frontendRoot, 'index.html');
    try { if (!statSync(indexFile).isFile()) throw new Error(); } catch { throw new Error('Frontend build is missing; run npm run build before enabling SERVE_FRONTEND.'); }
    app.use(express.static(frontendRoot, { index: false, dotfiles: 'deny', redirect: false,
      setHeaders(res, path) {
        const relative = path.slice(frontendRoot.length).replaceAll('\\', '/');
        res.setHeader('Cache-Control', relative.startsWith('/assets/') && /[-.][A-Za-z0-9_-]{8,}\.[^.]+$/.test(relative) ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }));
    app.use((req, res, next) => {
      const path = req.path;
      if (req.method !== 'GET' || !req.accepts('html') || extname(path) || /^(?:\/api(?:[/-]|$)|\/ws-proxy(?:\/|$)|\/assets(?:\/|$)|\/healthz(?:\/|$)|\/readyz(?:\/|$))/.test(path) || path.split('/').some(part => part.startsWith('.'))) return next();
      res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: frontendRoot, dotfiles: 'deny' });
    });
  }
  app.use((_req, res) => jsonError(res, 404, 'Not found'));
  app.use((error, _req, res, _next) => {
    logger.warn('http_request_rejected', { kind: error.type === 'entity.too.large' ? 'payload' : 'invalid' });
    if (!res.headersSent) jsonError(res, error.type === 'entity.too.large' ? 413 : 400, error.type === 'entity.too.large' ? 'Request too large' : 'Invalid request');
    else res.end();
  });

  function requestHeaders(token) {
    return { authorization: `Bearer ${token}`, 'x-goog-user-project': config.project, 'content-type': 'application/json' };
  }
  function resolveClientIp(request, socket) {
    if (config.trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) {
        const client = forwarded.split(',')[0].trim();
        if (client) return client;
      }
    }
    return socket.remoteAddress || 'unknown';
  }
  function rejectUpgrade(socket, status) {
    if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} ${status === 503 ? 'Service Unavailable' : status === 403 ? 'Forbidden' : status === 429 ? 'Too Many Requests' : status === 404 ? 'Not Found' : 'Bad Request'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
  function upgradeAllowed(peer) {
    const now = Date.now();
    for (const [key, value] of upgradeAttempts) if (value.expires <= now) upgradeAttempts.delete(key);
    if (!upgradeAttempts.has(peer) && upgradeAttempts.size >= 10000) return false;
    const entry = upgradeAttempts.get(peer) ?? { count: 0, expires: now + 15 * 60 * 1000 };
    upgradeAttempts.set(peer, entry);
    return ++entry.count <= 100 && liveConnections.size < 50;
  }
  server.on('upgrade', (request, socket, head) => {
    void handleUpgrade(request, socket, head).catch(() => { logger.warn('websocket_upgrade_failed'); rejectUpgrade(socket, 400); });
  });
  async function handleUpgrade(request, socket, head) {
    // A fixed base avoids interpreting untrusted Host as URL grammar.
    const url = new URL(request.url, 'http://proxy.invalid');
    if (url.pathname !== '/ws-proxy') return rejectUpgrade(socket, 404);
    if (draining || !config.aiProxyEnabled) return rejectUpgrade(socket, 503);
    if (!allowedOrigins.has(request.headers.origin)) return rejectUpgrade(socket, 403);
    // Mirror the same public proxy-marker check as the HTTP /api-proxy gate so
    // that both transports require identical client identification.
    if (request.headers['x-app-proxy'] !== config.proxyMarker) return rejectUpgrade(socket, 403);
    if (url.searchParams.get('target') !== LIVE_TARGET) return rejectUpgrade(socket, 400);
    const clientIp = resolveClientIp(request, socket);
    if (!upgradeAllowed(clientIp)) return rejectUpgrade(socket, 429);
    const controller = new AbortController();
    controllers.add(controller);
    const connection = { client: null, upstream: null, socket };
    liveConnections.add(connection);
    let timer = setTimeout(() => controller.abort(new Error('timeout')), config.apiTimeoutMs);
    const onSocketClose = () => { controller.abort(new Error('disconnect')); cleanup(); };
    socket.once('close', onSocketClose);
    function cleanup() {
      clearTimeout(timer);
      timer = undefined;
      controllers.delete(controller);
      liveConnections.delete(connection);
      socket.removeListener('close', onSocketClose);
      if (connection.upstream?.readyState !== 3) connection.upstream?.terminate();
    }
    try {
      const token = await abortable(() => getAccessToken(), controller.signal);
      const location = config.location === 'global' ? 'us-central1' : config.location;
      const target = `wss://${location}-aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
      const upstream = new UpstreamWebSocket(target, { headers: { ...requestHeaders(token), 'x-goog-api-client': STUDIO_CLIENT_TAG }, handshakeTimeout: config.apiTimeoutMs, maxPayload: config.payloadMaxBytes });
      connection.upstream = upstream;
      upstream.on('error', () => { logger.warn('websocket_upstream_failed'); connection.client?.close(1011, 'Upstream unavailable'); });
      await abortable(() => new Promise((resolvePromise, reject) => { upstream.once('open', resolvePromise); upstream.once('error', reject); upstream.once('close', () => reject(new Error('Upstream closed'))); }), controller.signal);
      if (socket.destroyed || draining) throw new Error('Disconnected');
      clearTimeout(timer);
      wss.handleUpgrade(request, socket, head, client => {
        connection.client = client;
        timer = setTimeout(() => client.close(1001, 'Session time limit'), config.apiTimeoutMs);
        upstream.on('message', (data, binary) => {
          if (client.readyState === WebSocket.OPEN) {
            if (client.bufferedAmount > config.payloadMaxBytes) return client.close(1008, 'Client too slow');
            client.send(data, { binary });
          }
        });
        client.on('message', data => {
          try {
            const text = data.toString();
            if (!validateProxiedRequestBody(text, WEB_SOCKET_BODY_POLICY).allowed) return client.close(1008, 'Message not allowed');
            const message = JSON.parse(text);
            if (message.setup !== undefined) {
              if (!isObject(message.setup) || typeof message.setup.model !== 'string' || !/^publishers\/google\/models\/[A-Za-z0-9_.-]+$/.test(message.setup.model)) return client.close(1008, 'Invalid setup');
              message.setup.model = `projects/${config.project}/locations/${location}/${message.setup.model}`;
            }
            if (upstream.readyState === WebSocket.OPEN) {
              if (upstream.bufferedAmount > config.payloadMaxBytes) return client.close(1008, 'Upstream too slow');
              upstream.send(JSON.stringify(message), { binary: false });
            }
          } catch { client.close(1008, 'Invalid message'); }
        });
        upstream.on('close', code => { if (client.readyState === WebSocket.OPEN) client.close(closeCode(code), 'Upstream closed'); });
        client.on('error', () => { logger.warn('websocket_client_failed'); cleanup(); });
        client.once('close', cleanup);
      });
    } catch {
      cleanup();
      rejectUpgrade(socket, 503);
    }
  }
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('clientError', (_error, socket) => rejectUpgrade(socket, 400));
  function beginDrain() { draining = true; }
  function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    beginDrain();
    for (const controller of controllers) controller.abort(new Error('shutdown'));
    for (const connection of liveConnections) {
      if (connection.client) connection.client.close(1001, 'Server shutting down');
      else connection.socket.destroy();
    }
    shutdownPromise = new Promise(resolvePromise => {
      const timer = setTimeout(() => {
        for (const connection of liveConnections) { connection.client?.terminate(); connection.upstream?.terminate(); }
        for (const socket of sockets) socket.destroy();
        resolvePromise();
      }, config.shutdownTimeoutMs);
      server.close(() => { clearTimeout(timer); wss.close(); resolvePromise(); });
      server.closeIdleConnections();
    });
    return shutdownPromise;
  }
  return { app, server, beginDrain, shutdown };
}
