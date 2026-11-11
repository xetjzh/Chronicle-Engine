const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReferenceIndex, searchReferences, referenceContext } = require('./referenceRetrieval.ts');
const docs = [{ id: 'moon', title: '月面资料', parsedChapters: [{ id: 'one', title: '基地', content: '月球基地采用低重力密封空气循环。'.repeat(30) }] }, { id: 'sea', title: '航海资料', parsedChapters: [{ id: 'two', title: '航行', content: '轮船在海上运输木材和淡水。'.repeat(30) }] }];
test('local BM25 Chinese bigrams retrieve sourced chunks instead of unrelated prose', () => {
  const index = buildReferenceIndex(docs); const result = searchReferences(index, '月球低重力基地');
  assert.ok(result.length); assert.equal(result[0].docId, 'moon'); assert.ok(result[0].text.includes('重力')); assert.ok(result[0].chapterId); assert.ok(result[0].score > 0);
  assert.equal(searchReferences(index, '').length, 0); assert.equal(searchReferences(index, '完全不相关XYZ123').length, 0);
  assert.match(referenceContext(index, '月球基地'), /月面资料|不是故事史实/);
});
test('reference index has explicit chunk limits and invalidates when references change', () => {
  const limited = buildReferenceIndex(docs, 1); assert.equal(limited.chunks.length, 1); assert.equal(limited.truncated, true);
  assert.equal(buildReferenceIndex(docs), buildReferenceIndex(docs));
  assert.notEqual(buildReferenceIndex([...docs]), buildReferenceIndex(docs));
});
