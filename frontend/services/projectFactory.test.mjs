import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyProject } from './projectFactory.ts';
import { parseProjectBackup } from './backupValidation.ts';

test('a new book is a complete blank backup with independent collections and no sample story', () => {
  const first = createEmptyProject('book-one', { title: '星际来信', genre: '科幻', premise: '一个关于通信的故事' });
  const second = createEmptyProject('book-two', { title: '另一部作品' });
  assert.equal(first.title, '星际来信');
  assert.equal(first.authorNote, '一个关于通信的故事');
  for (const key of ['chapters', 'characters', 'locations', 'factions', 'events', 'rules', 'lorebook', 'referenceDocs', 'snapshots', 'foreshadowing']) {
    assert.deepEqual(first[key], []);
    assert.notStrictEqual(first[key], second[key]);
  }
  assert.equal(first.timeStepIndex, 0);
  assert.equal(first.aiConfig.authorsNote.content, '');
  assert.equal(first.aiConfig.activePreset, 'custom');
  assert.equal(parseProjectBackup(JSON.stringify(first)).id, 'book-one');
});

test('connection-only inheritance copies credentials without old prose, author notes or mutable aliases', () => {
  const old = createEmptyProject('old');
  old.aiConfig.openaiCompatible.apiKey = 'test-key';
  old.aiConfig.openaiCompatible.customHeaders = { 'X-Route': 'book-route' };
  old.aiConfig.authorsNote = { enabled: true, content: '旧小说特有设定', insertionDepth: 1 };
  const next = createEmptyProject('new', { title: '新书' }, old.aiConfig);
  assert.equal(next.aiConfig.openaiCompatible.apiKey, 'test-key');
  assert.equal(next.aiConfig.authorsNote.content, '');
  next.aiConfig.openaiCompatible.customHeaders['X-Route'] = 'changed';
  assert.equal(old.aiConfig.openaiCompatible.customHeaders['X-Route'], 'book-route');
  assert.equal(createEmptyProject('unconnected').aiConfig.openaiCompatible.apiKey, '');
});
