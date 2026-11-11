const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mountComponent } = require('../testSupport/mountComponent.cjs');
const { createEmptyProject } = require('../services/projectFactory.ts');
const { createWritingChapter } = require('./writingWorkspace.ts');
const file = name => path.join(__dirname, name + '.tsx');
const text = n => Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : typeof n === 'string' || typeof n === 'number' ? String(n) : '';
const deferred = () => { let resolve; return { promise: new Promise(r => resolve = r), resolve: x => resolve(x) }; };
const book = () => { const p = createEmptyProject('book', { title: '科考', premise: '月球科考' }); const beats = [1, 2, 3, 4].map(i => ({ actIndex: i, actName: `第${i}幕`, outline: `任务${i}`, content: `正文${i}`, wordCount: 3 })); p.chapters = [{ ...createWritingChapter(p, 'chapter', 'now'), actBeats: beats, content: beats.map(b => b.content).join('\n\n') }]; return p; };
function novel(p, regenerateSingleAct, update) { return mountComponent(file('NovelEditor'), 'NovelEditor', { project: p, onUpdateProject: update || (() => {}), onOpenAISettings() {}, pipelineMode: 'CO_WRITING', onPipelineModeChange() {} }, { '../services/chapterExpansionEngine': { ChapterExpansionEngine: { regenerateSingleAct } }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' } }); }
test('single-act rewrite resolves its own events, locks competing work, and rejects a late cancelled result', async () => {
  const wait = deferred(), p = book(); let opts, commits = 0;
  const ui = novel(p, options => { opts = options; return wait.promise; }, () => commits++);
  const btn = ui.nodes().find(n => n.type === 'button' && text(n) === '重写该幕'); const pending = btn.props.onClick(); ui.render();
  assert.ok(opts); assert.ok(Array.isArray(opts.events));
  const draft = ui.nodes().find(n => n.type === 'button' && /起草|执笔中/.test(text(n)) && !text(n).includes('方式')); assert.ok(draft?.props.disabled);
  ui.click('停止当前 AI 任务'); assert.equal(opts.signal.aborted, true);
  wait.resolve({ fullContent: '迟到的改稿', beats: p.chapters[0].actBeats }); await pending; assert.equal(commits, 0);
});
test('POV options identify dead and off-scene characters without claiming a distance', () => {
  const p = book(); p.characters = [{ id: 'dead', name: '甲', title: '', isAlive: false, currentLocationId: 'remote' }]; p.locations = [{ id: 'remote', name: '远站' }, { id: 'here', name: '基地' }]; p.events = [{ id: 'e', locationId: 'here' }]; p.chapters[0].associatedEventIds = ['e'];
  const ui = novel(p, async () => {}); assert.match(ui.text(), /已故/); assert.match(ui.text(), /远站/); assert.match(ui.text(), /不在.*关联事件地点/);
});
test('writing assistant renders streamed preview without changing the original until success', async () => {
  const p = book(), wait = deferred(); let request, saved;
  const ui = mountComponent(file('AuthorDeskEditor'), 'AuthorDeskEditor', { project: p, onUpdateProject: x => saved = x, onOpenDocumentLibrary() {} }, { '../services/aiProviderService': { AIProviderService: { generateText(_c, opts) { request = opts; return wait.promise; } } }, '../services/soundEffects': { soundEffects: {} } });
  const button = ui.nodes().find(n => n.type === 'button' && /润色/.test(text(n))); const pending = button.props.onClick(); ui.render();
  assert.equal(typeof request.onText, 'function'); request.onText('实时预览'); ui.render(); assert.match(ui.text(), /生成|预览/);
  assert.ok(ui.nodes().some(n => n.props.readOnly && n.props.value === '实时预览')); assert.equal(saved, undefined);
  wait.resolve('完成正文'); await pending; assert.ok(saved.chapters[0].content.includes('完成正文'));
});
test('10000-chapter navigation renders a bounded window and can search the final chapter', () => {
  const p = book(), template = p.chapters[0]; p.chapters = Array.from({ length: 10000 }, (_, i) => ({ ...template, id: `c${i}`, chapterNumber: i + 1, title: `章${i + 1}` }));
  const ui = mountComponent(file('AuthorDeskEditor'), 'AuthorDeskEditor', { project: p, onUpdateProject() {}, onOpenDocumentLibrary() {} }, { '../services/soundEffects': { soundEffects: {} } });
  assert.ok(ui.nodes().filter(n => n.props['aria-label']?.startsWith('删除章节：')).length < 20);
  ui.change('搜索写作章节', '章10000'); assert.ok(ui.button('删除章节：章10000'));
});
test('single-chapter checkpoints persist completed acts and are cleared after successful commit', async () => {
  let p = book(), fail = true;
  const checkpoint = { version: 1, signature: '123', title: '稿', outline: '纲', tasks: ['1', '2', '3', '4'], beats: p.chapters[0].actBeats.slice(0, 1), userConstraint: '' };
  const props = { project: p, onUpdateProject: value => p = value, onOpenAISettings() {}, pipelineMode: 'CO_WRITING', onPipelineModeChange() {} };
  const ui = mountComponent(file('NovelEditor'), 'NovelEditor', props, { '../services/geminiService': { GeminiService: { async generateChapter(options) { options.onCheckpoint(checkpoint); if (fail) throw Error('连接中断'); assert.ok(options.resumeFrom); return { title: '稿', outline: '纲', content: '完整结果', beats: checkpoint.beats, activatedLorebookKeys: [] }; } } }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' } });
  const draft = () => ui.nodes().find(n => n.type === 'button' && text(n).startsWith('起草')); await draft().props.onClick(); ui.replaceProps({ ...props, project: p }); assert.ok(p.chapters[0].generationCheckpoint); assert.ok(ui.button('从断点继续'));
  fail = false; await ui.click('从断点继续'); assert.equal(p.chapters[0].content, '完整结果'); assert.equal(p.chapters[0].generationCheckpoint, undefined);
});
test('review: editing visible instructions rejects checkpoint resume before a new paid request', async () => {
  let p = book(), calls = 0;
  const props = { project: p, onUpdateProject: value => p = value, onOpenAISettings() {}, pipelineMode: 'CO_WRITING', onPipelineModeChange() {} };
  const ui = mountComponent(file('NovelEditor'), 'NovelEditor', props, { '../services/geminiService': { GeminiService: { async generateChapter(options) { calls++; options.onCheckpoint({ version: 1, signature: '123', title: '稿', outline: '纲', tasks: ['1', '2', '3', '4'], beats: [], userConstraint: options.userConstraint }); throw Error('断线'); } } }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' } });
  await ui.nodes().find(n => n.type === 'button' && text(n).startsWith('起草')).props.onClick(); ui.replaceProps({ ...props, project: p });
  const instruction = ui.nodes().find(n => n.type === 'textarea' && n.props.placeholder?.startsWith('例如：本章重点')); assert.ok(instruction);
  instruction.props.onChange({ target: { value: '新的作者指令' } }); ui.render(); await ui.click('从断点继续'); ui.render();
  assert.equal(calls, 1); assert.match(ui.text(), /指令.*变化|指令.*不一致/);
});
