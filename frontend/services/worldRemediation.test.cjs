const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadService } = require('../testSupport/loadService.cjs');
const { createEmptyProject } = require('./projectFactory.ts');
const { createWritingChapter } = require('../components/writingWorkspace.ts');
const { SimulationEngine } = require('./simulationEngine.ts');
const file = name => path.join(__dirname, name + '.ts');
const loc = (id = 'home') => ({ id, name: id, type: 'city', description: '', climateOrDanger: '', connectedLocationIds: [] });
const char = (id = 'hero') => ({ id, name: id, title: '', age: 20, gender: '', occupation: '', factionId: '', currentLocationId: 'home', appearance: '', personality: '', coreDesire: '', greatestFear: '', currentMood: '平静', moralityAlignment: '绝对中立', health: 50, wealth: 0, inventory: [], currentGoal: '', isAlive: true, relationships: {}, knownFacts: [] });
const event = (id, step) => ({ id, simulationTime: '第1日', timeStepIndex: step, eventType: 'dialogue', locationId: 'home', participantIds: ['hero'], causeEventIds: [], title: '谈话', description: '', consequences: [], stateChanges: [], visibility: { isPublic: true, knownByCharacterIds: ['hero'] }, confirmed: true });
const world = () => ({ ...createEmptyProject('book'), locations: [loc()], characters: [char()] });

test('F15 death audits ignore life events and flag only events after a known death step', async () => {
  const { GeminiService } = loadService(file('geminiService'), { './aiProviderService': { AIProviderService: { async generateText() { return 'ALL_CONSISTENT'; } } } });
  const p = world(); p.characters[0].isAlive = false; p.characters[0].diedAtTimeStep = 5; p.events = [event('before', 1)];
  assert.ok(!(await GeminiService.auditConsistency(p)).some(i => i.title === '已故角色仍然产生事件'));
  p.events.push(event('after', 6)); assert.ok((await GeminiService.auditConsistency(p)).some(i => i.title === '已故角色仍然产生事件'));
  delete p.characters[0].diedAtTimeStep; assert.ok(!(await GeminiService.auditConsistency(p)).some(i => i.title === '已故角色仍然产生事件'));
});
test('F16 snapshots restore world references and exact branch events without deleting manuscript', () => {
  const { storageService: store } = loadService(file('storageService')); store.saveProject = () => {};
  let p = world(); p.events = [event('old', 0)]; p = store.createSnapshot(p, '起点', ''); const snapshot = p.snapshots[0];
  p = { ...p, locations: [loc('elsewhere')], timeStepIndex: 1, events: [event('future', 1)], chapters: [{ ...createWritingChapter(p, 'chapter', 'now'), content: '绝不能删除的稿件', associatedEventIds: ['future'] }] };
  const restored = store.restoreSnapshot(p, snapshot.id); assert.equal(restored.locations[0].id, 'home'); assert.equal(restored.events[0].id, 'old'); assert.equal(restored.chapters[0].content, '绝不能删除的稿件'); assert.equal(restored.chapters[0].associatedEventIds.length, 0);
  const { parseProjectBackup } = loadService(file('backupValidation')); assert.doesNotThrow(() => parseProjectBackup(JSON.stringify(restored)));
});
test('F17 every colocated character is scheduled and injured characters can rest in a group', () => {
  let p = world(); p.characters = ['a', 'b', 'c', 'd', 'e'].map(char);
  const participants = new Set(); for (let i = 0; i < 3; i++) { const step = SimulationEngine.stepTime(p, 4); p = step.updatedProject; step.newEvents.forEach(e => e.participantIds.forEach(id => participants.add(id))); }
  assert.equal(participants.size, 5); assert.ok(p.characters.every(c => c.health >= 70));
});
test('F19 rejects duplicate identities and illegal chapter values; legacy missing location links are repaired visibly', () => {
  const { parseProjectBackup } = loadService(file('backupValidation')); const p = world(); const c = createWritingChapter(p, 'same', 'now'); p.chapters = [c, { ...c }];
  assert.throws(() => parseProjectBackup(JSON.stringify(p)), /重复|唯一/);
  p.chapters = [{ ...c, status: 'INVALID' }]; assert.throws(() => parseProjectBackup(JSON.stringify(p)), /status|状态/);
  p.chapters = [{ ...c, chapterNumber: -2 }]; assert.throws(() => parseProjectBackup(JSON.stringify(p)), /chapterNumber|章号/);
  p.chapters = [c]; p.characters[0].currentLocationId = 'legacy_missing'; const restored = parseProjectBackup(JSON.stringify(p));
  assert.equal(restored.characters[0].currentLocationId, ''); assert.ok(restored.recoveryWarnings?.length); assert.equal(restored.chapters[0].id, 'same');
});
test('review: a group step keeps event identities unique even when the clock and RNG collide', () => {
  const fixedMath = Object.create(Math); fixedMath.random = () => 0;
  class FixedDate extends Date { static now() { return 100; } }
  const engine = loadService(file('simulationEngine'), {}, { Date: FixedDate, Math: fixedMath }).SimulationEngine;
  const p = world(); p.characters = Array.from({ length: 100 }, (_, i) => char(`actor_${i}`));
  const next = engine.stepTime(p, 4).updatedProject;
  assert.equal(new Set(next.events.map(e => e.id)).size, 100);
  const { parseProjectBackup } = loadService(file('backupValidation')); assert.doesNotThrow(() => parseProjectBackup(JSON.stringify(next)));
});
test('review: invalid snapshot rule and clue identities are rejected before they can poison a later restore', () => {
  const { storageService: store } = loadService(file('storageService')); store.saveProject = () => {};
  const { parseProjectBackup } = loadService(file('backupValidation'));
  for (const kind of ['rules', 'foreshadowing']) {
    const p = store.createSnapshot(world(), '快照', '');
    const value = kind === 'rules' ? { id: 'duplicate', category: 'natural', rule: '法则', consequenceOfViolation: '' } : { id: 'duplicate', title: '伏笔', plantedTime: '', relatedCharacterIds: [], expectedResolution: '', isResolved: false, notes: '' };
    p.snapshots[0].worldState[kind] = [value, { ...value }];
    assert.throws(() => parseProjectBackup(JSON.stringify(p)), /重复|唯一/);
  }
});
test('travel and numeric relationships survive serialization and a world snapshot restore', () => {
  const p = world(); p.locations[0].connectedLocationIds = ['away']; p.locations.push({ ...loc('away'), travelHours: 4 });
  p.characters.push(char('other')); p.characters[0].travelDestinationId = 'away'; p.characters[0].relationshipScores = { other: { affection: 20, trust: 65 } };
  const next = SimulationEngine.stepTime(p, 2).updatedProject;
  const { parseProjectBackup } = loadService(file('backupValidation'));
  const restored = parseProjectBackup(JSON.stringify(next)); assert.equal(restored.characters[0].travel.remainingHours, 2); assert.equal(restored.characters[0].relationshipScores.other.trust, 65);
  const { storageService: store } = loadService(file('storageService')); store.saveProject = () => {};
  const saved = store.createSnapshot(restored, '途中', ''); const changed = SimulationEngine.stepTime(saved, 4).updatedProject;
  const rolled = store.restoreSnapshot(changed, saved.snapshots[0].id); assert.equal(rolled.characters[0].travel.remainingHours, 2); assert.doesNotThrow(() => parseProjectBackup(JSON.stringify(rolled)));
});
