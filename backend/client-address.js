import { isIP } from 'node:net';

function canonical(value) {
  const mapped = value.replace(/^::ffff:/i, '');
  if (isIP(mapped) === 4) return mapped;
  return isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname.slice(1, -1) : value;
}
export function resolveTrustedClientIp(request, trust) {
  const peer = request.socket.remoteAddress || 'unknown';
  const forwarded = request.headers['x-forwarded-for'];
  if (!isIP(peer) || typeof trust !== 'function' || !trust(peer, 0)
    || typeof forwarded !== 'string' || forwarded.length > 4096) return canonical(peer);
  const hops = forwarded.split(',').map(value => value.trim()).reverse();
  if (hops.length > 32 || hops.some(value => !isIP(value))) return canonical(peer);
  const chain = [peer, ...hops];
  let i = 0; while (i < chain.length - 1 && trust(chain[i], i)) i++;
  return canonical(chain[i]);
}
