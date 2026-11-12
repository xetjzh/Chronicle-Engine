import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProjectBackup } from './backupValidation.ts';

const backup = () => ({
  id: 'my-book', title: '一本书', genre: '小说', authorNote: '', worldName: '我的世界',
  currentSimulationTime: '第一天', timeStepIndex: 0,
  chapters: [], characters: [], locations: [], factions: [], rules: [], events: [],
  lorebook: [], snapshots: [], foreshadowing: [], referenceDocs: [],
  settings: { povPreference: '第三人称有限视角', literaryStyle: '严肃文学', chapterLengthTarget: 4000 },
  aiConfig: {
    activeProvider: 'gemini', activePreset: 'gemini_epic',
    gemini: { model: 'gemini-2.5-flash' },
    ollama: { baseUrl: '', model: '', contextLength: 4096, keepAlive: '5m' },
    openaiCompatible: { baseUrl: '', apiKey: '', model: '' },
    sampling: { temperature: 0.8, topP: 1, topK: 40, repetitionPenalty: 1, frequencyPenalty: 0, presencePenalty: 0, maxTokens: 8000, stopSequences: [] },
    authorsNote: { enabled: false, content: '', insertionDepth: 2 },
  },
});

test('accepts an empty but complete project backup', () => {
  assert.deepEqual(parseProjectBackup(JSON.stringify(backup())), backup());
});

test('optional relay selection round-trips and rejects a non-boolean value', () => {
  const project = backup(); project.aiConfig.openaiCompatible.useServerProxy = true;
  assert.equal(parseProjectBackup(JSON.stringify(project)).aiConfig.openaiCompatible.useServerProxy, true);
  project.aiConfig.openaiCompatible.useServerProxy = 'yes';
  assert.throws(() => parseProjectBackup(JSON.stringify(project)), /useServerProxy/);
});

test('compatible generation timeout and reasoning settings validate optional ranges and enums', () => {
  const project=backup();Object.assign(project.aiConfig.openaiCompatible,{requestTimeoutSeconds:300,reasoningEffort:'low'});
  const parsed=parseProjectBackup(JSON.stringify(project));assert.equal(parsed.aiConfig.openaiCompatible.requestTimeoutSeconds,300);assert.equal(parsed.aiConfig.openaiCompatible.reasoningEffort,'low');
  for (const extra of [{requestTimeoutSeconds:29},{requestTimeoutSeconds:601},{requestTimeoutSeconds:30.5},{reasoningEffort:'medium'}]) {
    const invalid=structuredClone(project);Object.assign(invalid.aiConfig.openaiCompatible,extra);assert.throws(()=>parseProjectBackup(JSON.stringify(invalid)),/requestTimeoutSeconds|reasoningEffort/);
  }
});
test('rejects identity-only JSON before it can crash a workspace', () => {
  assert.throws(() => parseProjectBackup('{"id":"x","worldName":"x"}'), /备份/);
});
test('rejects malformed collections and nested chapter content', () => {
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), chapters: {} })), /chapters/);
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), chapters: [{ id: 'c', title: 'c', content: null }] })), /chapters/);
});
test('rejects nested reference and AI data that would break a screen', () => {
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), referenceDocs: [{ id: 'd', parsedChapters: null }] })), /referenceDocs/);
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), aiConfig: {} })), /aiConfig/);
});
test('gives a readable error for invalid JSON', () => {
  assert.throws(() => parseProjectBackup('not json'), /JSON/);
});
test('rejects malformed optional writing preferences before the default editor renders', () => {
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), deskSettings: { currentSessionWords: null } })), /deskSettings/);
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), deskSettings: { fontSize: 'large' } })), /fontSize/);
  assert.doesNotThrow(() => parseProjectBackup(JSON.stringify({ ...backup(), deskSettings: { fontSize: 18 } })));
});
test('rejects malformed optional chapter analysis and reference excerpts', () => {
  const chapter = { id: 'c', title: '', content: '', outline: '', wordCount: 0, chapterNumber: 1, volumeNumber: 1, associatedEventIds: [], createdAt: '', updatedAt: '', status: 'draft' };
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), chapters: [{ ...chapter, actBeats: {} }] })), /actBeats/);
  const doc = { id: 'd', title: '', fileName: '', format: 'txt', sizeBytes: 0, importedAt: '', parsedChapters: [] };
  assert.throws(() => parseProjectBackup(JSON.stringify({ ...backup(), referenceDocs: [{ ...doc, excerpts: [null] }] })), /excerpts/);
});
