import assert from 'node:assert/strict';
import test from 'node:test';
import { getNarrativeTension } from './narrativeAnalytics.ts';

test('unscored chapters remain unknown instead of showing invented tension', () => {
  assert.equal(getNarrativeTension({}), null);
});

test('a zero extraction score is valid and takes priority over an older chapter score', () => {
  assert.equal(getNarrativeTension({ extraction: { tensionScore: 0 }, tensionScore: 90 }), 0);
  assert.equal(getNarrativeTension({ tensionScore: 0 }), 0);
});
