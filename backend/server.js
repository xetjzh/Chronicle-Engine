/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { readConfig } from './config.js';
import { createRuntime } from './app.js';

try {
  const config = readConfig();
  const runtime = createRuntime(config);
  runtime.server.once('error', () => {
    console.error('server_start_failed');
    process.exitCode = 1;
    void runtime.shutdown().then(() => process.exit(1));
  });
  runtime.server.listen(config.port, config.host, () => console.log(JSON.stringify({ event: 'server_listening', port: config.port, aiProxyEnabled: config.aiProxyEnabled, openaiProxyEnabled: !!config.openaiProxyEndpoint })));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    console.log(JSON.stringify({ event: 'server_draining', signal }));
    void runtime.shutdown().then(() => {
      console.log('server_stopped');
      // ADC discovery can retain handles that its API cannot cancel. Once the
      // owned sockets have drained (or reached their deadline), finish the
      // process even when a third-party handle remains open.
      process.exit(process.exitCode ?? 0);
    });
  });
} catch (error) {
  // Configuration errors contain variable names only, never supplied values.
  console.error(error.message);
  process.exitCode = 1;
}
