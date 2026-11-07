import assert from 'node:assert/strict';
import test from 'node:test';
import { createDialogStack, getTabDestination } from './dialogBehavior.ts';

test('only the last open dialog handles keyboard input, including after a lower dialog closes', () => {
  const stack = createDialogStack<symbol>();
  const lower = Symbol('lower');
  const upper = Symbol('upper');
  stack.add(lower);
  stack.add(upper);
  assert.equal(stack.isTop(lower), false);
  assert.equal(stack.isTop(upper), true);
  stack.remove(lower);
  assert.equal(stack.isTop(upper), true);
  stack.remove(upper);
  assert.equal(stack.size, 0);
});

test('closing a nested dialog returns keyboard control to its parent', () => {
  const stack = createDialogStack<symbol>();
  const parent = Symbol('parent');
  const child = Symbol('child');
  stack.add(parent);
  stack.add(child);
  stack.remove(child);
  assert.equal(stack.isTop(parent), true);
});

test('Tab wraps both ends and brings escaped focus back into the dialog', () => {
  assert.equal(getTabDestination(3, 2, false), 0);
  assert.equal(getTabDestination(3, 0, true), 2);
  assert.equal(getTabDestination(3, -1, false), 0);
  assert.equal(getTabDestination(3, -1, true), 2);
  assert.equal(getTabDestination(3, 1, false), null);
  assert.equal(getTabDestination(0, -1, false), -1);
});
