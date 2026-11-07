import test from 'node:test';
import assert from 'node:assert/strict';
import * as writingWorkspace from './writingWorkspace.ts';
import {
  applyWritingAssistantResult,
  createWritingChapter,
  updateWritingContent,
  updateWritingPreferences,
} from './writingWorkspace.ts';

const chapter = (id, content, chapterNumber = 1) => ({
  id, content, chapterNumber, volumeNumber: 1, title: id, outline: '',
  wordCount: content.length, associatedEventIds: [], createdAt: 'old', updatedAt: 'old', status: 'draft',
});
const project = () => ({
  id: 'book-a', title: '我的作品', chapters: [chapter('one', '原始正文'), chapter('two', '另一章', 7)],
  deskSettings: { theme: 'sepia', fontSize: 21, currentSessionWords: 10, targetDailyWords: 100 },
});
const request = () => ({ projectId: 'book-a', chapterId: 'one', sourceContent: '原始正文', replaceStart: 1, replaceEnd: 3 });

test('an empty book can create its first editable chapter', () => {
  const result = createWritingChapter({ ...project(), chapters: [] }, 'new-id', 'today');
  assert.equal(result.id, 'new-id');
  assert.equal(result.chapterNumber, 1);
  assert.equal(result.content, '');
  assert.equal(result.wordCount, 0);
});

test('new chapters follow the highest existing chapter number', () => {
  assert.equal(createWritingChapter(project(), 'new-id', 'today').chapterNumber, 8);
});

test('deleting the selected chapter selects the next chapter and preserves unrelated writing', () => {
  const original = project();
  original.chapters.push(chapter('three', '第三章新正文', 9));
  original.events = [{ id: 'event', description: '仍需保留的世界事件' }];
  assert.equal(typeof writingWorkspace.deleteWritingChapter, 'function');
  const result = writingWorkspace.deleteWritingChapter(original, 'two', 'two');
  assert.deepEqual(result.project.chapters.map(item => item.id), ['one', 'three']);
  assert.equal(result.activeChapterId, 'three');
  assert.strictEqual(result.project.chapters[0], original.chapters[0]);
  assert.strictEqual(result.project.chapters[1], original.chapters[2]);
  assert.strictEqual(result.project.events, original.events);
  assert.strictEqual(result.project.deskSettings, original.deskSettings);
  assert.deepEqual(original.chapters.map(item => item.id), ['one', 'two', 'three']);
});

test('deleting the last selected chapter selects its previous neighbor without renumbering', () => {
  assert.equal(typeof writingWorkspace.deleteWritingChapter, 'function');
  const result = writingWorkspace.deleteWritingChapter(project(), 'two', 'two');
  assert.equal(result.activeChapterId, 'one');
  assert.equal(result.project.chapters[0].chapterNumber, 1);
});

test('deleting another chapter preserves the selected chapter', () => {
  assert.equal(typeof writingWorkspace.deleteWritingChapter, 'function');
  const result = writingWorkspace.deleteWritingChapter(project(), 'one', 'two');
  assert.equal(result.activeChapterId, 'two');
  assert.equal(result.project.chapters[0].content, '另一章');
  assert.equal(result.project.chapters[0].chapterNumber, 7);
});

test('the final chapter can be deleted and the empty book can start again', () => {
  assert.equal(typeof writingWorkspace.deleteWritingChapter, 'function');
  const original = { ...project(), chapters: [chapter('one', '最后正文')] };
  const result = writingWorkspace.deleteWritingChapter(original, 'one', 'one');
  assert.deepEqual(result.project.chapters, []);
  assert.equal(result.activeChapterId, '');
  assert.equal(createWritingChapter(result.project, 'new-first', 'today').chapterNumber, 1);
  assert.equal(applyWritingAssistantResult(result.project, request(), '迟到的生成正文', 'later').applied, false);
});

test('a repeated deletion leaves the latest project and current selection untouched', () => {
  assert.equal(typeof writingWorkspace.deleteWritingChapter, 'function');
  const latest = project();
  const result = writingWorkspace.deleteWritingChapter(latest, 'already-removed', 'two');
  assert.strictEqual(result.project, latest);
  assert.equal(result.activeChapterId, 'two');
});

test('preference changes preserve other preferences and project content', () => {
  const original = project();
  const result = updateWritingPreferences(original, { soundEnabled: false, fontSize: 23 });
  assert.equal(result.deskSettings.theme, 'sepia');
  assert.equal(result.deskSettings.soundEnabled, false);
  assert.equal(result.deskSettings.fontSize, 23);
  assert.equal(result.deskSettings.lineHeight, 1.9);
  assert.strictEqual(result.chapters, original.chapters);
  assert.equal(original.deskSettings.fontSize, 21);
});

test('editing updates only the target chapter and counts added characters', () => {
  const original = project();
  const result = updateWritingContent(original, 'one', '原始正文追加', 'now');
  assert.equal(result.chapters[0].content, '原始正文追加');
  assert.equal(result.chapters[0].wordCount, 6);
  assert.equal(result.chapters[0].updatedAt, 'now');
  assert.equal(result.deskSettings.currentSessionWords, 12);
  assert.strictEqual(result.chapters[1], original.chapters[1]);
  assert.equal(updateWritingContent(result, 'one', '原始', 'later').deskSettings.currentSessionWords, 12);
});

test('AI replacements use the captured selection and preserve newer unrelated changes', () => {
  const latest = project();
  latest.title = '新作品名';
  latest.chapters[1].content = '其它章节的新修改';
  latest.deskSettings.fontSize = 25;
  const result = applyWritingAssistantResult(latest, request(), '新文字', 'now');
  assert.equal(result.applied, true);
  assert.equal(result.project.chapters[0].content, '原新文字文');
  assert.equal(result.project.chapters[1].content, '其它章节的新修改');
  assert.equal(result.project.title, '新作品名');
  assert.equal(result.project.deskSettings.fontSize, 25);
});

test('AI results cannot overwrite edits made while waiting', () => {
  const latest = project();
  latest.chapters[0].content = '等待时继续写作';
  const result = applyWritingAssistantResult(latest, request(), '生成结果', 'now');
  assert.equal(result.applied, false);
  assert.equal(latest.chapters[0].content, '等待时继续写作');
});

test('AI results are rejected when the project changes or the chapter is removed', () => {
  assert.equal(applyWritingAssistantResult({ ...project(), id: 'other' }, request(), '生成结果', 'now').applied, false);
  assert.equal(applyWritingAssistantResult({ ...project(), chapters: [] }, request(), '生成结果', 'now').applied, false);
});

test('AI continuation appends without replacing earlier text', () => {
  const result = applyWritingAssistantResult(project(), { ...request(), replaceStart: 4, replaceEnd: 4 }, '\n\n续写', 'now');
  assert.equal(result.applied, true);
  assert.equal(result.project.chapters[0].content, '原始正文\n\n续写');
});

test('paragraph formatting stays stable when applied repeatedly', () => {
  const formatted = writingWorkspace.formatWritingParagraphs(' 第一段\n\n\n　　第二段 \n');
  assert.equal(formatted, '　　第一段\n\n　　第二段');
  assert.equal(writingWorkspace.formatWritingParagraphs(formatted), '　　第一段\n\n　　第二段');
});
