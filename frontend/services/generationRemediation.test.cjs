const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadService } = require('../testSupport/loadService.cjs');
const { createEmptyProject } = require('./projectFactory.ts');
const { createWritingChapter } = require('../components/writingWorkspace.ts');
const file = name => path.join(__dirname, name + '.ts');
const book = () => createEmptyProject('book', { title: '新书', premise: '唯一故事简介_111' });
const outline = 'TITLE: 新章\nSUMMARY: 梗概\nACT1: 起\nACT2: 承\nACT3: 转\nACT4: 合';
function services(fn) { return name => loadService(file(name), { './aiProviderService': { AIProviderService: { generateText: fn } } }); }
test('F11/F12 oracle rejects provider errors and malformed JSON items without fabricating fallback stories', async () => {
  const failing = services(async () => { throw Error('连接失败'); })('chaosTwistService').ChaosTwistService;
  await assert.rejects(failing.rollChaosTwists(book(), '新剧情'), /连接失败/);
  const invalid = services(async () => '[{"title":"缺字段"}]')('chaosTwistService').ChaosTwistService;
  await assert.rejects(invalid.rollChaosTwists(book()), /格式|字段/);
});
test('F13/F26 chapter generation includes recent prose summaries and POV knowledge and respects the chosen length', async () => {
  const calls = [], p = book(); p.settings.chapterLengthTarget = 200; p.worldName = '唯一世界名_888';
  p.chapters = [{ ...createWritingChapter(p, 'first', 'now'), content: '唯一前文秘密_222', extraction: { chapterSummary: '唯一沉淀摘要_333', keyStateChanges: ['变化'], newLoreLearned: [], tensionScore: 10 } }];
  p.characters = [{ id: 'pov', name: '林', currentMood: '平静', coreDesire: '', currentGoal: '', knownFacts: [{ fact: '唯一认知秘密_444' }] }];
  const { GeminiService } = services(async (_c, opts) => { calls.push(opts); return calls.length === 1 ? outline : '文'.repeat(55); })('geminiService');
  await GeminiService.generateChapter({ project: p, volumeNumber: 1, chapterNumber: 2, events: [], povCharacterId: 'pov' });
  for (const marker of ['唯一前文秘密_222', '唯一沉淀摘要_333', '唯一认知秘密_444']) assert.match(calls[0].prompt, new RegExp(marker));
  assert.match(calls[0].prompt, /200/); assert.doesNotMatch(calls[1].prompt, /1000~1200/); assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.prompt.includes('唯一世界名_888')));
});
test('F14/F20 suggestions receive manuscript and rules and keep saved sampling and authors note', async () => {
  const calls = [], p = book(); p.rules = [{ rule: '唯一世界法则_555', category: 'natural' }];
  p.chapters = [{ ...createWritingChapter(p, 'first', 'now'), content: '唯一前文_666' }]; p.aiConfig.authorsNote = { enabled: true, content: '唯一附注_777', insertionDepth: 1 };
  const { GeminiService } = services(async (_c, opts) => { calls.push(opts); return '1. 建议'; })('geminiService'); await GeminiService.coWriteSuggestions(p, '继续');
  for (const marker of ['唯一故事简介_111', '唯一世界法则_555', '唯一前文_666']) assert.match(calls[0].prompt, new RegExp(marker));
  assert.equal(calls[0].overrideSampling?.temperature, undefined); assert.equal(calls[0].authorsNote, '唯一附注_777');
});
test('F22 cancelling the pipeline aborts its active transport and starts no further acts', async () => {
  const controller = new AbortController(); let calls = 0, signal;
  const { GeminiService } = services(async (_c, opts) => { calls++; signal = opts.signal; controller.abort(); return outline; })('geminiService');
  await assert.rejects(GeminiService.generateChapter({ project: book(), volumeNumber: 1, chapterNumber: 1, events: [], signal: controller.signal }), /创作已取消/); assert.equal(calls, 1); assert.equal(signal, controller.signal);
});
test('completed acts checkpoint and resume without charging again for the outline or prior acts', async () => {
  let calls = 0, checkpoint;
  const p = book(); p.settings.chapterLengthTarget = 200;
  const { ChapterExpansionEngine } = services(async () => { calls++; if (calls === 3) throw Error('断线'); return calls === 1 ? outline : '文'.repeat(70); })('chapterExpansionEngine');
  const params = { project: p, volumeNumber: 1, chapterNumber: 1, events: [], onCheckpoint: value => checkpoint = value };
  await assert.rejects(ChapterExpansionEngine.generateDeepChapter(params), /断线/); assert.equal(checkpoint.beats.length, 1);
  let resumedCalls = 0;
  const resumed = services(async () => { resumedCalls++; return '续'.repeat(70); })('chapterExpansionEngine').ChapterExpansionEngine;
  const result = await resumed.generateDeepChapter({ ...params, resumeFrom: checkpoint });
  assert.equal(resumedCalls, 3); assert.ok(result.content.startsWith('文')); assert.equal(result.beats.length, 4);
  await assert.rejects(resumed.generateDeepChapter({ ...params, project: { ...p, authorNote: '改过简介' }, resumeFrom: checkpoint }), /断点|设置/);
});
test('review: a short checkpoint with supplement act 5 resumes without appending or requesting another supplement', async () => {
  const p = book(); p.settings.chapterLengthTarget = 100; let checkpoint;
  let calls = 0;
  const engine = services(async () => { calls++; return calls === 1 ? outline : 'x'; })('chapterExpansionEngine').ChapterExpansionEngine;
  const params = { project: p, chapterNumber: 1, volumeNumber: 1, events: [], onCheckpoint: value => checkpoint = value };
  await engine.generateDeepChapter(params); assert.equal(checkpoint.beats.length, 5);
  const before = calls; const result = await engine.generateDeepChapter({ ...params, resumeFrom: checkpoint });
  assert.equal(calls, before); assert.equal(result.beats.length, 5); assert.equal(new Set(result.beats.map(b => b.actIndex)).size, 5);
});

test('reference retrieval opt-in applies consistently to full chapters and individual act rewrites', async () => {
  for (const enabled of [false, true]) {
    const p = book(), calls = []; p.settings.referenceRetrievalEnabled = enabled; p.settings.chapterLengthTarget = 100;
    p.referenceDocs = [{ id: 'doc', title: '月面手册', parsedChapters: [{ id: 'c', title: '基地', content: '月球基地依靠低重力密封空气循环。' }] }];
    const engine = services(async (_c, opts) => { calls.push(opts); return calls.length === 1 ? outline : '文'.repeat(30); })('chapterExpansionEngine').ChapterExpansionEngine;
    const result = await engine.generateDeepChapter({ project: p, chapterNumber: 1, volumeNumber: 1, events: [], userConstraint: '月球基地' });
    await engine.regenerateSingleAct({ project: p, chapterNumber: 1, actIndex: 1, chapterTitle: result.title, actTask: '开场', existingBeats: result.beats, events: [], userConstraint: '月球基地' });
    for (const call of calls) assert.equal((call.lorebookBlock || '').includes('月面手册'), enabled);
  }
});
