import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from './simulationEngine.ts';
import { createEmptyProject } from './projectFactory.ts';

const character = (id, extra = {}) => ({ id, name: id, isAlive: true, currentLocationId: 'station', currentMood: '平静', currentGoal: '探索', health: 100, wealth: 10, relationships: {}, knownFacts: [], ...extra });
function world(characters) {
  return { ...createEmptyProject('world'), characters, locations: [{ id: 'station', name: '轨道站', type: 'city', connectedLocationIds: [] }] };
}
test('support events apply the recorded transfer and preserve the original world', () => {
  const original = world([character('a', { relationships: { b: '照顾' }, wealth: 1 }), character('b', { wealth: 2 })]);
  const { updatedProject, newEvents } = SimulationEngine.stepTime(original, 4);
  assert.equal(updatedProject.characters[0].wealth, 0);
  assert.equal(updatedProject.characters[1].wealth, 3);
  assert.equal(original.characters[0].wealth, 1);
  assert.equal(newEvents[0].stateChanges[0].oldValue, 1);
  assert.equal(newEvents[0].stateChanges[1].newValue, 3);
});
test('mood transitions retain their previous values and clock rolls into a new day', () => {
  const original = world([character('a', { relationships: { b: '怀疑' }, currentMood: '好奇' }), character('b', { currentMood: '镇定' })]);
  original.currentSimulationTime = '第1日 亥时';
  const { updatedProject, newEvents } = SimulationEngine.stepTime(original, 4);
  assert.equal(newEvents[0].stateChanges[0].oldValue, '好奇');
  assert.equal(newEvents[0].stateChanges[1].oldValue, '镇定');
  assert.equal(updatedProject.currentSimulationTime, '第2日 丑时');
  assert.throws(() => SimulationEngine.stepTime(original, 0), /时间|小时/);
});
