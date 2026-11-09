const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mountComponent } = require('../testSupport/mountComponent.cjs');
const { createEmptyProject } = require('../services/projectFactory.ts');
const { createWritingChapter, updateWritingContent, defaultWritingSettings } = require('./writingWorkspace.ts');
const file = name => path.join(__dirname, name + '.tsx');
const book = () => createEmptyProject('book', { title: '月球考古', genre: '科幻', premise: '寻找失联的科考站' });
const chapter = (p, content = '开头。选中的原文。结尾。') => ({ ...createWritingChapter(p, 'chapter', new Date().toISOString()), content, wordCount: content.length });
const textOf = n => Array.isArray(n) ? n.map(textOf).join('') : n?.props ? textOf(n.props.children) : typeof n === 'string' || typeof n === 'number' ? String(n) : '';
const gate = () => { let resolve; return { promise: new Promise(r => resolve = r), resolve: x => resolve(x) }; };
const location = (id = 'home') => ({ id, name: id, type: 'city', description: '', climateOrDanger: '', connectedLocationIds: [] });
const person = (id = 'hero', loc = 'home') => ({ id, name: id, title: '', age: 20, gender: '女', occupation: '', factionId: '', currentLocationId: loc, appearance: '', personality: '', coreDesire: '', greatestFear: '', currentMood: '平静', moralityAlignment: '绝对中立', health: 50, wealth: 10, inventory: [], currentGoal: '', isAlive: true, relationships: {}, knownFacts: [] });
const noSound = { '../services/soundEffects': { soundEffects: { playKeyClick() {}, playChime() {} } } };

test('F05 selected continuation retains the selection and inserts after it', async () => {
  let p = book(); p.chapters = [chapter(p)];
  const ui = mountComponent(file('AuthorDeskEditor'), 'AuthorDeskEditor', { project: p, onUpdateProject: x => p = x, onOpenDocumentLibrary() {} }, { ...noSound, '../services/aiProviderService': { AIProviderService: { async generateText() { return '新续文'; } } } });
  ui.nodes().find(n => n.props['aria-label'] === '章节正文').props.ref.current = { selectionStart: 3, selectionEnd: 9 };
  const btn = ui.nodes().find(n => n.type === 'button' && /续写/.test(n.props['aria-label'] || textOf(n))); await btn.props.onClick();
  assert.equal(p.chapters[0].content, '开头。选中的原文。\n\n新续文结尾。');
});
test('F21 changing manuscript invalidates extraction beats and final status; unchanged text preserves them', () => {
  const p = book(); p.chapters = [{ ...chapter(p), status: 'final', tensionScore: 99, extraction: { chapterSummary: '旧', tensionScore: 99 }, actBeats: [] }];
  assert.equal(updateWritingContent(p, 'chapter', p.chapters[0].content, 'now').chapters[0].status, 'final');
  const result = updateWritingContent(p, 'chapter', '完全重写', 'now');
  assert.equal(result.chapters[0].extraction, undefined); assert.equal(result.chapters[0].tensionScore, undefined); assert.equal(result.chapters[0].actBeats, undefined); assert.equal(result.chapters[0].status, 'draft');
});
test('F27 daily counter resets across dates and retains same-day edits', () => {
  const p = book(); p.chapters = [chapter(p, '旧稿')];
  p.deskSettings = { ...defaultWritingSettings, currentSessionWords: 5000, lastWritingDate: '2026-11-08' };
  const result = updateWritingContent(p, 'chapter', '旧稿新增', '2026-11-09T12:00:00');
  assert.equal(result.deskSettings.currentSessionWords, 2); assert.equal(result.deskSettings.lastWritingDate, '2026-11-09');
  assert.equal(updateWritingContent(result, 'chapter', '旧稿新增文字', '2026-11-09T12:01:00').deskSettings.currentSessionWords, 4);
});

test('F01/F03 characters start neutral and can be assigned to a location created afterwards', () => {
  let p = book(); const props = { project: p, onUpdateProject: x => p = x };
  const ui = mountComponent(file('CharacterManager'), 'CharacterManager', props);
  ui.nodes().find(n => n.props.title === '手动添加新人物').props.onClick();
  assert.equal(p.characters[0].currentLocationId, ''); assert.equal(p.characters[0].currentGoal, '');
  p = { ...p, locations: [location()] }; ui.replaceProps({ ...props, project: p }); ui.change('人物所在地点', 'home'); assert.equal(p.characters[0].currentLocationId, 'home');
});
test('F02 factions can be added edited and assigned from a new book', () => {
  let p = book(); const props = { project: p, onUpdateProject: x => p = x };
  const ui = mountComponent(file('WorldEditor'), 'WorldEditor', props); ui.click('势力与阵营 (0)');
  ui.change('势力名称', '科考队'); ui.click('保存势力'); assert.equal(p.factions[0].name, '科考队');
  ui.replaceProps({ ...props, project: p }); ui.click('编辑势力：科考队'); ui.change('势力名称', '新科考队'); ui.click('保存势力'); assert.equal(p.factions.length, 1); assert.equal(p.factions[0].name, '新科考队');
});
test('F04 deleting an occupied location is blocked and unoccupied deletion removes links', () => {
  let p = book(); p.locations = [location(), { ...location('away'), connectedLocationIds: ['home'] }]; p.characters = [person()];
  const props = { project: p, onUpdateProject: x => p = x }; const ui = mountComponent(file('WorldEditor'), 'WorldEditor', props); ui.click('地理与地点 (2)');
  ui.click('删除地点：home'); assert.equal(p.locations.length, 2); assert.match(ui.text(), /人物|引用/);
  p = { ...p, characters: [] }; ui.replaceProps({ ...props, project: p }); ui.click('删除地点：home'); assert.equal(p.locations.length, 1); assert.equal(p.locations[0].connectedLocationIds.length, 0);
});
test('F07 an old AI character callback merges into the latest book and ignores a different book', () => {
  let p = book(); p.chapters = [chapter(p, '原稿')]; const props = { project: p, onUpdateProject: x => p = x };
  const ui = mountComponent(file('CharacterManager'), 'CharacterManager', props); ui.click('AI生成'); const callback = ui.nodes().find(n => n.props.onAddCharacter).props.onAddCharacter;
  p = { ...p, chapters: [chapter(p, '新稿')] }; ui.replaceProps({ ...props, project: p }); callback(person()); assert.equal(p.chapters[0].content, '新稿');
  p = { ...book(), id: 'other' }; ui.replaceProps({ ...props, project: p }); callback(person('late')); assert.equal(p.characters.length, 0);
});
test('F18/F28 generated characters retain zeros and reject invalid fields before committing', async () => {
  let raw = '{"name":"小孩","age":0,"health":0,"wealth":0}', saved, errors = [];
  const ui = mountComponent(file('CharacterCardGeneratorModal'), 'CharacterCardGeneratorModal', { project: book(), onAddCharacter: x => saved = x, onClose() {} }, { '../services/aiProviderService': { AIProviderService: { async generateText() { return raw; } } } }, { alert: x => errors.push(x) });
  ui.change('人物灵感', '科研人员'); await ui.click('生成完整人物档案'); assert.equal(saved.age, 0); assert.equal(saved.health, 0); assert.equal(saved.wealth, 0);
  ui.render(); saved = undefined; raw = '{"name":"坏字段","age":"二十","inventory":[{}]}'; await ui.click('生成完整人物档案'); ui.render(); assert.equal(saved, undefined); assert.ok(errors.length || /格式|字段/.test(ui.text()));
});
const docs = () => [{ id: 'a', title: '资料甲', format: 'txt', parsedChapters: [{ id: 'a1', title: '甲一', content: '甲原文' }, { id: 'a2', title: '甲二', content: '第二章资料' }] }, { id: 'b', title: '资料乙', format: 'txt', parsedChapters: [{ id: 'b1', title: '乙一', content: '乙原文' }] }];
function selectDoc(ui, title) { ui.nodes().find(n => n.type === 'button' && textOf(n).includes(title)).props.onClick(); ui.render(); }
test('F06 document upload merges the latest manuscript and ignores completion after unmount', async () => {
  for (const unmount of [false, true]) {
    const wait = gate(); let p = book(), commits = 0; p.chapters = [chapter(p, '旧正文')];
    const props = { project: p, onUpdateProject: x => { p = x; commits++; }, onClose() {} };
    const ui = mountComponent(file('DocumentLibraryModal'), 'DocumentLibraryModal', props, { '../services/documentParserService': { DocumentParserService: { parseTxtFile: () => wait.promise } } });
    const pending = ui.nodes().find(n => n.props.type === 'file').props.onChange({ target: { files: [{ name: 'a.txt' }], value: '' } });
    p = { ...p, chapters: [chapter(p, '等待中新正文')] }; ui.replaceProps({ ...props, project: p }); if (unmount) ui.unmount();
    wait.resolve({ id: 'ref', title: 'ref', parsedChapters: [] }); await pending;
    assert.equal(p.chapters[0].content, '等待中新正文'); assert.equal(commits, unmount ? 0 : 1);
  }
});
test('F23 document switching cancels pending research and hides the previous answer', async () => {
  const wait = gate(), p = book(); p.referenceDocs = docs(); let signal;
  const ui = mountComponent(file('DocumentLibraryModal'), 'DocumentLibraryModal', { project: p, onUpdateProject() {}, onClose() {} }, { '../services/aiProviderService': { AIProviderService: { generateText(_c, opts) { signal = opts.signal; return wait.promise; } } } });
  ui.nodes().find(n => n.type === 'button' && textOf(n) === 'AI 考据').props.onClick(); ui.render(); const pending = ui.click('开始探针提炼');
  selectDoc(ui, '资料乙'); assert.equal(signal?.aborted, true); wait.resolve('甲答案'); await pending; ui.render(); assert.doesNotMatch(ui.text(), /甲答案/);
});
test('F29 switching source clears unfinished excerpts and stale save callbacks cannot misattribute them', () => {
  const p = book(); p.referenceDocs = docs(); let saved;
  const ui = mountComponent(file('DocumentLibraryModal'), 'DocumentLibraryModal', { project: p, onUpdateProject: x => saved = x, onClose() {} }, {}, { window: { getSelection: () => ({ toString: () => '甲原文' }) }, alert() {} });
  ui.nodes().find(n => n.props.onMouseUp).props.onMouseUp(); ui.render(); const oldSave = ui.button('存入卡片盒').props.onClick;
  selectDoc(ui, '资料乙'); assert.doesNotMatch(ui.text(), /已划取文本/); oldSave(); assert.equal(saved, undefined);
});
test('F30 split reference permits all chapters and provides a PDF viewer', () => {
  const p = book(); p.referenceDocs = docs(); const props = { project: p, onUpdateProject() {}, onOpenDocumentLibrary() {} };
  const ui = mountComponent(file('AuthorDeskEditor'), 'AuthorDeskEditor', props, noSound); ui.click('对照素材'); ui.change('对照资料章节', '1'); assert.match(ui.text(), /第二章资料/);
  p.referenceDocs = [{ ...docs()[0], format: 'pdf', fileBlobUrl: 'blob:test' }]; ui.replaceProps({ ...props, project: p }); assert.ok(ui.nodes().some(n => n.props.document?.format === 'pdf' || n.type === 'iframe'));
});
test('F22 stopping Mode A aborts its request and cannot commit late output', async () => {
  const wait = gate(), p = book(); let signal, commits = 0;
  const ui = mountComponent(file('NovelEditor'), 'NovelEditor', { project: p, onUpdateProject() { commits++; }, onOpenAISettings() {}, pipelineMode: 'AUTO_NOVEL', onPipelineModeChange() {} }, { '../services/geminiService': { GeminiService: { generateChapter(opts) { signal = opts.signal; return wait.promise; } } }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' } });
  const pending = ui.click('连跑 3 章 (约1.2万字)'); ui.click('停止任务'); assert.equal(signal?.aborted, true);
  wait.resolve({ title: '稿', outline: '', content: '晚到正文', activatedLorebookKeys: [] }); await pending; assert.equal(commits, 0);
});
test('F26 current project metadata exposes world style viewpoint and chapter length and saves all fields', async () => {
  const p = book(); let saved;
  const ui = mountComponent(file('ProjectLibraryModal'), 'ProjectLibraryModal', { project: p, onActivate: async x => saved = x, onClose() {} }, { '../services/storageService': { storageService: { async listProjectsAsync() { return []; } } } });
  ui.change('当前世界名', '月面科研区'); ui.change('当前文风', '悬疑冷峻'); ui.change('当前视角', '第一人称'); ui.change('章节目标字数', '800'); await ui.click('保存作品信息');
  assert.equal(saved.worldName, '月面科研区'); assert.equal(saved.settings.literaryStyle, '悬疑冷峻'); assert.equal(saved.settings.povPreference, '第一人称'); assert.equal(saved.settings.chapterLengthTarget, 800);
});
test('F11 oracle errors stay visible and closing aborts a pending retry', async () => {
  let signal; const wait = gate(); let fail = true;
  const ui = mountComponent(file('ChaosOracleModal'), 'ChaosOracleModal', { project: book(), onApplyTwist() {}, onClose() {} }, { './../services/chaosTwistService': { ChaosTwistService: { async rollChaosTwists(_p, _c, value) { signal = value; if (fail) throw Error('连接失败'); return wait.promise; } } } });
  ui.change('当前剧情与期望变故', '科研站断电'); await ui.click('生成剧情提案'); ui.render(); assert.match(ui.text(), /连接失败/); fail = false;
  const pending = ui.click('生成剧情提案'); ui.click('关闭对话框'); assert.equal(signal?.aborted, true); wait.resolve([]); await pending;
});
test('F25 built-in deployment help uses the same Node instructions as the maintained deployment guide', () => {
  const ui = mountComponent(file('AboutSystemModal'), 'AboutSystemModal', { onClose() {} });
  ui.click('部署与运维'); assert.ok(ui.nodes().some(n => n.type?.name === 'DeploymentGuideContent'));
  const guide = mountComponent(file('DeploymentGuideModal'), 'DeploymentGuideContent', {});
  assert.match(guide.text(), /Node|浏览器/); assert.match(guide.text(), /compose.yaml/); assert.doesNotMatch(guide.text(), /python:|postgres:|DATABASE_URL/);
});
test('F22 single generation ignores an aborted provider result and UI uses the configured chapter target', async () => {
  const wait = gate(), p = book(); p.settings.chapterLengthTarget = 800; p.chapters = [chapter(p)]; let signal, commits = 0;
  const ui = mountComponent(file('NovelEditor'), 'NovelEditor', { project: p, onUpdateProject() { commits++; }, onOpenAISettings() {}, pipelineMode: 'CO_WRITING', onPipelineModeChange() {} }, { '../services/geminiService': { GeminiService: { generateChapter(opts) { signal = opts.signal; return wait.promise; } } }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' } });
  assert.match(ui.text(), /800/); assert.doesNotMatch(ui.text(), /保底4000|目标约 4,000/);
  const btn = ui.nodes().find(n => n.type === 'button' && /起草/.test(textOf(n))); const pending = btn.props.onClick(); ui.render(); ui.click('停止当前 AI 任务'); assert.equal(signal.aborted, true);
  wait.resolve({ title: '晚到', outline: '', content: '不应写回', activatedLorebookKeys: [] }); await pending; assert.equal(commits, 0);
});
test('PDF viewer releases URLs on source changes and unmount and cannot relink a later source with stale bytes', async () => {
  const made = [], revoked = [], wait = gate(); let commits = 0;
  const props = { document: { id: 'one', title: '甲', format: 'pdf', fileDataBase64: 'first' }, onRelink() { commits++; } };
  const ui = mountComponent(file('PdfDocumentViewer'), 'PdfDocumentViewer', props, { '../services/documentParserService': { DocumentParserService: { pdfBlob: doc => doc.fileDataBase64, parsePdfFile: () => wait.promise } } }, { URL: { createObjectURL(data) { made.push(data); return `blob:${data}`; }, revokeObjectURL(url) { revoked.push(url); } } });
  assert.equal(made[0], 'first'); const pending = ui.nodes().find(n => n.props['aria-label'] === '重新关联 PDF').props.onChange({ target: { files: [{}], value: '' } });
  ui.replaceProps({ ...props, document: { ...props.document, id: 'two', fileDataBase64: 'second' } }); assert.ok(revoked.includes('blob:first'));
  wait.resolve({ id: 'parsed', fileDataBase64: 'late' }); await pending; assert.equal(commits, 0); ui.unmount(); assert.ok(revoked.includes('blob:second'));
});
