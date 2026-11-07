/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route supported Vertex requests through the deployment's ADC-backed proxy.
 */
(function() {
  const originalFetch = window.fetch;
  const originalWebSocket = window.WebSocket;
  const liveTarget = 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
  const publicMarker = 'tqHmXyUOiCqsU1IqUeo2MNyqjReMuVZ8';
  const forwardableHeaders = new Set(['accept', 'accept-language', 'content-type', 'x-goog-api-client']);

  function isValidUrl(value) {
    if (value === liveTarget) return true;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
      const safeSegment = part => part && part !== '.' && part !== '..' && encodeURIComponent(part).replace(/%3A/g, ':').replace(/%40/g, '@') === part;
      const segments = url.pathname.split('/');
      if (url.hostname === 'aiplatform.googleapis.com' && segments.length === 6 &&
          segments[2] === 'publishers' && segments[3] === 'google' && segments[4] === 'models') {
        const modelAndMethod = segments[5].split(':');
        return safeSegment(segments[1]) && modelAndMethod.length === 2 && safeSegment(modelAndMethod[0]) &&
          ['generateContent', 'predict', 'streamGenerateContent'].includes(modelAndMethod[1]);
      }
      return false;
    } catch { return false; }
  }

  // Own the upload reader so cancellation covers request serialization too.
  async function readBody(request) {
    request.signal.throwIfAborted();
    if (!request.body) return undefined;
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    const pieces = [];
    const cancel = () => { void reader.cancel(request.signal.reason).catch(() => {}); };
    request.signal.addEventListener('abort', cancel, { once: true });
    try {
      while (true) {
        request.signal.throwIfAborted();
        const { value, done } = await reader.read();
        request.signal.throwIfAborted();
        if (done) break;
        pieces.push(decoder.decode(value, { stream: true }));
      }
      pieces.push(decoder.decode());
      return pieces.join('');
    } finally {
      request.signal.removeEventListener('abort', cancel);
      reader.releaseLock();
    }
  }

  window.WebSocket = function(url, protocols) {
    const inputUrl = url instanceof URL ? url.href : url;
    if (inputUrl === liveTarget) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return new originalWebSocket(`${protocol}//${window.location.host}/ws-proxy?target=${encodeURIComponent(inputUrl)}`, protocols);
    }
    return new originalWebSocket(url, protocols);
  };
  window.WebSocket.prototype = originalWebSocket.prototype;
  for (const name of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) window.WebSocket[name] = originalWebSocket[name];

  window.fetch = async function(input, options) {
    const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : null;
    if (!value || !isValidUrl(value) || value === liveTarget) return originalFetch.apply(this, arguments);
    // Native Request applies init overrides and retains body/headers/signal.
    const request = new Request(input, options);
    const body = await readBody(request);
    request.signal.throwIfAborted();
    const url = new URL(request.url);
    const headers = {};
    request.headers.forEach((value, name) => {
      if (forwardableHeaders.has(name)) headers[name] = value;
    });
    return originalFetch.call(window, '/api-proxy', {
      method: 'POST', credentials: 'same-origin', signal: request.signal,
      headers: { 'Content-Type': 'application/json', 'X-App-Proxy': publicMarker },
      body: JSON.stringify({ originalUrl: url.origin + url.pathname, method: request.method, headers, body }),
    });
  };
})();
