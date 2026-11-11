import test from 'node:test';
import assert from 'node:assert/strict';
import { listWindow } from './listWindow.ts';
test('windowing bounds rendered rows for a 10000 chapter book while retaining scroll reach', () => {
  const first = listWindow(10000, 0, 320, 80); assert.ok(first.end - first.start < 20); assert.equal(first.start, 0);
  const last = listWindow(10000, 800000, 320, 80); assert.equal(last.end, 10000); assert.ok(last.end - last.start < 20);
  assert.equal(last.top + (last.end - last.start) * 80 + last.bottom, 800000);
  assert.equal(listWindow(0, 0, 320, 80).end, 0);
});
