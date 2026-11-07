import { isIP } from 'node:net';

// This marker is public identification, never an authentication credential.
export const DEFAULT_PROXY_MARKER = 'tqHmXyUOiCqsU1IqUeo2MNyqjReMuVZ8';

function invalid(name) { throw new Error(`Invalid or missing ${name}.`); }
function flag(env, name, fallback = false) {
  const value = env[name];
  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false') invalid(name);
  return value === 'true';
}
function integer(env, name, fallback, minimum, maximum) {
  const value = env[name];
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) invalid(name);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) invalid(name);
  return parsed;
}
function origins(value) {
  if (!value) return [];
  return [...new Set(value.split(',').map(raw => {
    const candidate = raw.trim();
    let url;
    try { url = new URL(candidate); } catch { invalid('API_ALLOWED_ORIGINS'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.origin !== candidate) invalid('API_ALLOWED_ORIGINS');
    return url.origin;
  }))];
}
function trustedPeers(value = 'false') {
  if (value === 'false') return false;
  const entries = value.split(',').map(item => item.trim());
  for (const entry of entries) {
    const [address, mask, extra] = entry.split('/');
    const family = isIP(address);
    if (!family || extra !== undefined || (mask !== undefined && (!/^\d+$/.test(mask) || Number(mask) > (family === 4 ? 32 : 128)))) invalid('TRUST_PROXY');
  }
  return entries;
}

export function readConfig(env = process.env) {
  const aiProxyEnabled = flag(env, 'AI_PROXY_ENABLED');
  const host = env.API_BACKEND_HOST ?? '127.0.0.1';
  if (!isIP(host) && !/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host)) invalid('API_BACKEND_HOST');
  const size = env.API_PAYLOAD_MAX_SIZE ?? '7mb';
  const match = /^(\d+)(b|kb|mb)$/i.exec(size);
  const payloadMaxBytes = match && Number(match[1]) * ({ b: 1, kb: 1024, mb: 1024 * 1024 }[match[2].toLowerCase()]);
  if (!Number.isSafeInteger(payloadMaxBytes) || payloadMaxBytes < 1 || payloadMaxBytes > 50 * 1024 * 1024) invalid('API_PAYLOAD_MAX_SIZE');
  const allowedOrigins = origins(env.API_ALLOWED_ORIGINS);
  const project = env.GOOGLE_CLOUD_PROJECT;
  const location = env.GOOGLE_CLOUD_LOCATION;
  const proxyMarker = env.PROXY_HEADER ?? DEFAULT_PROXY_MARKER;
  if (aiProxyEnabled) {
    if (!project || !/^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|[0-9]{6,30})$/.test(project)) invalid('GOOGLE_CLOUD_PROJECT');
    if (!location || !/^(?:global|[a-z]+(?:-[a-z0-9]+)+)$/.test(location)) invalid('GOOGLE_CLOUD_LOCATION');
    if (!allowedOrigins.length) invalid('API_ALLOWED_ORIGINS');
    if (typeof proxyMarker !== 'string' || !/^[\x21-\x7e]{1,256}$/.test(proxyMarker)) invalid('PROXY_HEADER');
  }
  return Object.freeze({
    aiProxyEnabled,
    serveFrontend: flag(env, 'SERVE_FRONTEND'),
    host,
    port: integer(env, 'API_BACKEND_PORT', 5000, 1, 65535),
    payloadMaxBytes,
    allowedOrigins: Object.freeze(allowedOrigins),
    project,
    location,
    proxyMarker,
    trustProxy: trustedPeers(env.TRUST_PROXY),
    apiTimeoutMs: integer(env, 'API_TIMEOUT_MS', 120000, 100, 600000),
    shutdownTimeoutMs: integer(env, 'SHUTDOWN_TIMEOUT_MS', 10000, 100, 60000),
  });
}
