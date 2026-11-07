import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./', import.meta.url));
const baseEnv = () => ({ ...process.env, AI_PROXY_ENABLED: 'false', SERVE_FRONTEND: 'false', TRUST_PROXY: 'false', API_ALLOWED_ORIGINS: '', API_BACKEND_HOST: '127.0.0.1' });

test('bootstrap rejects bad configuration with a nonzero exit and no supplied value in output', async () => {
  const child = spawn(process.execPath, ['server.js'], { cwd: directory, env: { ...baseEnv(), API_BACKEND_PORT: 'private-value-not-a-port' }, windowsHide: true });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /API_BACKEND_PORT/);
  assert.doesNotMatch(output, /private-value-not-a-port/);
});

test('real process starts without cloud credentials and exits after its SIGTERM handler even with an uncancellable handle', { timeout: 5000 }, async t => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  // Windows has no native POSIX SIGTERM delivery. IPC invokes the identical
  // registered signal handler; the persistent timer models an uncancellable ADC
  // discovery handle that must not defeat the process shutdown deadline.
  const script = "process.on('message', message => { if (message === 'SIGTERM') process.emit('SIGTERM'); }); setInterval(() => {}, 60000); import('./server.js');";
  const child = spawn(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: directory, env: { ...baseEnv(), API_BACKEND_PORT: String(port), SHUTDOWN_TIMEOUT_MS: '100' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  for (let attempt = 0; !output.includes('server_listening') && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(output, /server_listening/);
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/readyz`)).json(), { status: 'ready', aiProxyEnabled: false });
  const exit = once(child, 'exit');
  child.send('SIGTERM');
  const [code] = await Promise.race([exit, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('SIGTERM handler did not exit within 1 second')), 1000); timer.unref(); })]);
  assert.equal(code, 0);
  assert.match(output, /server_draining/);
  assert.match(output, /server_stopped/);
});
