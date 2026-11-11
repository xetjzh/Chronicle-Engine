import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { findSecrets } from './scan-secrets.mjs';
test('credential scanning reports rules and paths, never the matched credential', () => {
  const secret = 'sk-' + 'Ab3dE4fG5hI6'.repeat(4);
  assert.ok(findSecrets(secret, 'code.js').some(x => x.rule === 'api-token'));
  assert.ok(findSecrets('-----BEGIN ' + 'PRIVATE KEY-----', 'key.pem').length);
  assert.equal(findSecrets('apiKey: process.env.API_KEY', '.env.example').length, 0);
  assert.ok(findSecrets('ignored', 'backend/.env.local').some(x => x.rule === 'private-environment-file'));
  assert.ok(!JSON.stringify(findSecrets(secret, 'code.js')).includes(secret));
});
test('pre-commit scans staged content even if an unstaged edit hides the secret', t => {
  const directory = mkdtempSync(join(tmpdir(), 'chronicle-scan-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('chronicle-scan-'));
    rmSync(directory, { recursive: true, force: true });
  });
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  const secret = 'gh' + 'p_' + 'A12bC3'.repeat(7);
  writeFileSync(join(directory, 'code.js'), secret); execFileSync('git', ['add', 'code.js'], { cwd: directory }); writeFileSync(join(directory, 'code.js'), 'clean unstaged text');
  const result = spawnSync(process.execPath, [resolve('scripts/scan-secrets.mjs'), '--staged'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.ok((result.stdout + result.stderr).includes('code.js')); assert.ok(!(result.stdout + result.stderr).includes(secret));
});
