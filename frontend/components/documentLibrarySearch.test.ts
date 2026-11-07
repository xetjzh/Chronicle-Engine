import assert from 'node:assert/strict';
import test from 'node:test';
import { filterDocumentChapters } from './documentLibrarySearch.ts';

const chapters = [
  { id: 'first', title: '序章', content: '春天' },
  { id: 'second', title: '远行', content: '河流' },
  { id: 'third', title: '归来', content: '雪地里的足迹' },
];

test('choosing a search result opens its original chapter, not its position in the filtered list', () => {
  const [result] = filterDocumentChapters(chapters, '雪地');
  assert.equal(result.index, 2);
  assert.equal(chapters[result.index].id, 'third');
});

test('blank searches retain every original chapter index and unknown text yields no results', () => {
  assert.deepEqual(filterDocumentChapters(chapters, '  ').map(result => result.index), [0, 1, 2]);
  assert.deepEqual(filterDocumentChapters(chapters, '不存在'), []);
});
