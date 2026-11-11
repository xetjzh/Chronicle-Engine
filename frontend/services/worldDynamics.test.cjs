const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadService } = require('../testSupport/loadService.cjs');
const { relationshipState, shortestPath } = require('./worldDynamics.ts');
const { createEmptyProject } = require('./projectFactory.ts');
const char = (id, extra = {}) => ({ id, name: id, isAlive: true, currentLocationId: 'A', health: 100, wealth: 10, relationships: {}, knownFacts: [], ...extra });
const locations = ['A', 'B', 'C'].map((id, i) => ({ id, name: id, type: 'city', travelHours: 4, connectedLocationIds: i < 2 ? [String.fromCharCode(66 + i)] : [] }));
test('old relationship labels map compatibly and graph routes choose connected shortest paths', () => {
  assert.ok(relationshipState(char('a', { relationships: { b: '旧识' } }), 'b').trust >= 65);
  assert.deepEqual(shortestPath(locations, 'A', 'C'), ['B', 'C']); assert.deepEqual(shortestPath(locations, 'C', 'A'), []);
});
test('planned travel advances over time steps and travellers do not socialize at their old location', () => {
  const { SimulationEngine } = loadService(path.join(__dirname, 'simulationEngine.ts'));
  let p = { ...createEmptyProject('p'), locations, characters: [char('a', { travelDestinationId: 'C' }), char('b')] };
  p = SimulationEngine.stepTime(p, 2).updatedProject; assert.equal(p.characters[0].currentLocationId, 'A'); assert.ok(p.characters[0].travel); assert.ok(!p.events.some(e => e.participantIds.length > 1));
  p = SimulationEngine.stepTime(p, 2).updatedProject; assert.equal(p.characters[0].currentLocationId, 'B');
  p = SimulationEngine.stepTime(p, 4).updatedProject; assert.equal(p.characters[0].currentLocationId, 'C'); assert.equal(p.characters[0].travel, undefined);
});
test('repeated support changes bounded trust and affection and preserves the source world', () => {
  const { SimulationEngine } = loadService(path.join(__dirname, 'simulationEngine.ts'));
  const original = { ...createEmptyProject('p'), locations, characters: [char('a', { relationships: { b: '照顾' } }), char('b')] };
  const next = SimulationEngine.stepTime(original, 4).updatedProject;
  assert.ok(next.characters[1].relationshipScores.a.trust > 50); assert.ok(next.characters[1].relationshipScores.a.affection > 0);
  assert.equal(original.characters[1].relationshipScores, undefined);
});
