import test from 'node:test';
import assert from 'node:assert/strict';
import * as novel from './novelAsync.ts';

const book = () => ({ id: 'book', title: '原作品名', chapters: [{ id: 'one', title: '原章名', content: '原正文', outline: '原大纲', wordCount: 3, status: 'draft' }, { id: 'two', title: '第二章', content: '其它正文', outline: '' }] });

test('a generated chapter merges with the latest unrelated edits', () => {
  const source = book();
  const snapshot = novel.captureNovelChapter(source, 'one');
  const latest = { ...source, title: '新作品名', chapters: [source.chapters[0], { ...source.chapters[1], content: '新写的其它正文' }] };
  const result = novel.applyNovelChapterPatch(latest, snapshot, { content: '生成正文', title: '生成章名' });
  assert.equal(result.chapters[0].content, '生成正文');
  assert.equal(result.title, '新作品名');
  assert.equal(result.chapters[1].content, '新写的其它正文');
});

test('generation and summary cannot overwrite a changed, removed or imported chapter', () => {
  const source = book();
  const snapshot = novel.captureNovelChapter(source, 'one');
  for (const field of ['content', 'outline', 'title', 'status']) {
    const latest = { ...source, chapters: [{ ...source.chapters[0], [field]: '等待时的新修改' }, source.chapters[1]] };
    assert.equal(novel.applyNovelChapterPatch(latest, snapshot, { content: '生成正文' }), null);
    assert.equal(novel.applyNovelChapterPatch(latest, snapshot, { extraction: { chapterSummary: '旧正文的摘要' } }), null);
  }
  assert.equal(novel.applyNovelChapterPatch({ ...source, chapters: [] }, snapshot, {}), null);
  assert.equal(novel.applyNovelChapterPatch({ ...source, id: 'other-book' }, snapshot, {}), null);
});

test('batch totals count only committed chapters when some generations fail', async () => {
  let latest = book();
  const result = await novel.runNovelBatch({
    targetCount: 3, readProject: () => latest, isCancelled: () => false,
    generate: async (source, index) => {
      if (index !== 1) throw new Error('模型不可用');
      return { ...source, chapters: [...source.chapters, { id: 'generated', content: '生成正文' }] };
    },
    commit: updated => { latest = updated; },
  });
  assert.equal(result.completed, 1);
  assert.equal(result.errors.length, 2);
  assert.equal(latest.chapters.length, 3);
});

test('a stopped or unmounted batch discards the in-flight result and makes no further requests', async () => {
  let cancelled = false;
  let resolve;
  let calls = 0;
  let commits = 0;
  const waiting = new Promise(done => { resolve = done; });
  const source = book();
  const task = novel.runNovelBatch({ targetCount: 3, readProject: () => source, isCancelled: () => cancelled, generate: () => { calls++; return waiting; }, commit: () => { commits++; } });
  cancelled = true;
  resolve(source);
  const result = await task;
  assert.equal(result.stopped, true);
  assert.equal(result.completed, 0);
  assert.equal(commits, 0);
  assert.equal(calls, 1);
});

test('a batch preserves edits made while generating and exposes the unused output', async () => {
  let latest = book();
  let preserved;
  const result = await novel.runNovelBatch({
    targetCount: 3, readProject: () => latest, isCancelled: () => false,
    generate: async source => {
      latest = { ...latest, title: '等待时的新作品名' };
      return { ...source, chapters: [...source.chapters, { id: 'generated', content: '可复制的生成正文' }] };
    },
    commit: () => { assert.fail('a stale batch must not commit'); },
    onConflict: output => { preserved = output.chapters.at(-1).content; },
  });
  assert.equal(latest.title, '等待时的新作品名');
  assert.equal(result.completed, 0);
  assert.equal(result.stopped, true);
  assert.equal(preserved, '可复制的生成正文');
});
