// Historical pre-fix probes for df5eebc; assertions describe old defects.
// Current acceptance: npm run check. Avoid overwriting the archived JSON on the fixed checkout.
// Diagnostic probes only: no application changes, real credentials, browser stores or AI calls.
// Run from repository root: node docs/qa/functional-audit-2026-11-08.cjs
// Assertions intentionally describe observed defects, not desired behavior.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { transform } = require('sucrase');
const { mountComponent } = require('../../frontend/testSupport/mountComponent.cjs');
const root = path.resolve(__dirname, '../..');
const abs = p => path.join(root, p);
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  const load = file => {
    file = path.resolve(file);
    const key = path.relative(root, file).replaceAll('\\', '/');
    if (key in overrides) return overrides[key];
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = transform(fs.readFileSync(file, 'utf8'), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic' }).code;
    const run = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console: { ...console, warn() {}, error() {} }, Date, Error, TypeError, JSON,
      File, Blob, URL, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer,
      structuredClone, AbortController, setTimeout, clearTimeout, ...globals,
    }, { filename: file });
    run(name => {
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(file), name);
        const target = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (target) return load(target);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  };
  return p => load(abs(p));
}
const load = loader();
const { createEmptyProject } = load('frontend/services/projectFactory.ts');
const { createWritingChapter, updateWritingContent } = load('frontend/components/writingWorkspace.ts');
const { SimulationEngine } = load('frontend/services/simulationEngine.ts');
const { DocumentParserService: Parser } = load('frontend/services/documentParserService.ts');
const book = () => createEmptyProject('audit_book', { title: '月球考古', genre: '科幻', premise: '宇航员寻找失联科研站。' });
const chapter = (p, id = 'chapter1', content = '原始正文', number = 1) => ({ ...createWritingChapter(p, id, '2026-11-08T00:00:00Z'), chapterNumber: number, content, wordCount: content.length });
const location = (id = 'station') => ({ id, name: id, type: 'city', description: '', climateOrDanger: '', connectedLocationIds: [] });
const character = (id = 'hero', loc = 'station') => ({ id, name: id, title: '', age: 20, gender: '女', occupation: '科研员', factionId: '', currentLocationId: loc, appearance: '', personality: '', coreDesire: '', greatestFear: '', currentMood: '平静', moralityAlignment: '', health: 50, wealth: 10, inventory: [], currentGoal: '', isAlive: true, relationships: {}, knownFacts: [] });
const event = (id, actor, step = 1, loc = 'station') => ({ id, simulationTime: '第1日 子时', timeStepIndex: step, eventType: 'dialogue', locationId: loc, participantIds: [actor], causeEventIds: [], title: '谈话', description: '', consequences: [], stateChanges: [], visibility: { isPublic: true, knownByCharacterIds: [actor] }, confirmed: true });
const textOf = n => Array.isArray(n) ? n.map(textOf).join('') : n?.props ? textOf(n.props.children) : typeof n === 'string' || typeof n === 'number' ? String(n) : '';
const clickTitle = (ui, title) => { const n = ui.nodes().find(n => n.type === 'button' && n.props.title === title); assert.ok(n, title); const result = n.props.onClick(); ui.render(); return result; };
const edit = (ui, predicate, value) => { const n = ui.nodes().find(predicate); assert.ok(n, 'input exists'); n.props.onChange({ target: { value } }); ui.render(); };
const deferred = () => { let resolve; return { promise: new Promise(r => resolve = r), resolve: value => resolve(value) }; };
const records = [];
async function probe(id, name, fn) {
  try { const evidence = await fn(); records.push({ id, name, status: 'reproduced', evidence }); }
  catch (err) { records.push({ id, name, status: 'probe_failed', error: err.stack }); }
}
async function check(id, name, fn) {
  await probe(id, name, fn);
  const item = records[records.length - 1];
  if (item.status === 'reproduced') item.status = 'verified';
}
// Construct a real ZIP/DEFLATE EPUB container without adding dependencies.
function zip(entries) {
  const crc = data => { let value = -1; for (const b of data) { value ^= b; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); } return (value ^ -1) >>> 0; };
  const local = [], central = []; let offset = 0;
  for (const [name, content, method = 8] of entries) {
    const n = Buffer.from(name), raw = Buffer.from(content), compressed = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt16LE(method, 8); h.writeUInt32LE(crc(raw), 14); h.writeUInt32LE(compressed.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(method, 10); c.writeUInt32LE(crc(raw), 16); c.writeUInt32LE(compressed.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(h, n, compressed); central.push(c, n); offset += h.length + n.length + compressed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

(async () => {
  await probe('F01', '人物先于地点创建后无法通过人物页分配地点', () => {
    let p = book(); const props = { project: p, onUpdateProject: x => p = x };
    const ui = mountComponent(abs('frontend/components/CharacterManager.tsx'), 'CharacterManager', props);
    clickTitle(ui, '手动添加新人物');
    assert.equal(p.characters[0].currentLocationId, 'loc_tavern');
    p = { ...p, locations: [location()] }; ui.replaceProps({ ...props, project: p });
    assert.equal(ui.nodes().filter(n => n.type === 'select').length, 0);
    assert.equal(SimulationEngine.stepTime(p, 4).newEvents.length, 0);
    return { assignedLocation: p.characters[0].currentLocationId, availableLocations: p.locations.map(x => x.id), locationSelectors: 0, eventsAfterStep: 0 };
  });
  await probe('F02', '空白书势力页只有展示，没有创建或编辑入口', () => {
    const p = book(); const ui = mountComponent(abs('frontend/components/WorldEditor.tsx'), 'WorldEditor', { project: p, onUpdateProject() {} });
    ui.click('势力与阵营 (0)');
    assert.equal(ui.nodes().filter(n => ['input', 'textarea', 'select'].includes(n.type)).length, 0);
    assert.equal(ui.nodes().filter(n => n.type === 'button').length, 4);
    return { factions: p.factions.length, onlyButtons: ui.nodes().filter(n => n.type === 'button').map(textOf) };
  });
  await probe('F03', '手动人物和地点实际默认值仍写入旧示例世界', () => {
    let p = book(); const ui = mountComponent(abs('frontend/components/CharacterManager.tsx'), 'CharacterManager', { project: p, onUpdateProject: x => p = x });
    clickTitle(ui, '手动添加新人物'); assert.match(p.characters[0].currentGoal, /寒江关/);
    const w = mountComponent(abs('frontend/components/WorldEditor.tsx'), 'WorldEditor', { project: p, onUpdateProject: x => p = x });
    w.click('地理与地点 (0)'); edit(w, n => n.type === 'input' && n.props.placeholder?.includes('望雪崖'), '月球基地');
    w.click('保存至地理网络');
    assert.equal(p.locations[0].description, '北关未知据点');
    return { goal: p.characters[0].currentGoal, title: p.characters[0].title, location: p.locations[0] };
  });
  await probe('F04', '删除地点不处理人物位置与其他地点的连接', () => {
    let p = book(); p.locations = [location('A'), { ...location('B'), connectedLocationIds: ['A'] }]; p.characters = [character('hero', 'A')];
    const ui = mountComponent(abs('frontend/components/WorldEditor.tsx'), 'WorldEditor', { project: p, onUpdateProject: x => p = x }); ui.click('地理与地点 (2)');
    const buttons = ui.nodes().filter(n => n.type === 'button' && !textOf(n)); assert.equal(buttons.length, 2); buttons[0].props.onClick();
    assert.equal(p.characters[0].currentLocationId, 'A'); assert.equal(p.locations[0].connectedLocationIds[0], 'A');
    return { remainingLocations: p.locations.map(x => x.id), danglingCharacterLocation: p.characters[0].currentLocationId, danglingConnection: p.locations[0].connectedLocationIds };
  });
  await probe('F05', '选中文本后续写会替换选中文字', async () => {
    let p = book(); p.chapters = [chapter(p, 'c1', '开头。选中的原文。结尾。')];
    const ui = mountComponent(abs('frontend/components/AuthorDeskEditor.tsx'), 'AuthorDeskEditor', { project: p, onUpdateProject: x => p = x, onOpenDocumentLibrary() {} }, {
      '../services/aiProviderService': { AIProviderService: { async generateText() { return '新增续写'; } } }, '../services/soundEffects': { soundEffects: { playChime() {}, playKeyClick() {} } },
    });
    const area = ui.nodes().find(n => n.type === 'textarea' && n.props.value === p.chapters[0].content); area.props.ref.current = { selectionStart: 3, selectionEnd: 9 };
    const button = ui.nodes().find(n => n.type === 'button' && /续写/.test(n.props['aria-label'] || textOf(n))); assert.ok(button); await button.props.onClick();
    assert.equal(p.chapters[0].content, '开头。新增续写结尾。');
    return { original: '开头。选中的原文。结尾。', result: p.chapters[0].content };
  });
  await probe('F06', '资料上传结束覆盖期间的新正文', async () => {
    let p = book(); p.chapters = [chapter(p)]; const gate = deferred(); let saved;
    const props = { project: p, onUpdateProject: x => saved = x, onClose() {} };
    const ui = mountComponent(abs('frontend/components/DocumentLibraryModal.tsx'), 'DocumentLibraryModal', props, { '../services/documentParserService': { DocumentParserService: { parseTxtFile: () => gate.promise } } });
    const input = ui.nodes().find(n => n.type === 'input' && n.props.type === 'file'); const pending = input.props.onChange({ target: { files: [{ name: 'ref.txt' }], value: 'ref.txt' } });
    p = { ...p, chapters: [{ ...p.chapters[0], content: '上传期间刚写的新正文' }] }; ui.replaceProps({ ...props, project: p });
    gate.resolve({ id: 'doc1', title: '资料', parsedChapters: [] }); await pending;
    assert.equal(saved.chapters[0].content, '原始正文');
    return { beforeCompletion: p.chapters[0].content, afterCompletion: saved.chapters[0].content };
  });
  await probe('F07', 'AI人物生成旧回调覆盖更新后的作品', () => {
    let p = book(), saved; p.chapters = [chapter(p)]; const props = { project: p, onUpdateProject: x => saved = x };
    const ui = mountComponent(abs('frontend/components/CharacterManager.tsx'), 'CharacterManager', props); ui.click('AI生成');
    const oldCallback = ui.nodes().find(n => n.props.onAddCharacter).props.onAddCharacter;
    p = { ...p, chapters: [{ ...p.chapters[0], content: 'AI等待期间的新正文' }] }; ui.replaceProps({ ...props, project: p }); oldCallback(character());
    assert.equal(saved.chapters[0].content, '原始正文');
    return { newerContent: p.chapters[0].content, committedContent: saved.chapters[0].content };
  });
  await probe('F08', '标准压缩EPUB导入后没有解出正文', async () => {
    const marker = '月球EPUB唯一正文标记';
    const bytes = zip([['mimetype', 'application/epub+zip', 0], ['META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'], ['OEBPS/content.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">audit</dc:identifier><dc:title>Audit</dc:title><dc:language>zh</dc:language></metadata><manifest><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'], ['OEBPS/chapter.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>${marker.repeat(50)}</p></body></html>`]]);
    const doc = await Parser.parseEpubFile(new File([bytes], 'audit.epub'));
    const content = doc.parsedChapters.map(x => x.content).join('\n'); assert.ok(!content.includes(marker));
    return { validZipSignature: bytes.subarray(0, 4).toString('hex'), originalTextPresent: false, decodedPrefix: content.slice(0, 60), format: doc.format };
  });
  await probe('F09', '常见中文带标题章节与Markdown标题不能正确分章', async () => {
    const txt = await Parser.parseTxtFile(new File(['第一章 初见\n正文甲\n第二章 再见\n正文乙'], 'novel.txt'));
    const md = await Parser.parseTxtFile(new File(['# 第一章\n正文甲\n# 第二章\n正文乙'], 'novel.md'));
    assert.equal(txt.parsedChapters.length, 1); assert.equal(md.parsedChapters.length, 1); assert.equal(md.format, 'txt');
    return { chineseChapterCount: txt.parsedChapters.length, markdownChapterCount: md.parsedChapters.length, markdownFormat: md.format };
  });
  await probe('F10', 'PDF记录只保存临时blobURL，备份不包含原文件', async () => {
    const pdf = new File(['%PDF-1.4\nAUDIT_PDF_SOURCE_BYTES\n%%EOF'], 'audit.pdf', { type: 'application/pdf' });
    const doc = await Parser.parsePdfFile(pdf), serialized = JSON.stringify(doc);
    assert.ok(doc.fileBlobUrl.startsWith('blob:')); assert.ok(!serialized.includes('AUDIT_PDF_SOURCE_BYTES')); URL.revokeObjectURL(doc.fileBlobUrl);
    return { persistedFields: Object.keys(doc), fileBytesIncluded: false, parsedTextIsPlaceholder: doc.parsedChapters[0].content.includes('PDF 文件已载入') };
  });
  await probe('F11', '剧情灵感在AI失败时返回旧作品提案且不报告失败', async () => {
    const service = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText() { throw new Error('AUDIT_NETWORK_ERROR'); } } } })('frontend/services/chaosTwistService.ts').ChaosTwistService;
    const result = await service.rollChaosTwists(book(), '月球科研站断电'); assert.equal(result.length, 3); assert.match(JSON.stringify(result), /听雨居|裴子期/);
    return { rejected: false, firstTitle: result[0].title, firstIncident: result[0].suggestedIncident };
  });
  await probe('F12', '剧情灵感不校验元素结构，合法JSON数组可令渲染抛错', async () => {
    const service = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText() { return '[{"title":"提案"}]'; } } } })('frontend/services/chaosTwistService.ts').ChaosTwistService;
    const ui = mountComponent(abs('frontend/components/ChaosOracleModal.tsx'), 'ChaosOracleModal', { project: book(), onClose() {}, onApplyTwist() {} }, { './../services/chaosTwistService': { ChaosTwistService: service } });
    await ui.click('生成剧情提案'); assert.throws(() => ui.render(), /join/); return { modelResponse: '[{"title":"提案"}]', renderError: 'affectedEntities.join on undefined' };
  });
  await probe('F13', '单章生成没有读取前章正文、提炼摘要及人物已知秘密', async () => {
    const calls = []; const marker = 'ONLY_PREVIOUS_CHAPTER_SECRET_731'; const extraction = 'ONLY_SUMMARY_MEMORY_842', fact = 'ONLY_CHARACTER_KNOWLEDGE_953';
    const p = book(); p.chapters = [{ ...chapter(p, 'c1', marker), extraction: { chapterSummary: extraction, keyStateChanges: [], newLoreLearned: [], tensionScore: 40 } }]; p.characters = [{ ...character(), knownFacts: [{ id: 'fact', fact, learnedAtTime: '', confidence: 1 }] }];
    const engine = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText(config, opts) { calls.push(opts); return calls.length === 1 ? 'TITLE: 新章\nSUMMARY: 新梗概\nACT1: 起\nACT2: 承\nACT3: 转\nACT4: 合' : '正文'.repeat(600); } } } })('frontend/services/chapterExpansionEngine.ts').ChapterExpansionEngine;
    await engine.generateDeepChapter({ project: p, chapterNumber: 2, volumeNumber: 1, events: [] });
    const payloads = JSON.stringify(calls); for (const m of [marker, extraction, fact]) assert.ok(!payloads.includes(m));
    return { aiRequests: calls.length, previousTextIncluded: false, extractionIncluded: false, characterKnownFactIncluded: false };
  });
  await probe('F14', '共写建议不包含书籍简介、正文及世界硬规则', async () => {
    let options; const p = book(); p.authorNote = 'ONLY_PREMISE_111'; p.rules = [{ id: 'rule', category: 'natural', rule: 'ONLY_RULE_222', consequenceOfViolation: '' }]; p.chapters = [chapter(p, 'c1', 'ONLY_CONTENT_333')];
    const service = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText(config, opts) { options = opts; return '1. 建议'; } } } })('frontend/services/geminiService.ts').GeminiService;
    await service.coWriteSuggestions(p, '下一步'); for (const m of ['ONLY_PREMISE_111', 'ONLY_RULE_222', 'ONLY_CONTENT_333']) assert.ok(!options.prompt.includes(m));
    return { synopsisIncluded: false, rulesIncluded: false, manuscriptIncluded: false };
  });
  await probe('F15', '因果审计将死者生前的历史参与记录判为错误', async () => {
    const p = book(); p.timeStepIndex = 10; p.characters = [{ ...character(), isAlive: false }]; p.events = [event('past', 'hero', 1)];
    const service = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText() { return 'ALL_CONSISTENT'; } } } })('frontend/services/geminiService.ts').GeminiService;
    const issues = await service.auditConsistency(p); assert.ok(issues.some(x => x.title === '已故角色仍然产生事件'));
    return { historicalEventStep: 1, currentStep: 10, issues: issues.map(x => ({ title: x.title, suggestedFix: x.suggestedFix })) };
  });
  await probe('F16', '世界快照回滚不还原地点且留下失效章节事件引用', () => {
    const store = loader({ 'frontend/services/indexedDbService.ts': { IndexedDbService: { async saveProjectData() {} } } }, { localStorage: { getItem: () => null, setItem() {} } })('frontend/services/storageService.ts').storageService;
    store.saveProject = () => {};
    let p = book(); p.locations = [location('old')]; p.characters = [character('hero', 'old')]; p = store.createSnapshot(p, '起点', '');
    p = { ...p, locations: [location('new')], timeStepIndex: 1, events: [event('future', 'hero')], chapters: [{ ...chapter(p), associatedEventIds: ['future'] }] };
    p = store.restoreSnapshot(p, p.snapshots[0].id); assert.equal(p.characters[0].currentLocationId, 'old'); assert.equal(p.locations[0].id, 'new'); assert.equal(p.events.length, 0); assert.equal(p.chapters[0].associatedEventIds[0], 'future');
    return { restoredCharacterLocation: 'old', worldLocations: ['new'], events: 0, danglingChapterEvent: 'future' };
  });
  await probe('F17', '同地点三人时第三人永远不行动也不恢复健康', () => {
    let p = book(); p.locations = [location()]; p.characters = [character('a'), character('b'), character('c')];
    for (let i = 0; i < 5; i++) p = SimulationEngine.stepTime(p, 4).updatedProject;
    assert.ok(p.events.every(e => !e.participantIds.includes('c'))); assert.equal(p.characters[2].knownFacts.length, 0); assert.equal(p.characters[2].health, 50);
    return { steps: 5, eventParticipants: p.events.map(e => e.participantIds), thirdCharacter: { health: 50, knownFacts: 0 } };
  });
  await probe('F18', '人物健康可越界，AI返回0会被默认值替换', async () => {
    let p = book(); p.characters = [character()];
    const ui = mountComponent(abs('frontend/components/CharacterManager.tsx'), 'CharacterManager', { project: p, onUpdateProject: x => p = x });
    edit(ui, n => n.type === 'input' && n.props.type === 'number' && n.props.value === 50, '-999'); assert.equal(p.characters[0].health, -999);
    let generated;
    const gen = mountComponent(abs('frontend/components/CharacterCardGeneratorModal.tsx'), 'CharacterCardGeneratorModal', { project: p, onAddCharacter: c => generated = c, onClose() {} }, { '../services/aiProviderService': { AIProviderService: { async generateText() { return '{"name":"零值人物","health":0,"wealth":0,"age":0}'; } } } }, { alert() {} });
    await gen.click('生成完整人物档案'); assert.equal(generated.health, 90); assert.equal(generated.wealth, 20); assert.equal(generated.age, 30);
    return { manualHealth: p.characters[0].health, aiZerosBecame: { health: generated.health, wealth: generated.wealth, age: generated.age } };
  });
  await probe('F19', '备份校验接受重复章节ID、非法状态和失效引用', () => {
    const { parseProjectBackup } = load('frontend/services/backupValidation.ts'); const p = book();
    p.chapters = [chapter(p, 'same'), { ...chapter(p, 'same'), status: 'INVALID_STATUS', chapterNumber: -10 }]; p.characters = [character('hero', 'missing')];
    const parsed = parseProjectBackup(JSON.stringify(p)); assert.equal(parsed.chapters.length, 2); assert.equal(parsed.chapters[1].status, 'INVALID_STATUS');
    return { duplicateIds: parsed.chapters.map(x => x.id), acceptedStatus: parsed.chapters[1].status, acceptedChapterNumber: parsed.chapters[1].chapterNumber, danglingLocation: parsed.characters[0].currentLocationId };
  });
  await probe('F20', '部分AI工具强制温度且忽略开启的作者附注', async () => {
    const calls = [], p = book(); p.aiConfig.sampling.temperature = 0.13; p.aiConfig.authorsNote = { enabled: true, content: 'ONLY_AUTHORS_NOTE', insertionDepth: 1 };
    const service = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText(config, options) { calls.push(options); return '1. 建议'; } } } })('frontend/services/geminiService.ts').GeminiService;
    await service.coWriteSuggestions(p, '继续'); assert.equal(calls[0].overrideSampling.temperature, 0.7); assert.ok(!JSON.stringify(calls[0]).includes('ONLY_AUTHORS_NOTE'));
    return { configuredTemperature: 0.13, toolOverride: 0.7, enabledNoteForwarded: false };
  });
  await probe('F21', '修改正文后旧提炼摘要和叙事张力继续保留', () => {
    const p = book(); p.chapters = [{ ...chapter(p), extraction: { chapterSummary: '旧内容摘要', keyStateChanges: [], newLoreLearned: [], tensionScore: 99 }, tensionScore: 99, status: 'final' }];
    const next = updateWritingContent(p, p.chapters[0].id, '彻底重写后的另一个故事', 'now'); assert.equal(next.chapters[0].extraction.chapterSummary, '旧内容摘要'); assert.equal(next.chapters[0].status, 'final');
    return { newContent: next.chapters[0].content, staleSummary: next.chapters[0].extraction.chapterSummary, staleTension: next.chapters[0].tensionScore, retainedStatus: next.chapters[0].status };
  });
  await probe('F22', '流水线停止只丢弃结果，没有传递取消信号', async () => {
    const gate = deferred(); let captured; const p = book();
    const ui = mountComponent(abs('frontend/components/NovelEditor.tsx'), 'NovelEditor', { project: p, onUpdateProject() {}, onOpenAISettings() {}, pipelineMode: 'AUTO_NOVEL', onPipelineModeChange() {} }, {
      '../services/geminiService': { GeminiService: { generateChapter(options) { captured = options; return gate.promise; } } }, '../services/storageService': { storageService: {} }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' },
    });
    const task = ui.click('连跑 3 章 (约1.2万字)'); ui.click('停止任务'); assert.equal(captured.signal, undefined); assert.match(ui.text(), /当前请求结束后将丢弃结果/);
    gate.resolve({ title: '稿', outline: '纲', content: '文', activatedLorebookKeys: [] }); await task;
    return { signalPassed: false, message: '当前请求结束后将丢弃结果', resultDiscarded: true };
  });
  await probe('F23', '资料AI考据切换文献后将旧答案显示在新文献中', async () => {
    const gate = deferred(), p = book(); p.referenceDocs = [{ id: 'd1', title: '资料甲', parsedChapters: [{ id: 'a', title: '甲章', content: '甲内容' }] }, { id: 'd2', title: '资料乙', parsedChapters: [{ id: 'b', title: '乙章', content: '乙内容' }] }];
    const ui = mountComponent(abs('frontend/components/DocumentLibraryModal.tsx'), 'DocumentLibraryModal', { project: p, onUpdateProject() {}, onClose() {} }, { '../services/aiProviderService': { AIProviderService: { generateText: () => gate.promise } } });
    const tab = ui.nodes().find(n => n.type === 'button' && textOf(n).includes('AI') && !n.props.disabled); tab.props.onClick(); ui.render();
    const probeButton = ui.button('开始探针提炼'); const pending = probeButton.props.onClick();
    const other = ui.nodes().find(n => n.type === 'button' && textOf(n).includes('资料乙')); assert.ok(other); other.props.onClick(); ui.render();
    gate.resolve('这是只属于资料甲的答案'); await pending; ui.render(); assert.match(ui.text(), /这是只属于资料甲的答案/);
    return { selectedDocument: '资料乙', displayedAnswer: '这是只属于资料甲的答案' };
  });
  await probe('F24', '批量TXT导入的毫秒ID可能重复', async () => {
    const docs = []; for (let i = 0; i < 50; i++) docs.push(await Parser.parseTxtFile(new File(['短文'], `doc${i}.txt`)));
    const unique = new Set(docs.map(x => x.id)).size; assert.ok(unique < docs.length); return { imported: docs.length, uniqueIds: unique, duplicates: docs.length - unique };
  });
  await probe('F25', '内置部署帮助仍提供不存在的Python/PostgreSQL后端', () => {
    const ui = mountComponent(abs('frontend/components/AboutSystemModal.tsx'), 'AboutSystemModal', { onClose() {} }); ui.click('ARM 服务器与 Docker 部署'); assert.match(ui.text(), /python:3\.12-slim/); assert.match(ui.text(), /postgres/);
    return { uiBackendImage: 'python:3.12-slim', actualBackend: 'Node backend/server.js', uiDatabase: 'PostgreSQL', actualProjectStore: 'browser IndexedDB/localStorage' };
  });
  await probe('F26', '新书世界名与文风缺少配置入口且生成篇幅目标固定4000', async () => {
    const calls = [], p = book(); p.settings.chapterLengthTarget = 200;
    const engine = loader({ 'frontend/services/aiProviderService.ts': { AIProviderService: { async generateText(config, options) { calls.push(options); return calls.length === 1 ? 'TITLE: 短章\nSUMMARY: 梗概\nACT1: 起\nACT2: 承\nACT3: 转\nACT4: 合' : '正文'.repeat(5); } } } })('frontend/services/chapterExpansionEngine.ts').ChapterExpansionEngine;
    await engine.generateDeepChapter({ project: p, chapterNumber: 1, volumeNumber: 1, events: [] }); assert.ok(calls.length === 6); assert.match(calls[1].prompt, /1000~1200/); assert.ok(!calls[1].prompt.includes(' 200 汉字'));
    const world = mountComponent(abs('frontend/components/WorldEditor.tsx'), 'WorldEditor', { project: p, onUpdateProject() {} }); assert.equal(p.worldName, '');
    return { configuredChapterTarget: 200, act1Target: '1000~1200', requestsIncludingExtension: calls.length, blankWorldName: p.worldName, worldPageInitialInputValues: world.nodes().filter(n => ['input', 'textarea'].includes(n.type)).map(n => n.props.value) };
  });
  await probe('F27', '每日写作进度没有按日期重置', () => {
    const p = book(); p.chapters = [chapter(p, 'c1', '昨天正文')]; p.deskSettings = { currentSessionWords: 5000, targetDailyWords: 6000 };
    const next = updateWritingContent(p, 'c1', '昨天正文今天新增', '2026-11-09T00:01:00Z'); assert.equal(next.deskSettings.currentSessionWords, 5004);
    return { storedWordCount: 5000, nextDayNewCharacters: 4, displayedCounter: next.deskSettings.currentSessionWords, dateFieldExists: Object.keys(next.deskSettings).some(k => /date|day|reset/i.test(k) && k !== 'targetDailyWords') };
  });
  await probe('F28', 'AI人物字段未校验，可写入无法再次还原的作品', async () => {
    const p = book(); let generated;
    const ui = mountComponent(abs('frontend/components/CharacterCardGeneratorModal.tsx'), 'CharacterCardGeneratorModal', { project: p, onAddCharacter: x => generated = x, onClose() {} }, { '../services/aiProviderService': { AIProviderService: { async generateText() { return '{"name":"字段错误人物","age":"二十","inventory":[{"name":"钥匙"}]}'; } } } }, { alert() {} });
    await ui.click('生成完整人物档案'); assert.equal(generated.age, '二十');
    p.characters = [generated]; const { parseProjectBackup } = load('frontend/services/backupValidation.ts'); assert.throws(() => parseProjectBackup(JSON.stringify(p)), /characters\[0\]\.age/);
    return { committedAgeType: typeof generated.age, committedInventoryElementType: typeof generated.inventory[0], reopeningValidation: 'rejects project.characters[0].age' };
  });
  await probe('F29', '切换文献后摘录原文被归档到错误的来源', () => {
    const p = book(); let saved; p.referenceDocs = [{ id: 'd1', title: '资料甲', parsedChapters: [{ id: 'a', title: '甲章', content: '甲的独有摘录' }] }, { id: 'd2', title: '资料乙', parsedChapters: [{ id: 'b', title: '乙章', content: '乙内容' }] }];
    const ui = mountComponent(abs('frontend/components/DocumentLibraryModal.tsx'), 'DocumentLibraryModal', { project: p, onUpdateProject: x => saved = x, onClose() {} }, {}, { window: { getSelection: () => ({ toString: () => '甲的独有摘录' }) }, alert() {} });
    ui.nodes().find(n => n.props.onMouseUp).props.onMouseUp(); ui.render();
    ui.nodes().find(n => n.type === 'button' && textOf(n).includes('资料乙')).props.onClick(); ui.render(); ui.click('存入卡片盒');
    const card = saved.referenceDocs[1].excerpts[0]; assert.equal(card.docTitle, '资料乙'); assert.equal(card.selectedText, '甲的独有摘录');
    return { realSource: '资料甲/甲章', savedSource: `${card.docTitle}/${card.chapterTitle}`, selectedText: card.selectedText };
  });
  await probe('F30', '纯享写作的对照素材仅显示文献第一章，PDF也只显示占位说明', () => {
    const p = book(); p.referenceDocs = [{ id: 'd1', title: '参考书', format: 'txt', parsedChapters: [{ id: 'a', title: '第一章', content: '素材第一章' }, { id: 'b', title: '第二章', content: '素材第二章独有正文' }] }];
    const ui = mountComponent(abs('frontend/components/AuthorDeskEditor.tsx'), 'AuthorDeskEditor', { project: p, onUpdateProject() {}, onOpenDocumentLibrary() {} }, { '../services/soundEffects': { soundEffects: {} } }); ui.click('对照素材');
    assert.match(ui.text(), /素材第一章/); assert.ok(!ui.text().includes('素材第二章独有正文')); assert.equal(ui.nodes().filter(n => n.type === 'select').length, 1);
    const pdf = { ...p, referenceDocs: [{ id: 'd1', title: 'PDF', format: 'pdf', fileBlobUrl: 'blob:audit', parsedChapters: [{ id: 'p', title: 'PDF', content: '【PDF 文件已载入双屏参考视窗】' }] }] }; ui.replaceProps({ project: pdf, onUpdateProject() {}, onOpenDocumentLibrary() {} });
    assert.match(ui.text(), /PDF 文件已载入/); assert.equal(ui.nodes().filter(n => n.type === 'iframe').length, 0);
    return { chapterSelectorCount: 0, secondChapterReachable: false, pdfViewerCount: 0 };
  });
  await check('P01', '空白书创建与备份结构有效，不继承旧正文', () => {
    const p = book(); const parsed = load('frontend/services/backupValidation.ts').parseProjectBackup(JSON.stringify(p));
    assert.equal(parsed.chapters.length, 0); assert.equal(parsed.characters.length, 0); assert.equal(parsed.title, '月球考古'); return { title: parsed.title, chapters: 0, characters: 0 };
  });
  await check('P02', '纯享写作新建输入和偏好更新', () => {
    let p = book(); const props = { project: p, onUpdateProject: x => p = x, onOpenDocumentLibrary() {} }; const ui = mountComponent(abs('frontend/components/AuthorDeskEditor.tsx'), 'AuthorDeskEditor', props, { '../services/soundEffects': { soundEffects: { playKeyClick() {} } } });
    const create = ui.nodes().find(n => n.type === 'button' && /第一章/.test(textOf(n))); assert.ok(create); create.props.onClick(); ui.replaceProps({ ...props, project: p });
    assert.equal(p.chapters.length, 1); const area = ui.nodes().find(n => n.type === 'textarea' && !n.props.readOnly); area.props.onChange({ target: { value: '完全属于新作品的正文' } }); ui.replaceProps({ ...props, project: p });
    assert.equal(p.chapters[0].content, '完全属于新作品的正文'); ui.click('放大正文字号'); assert.equal(p.deskSettings.fontSize, 19);
    return { chapters: 1, wordCount: p.chapters[0].wordCount, fontSize: p.deskSettings.fontSize };
  });
  await check('P03', '阅读器章节翻页、主题和字号处理函数', () => {
    const p = book(); p.chapters = [chapter(p, 'a', '阅读第一章'), chapter(p, 'b', '阅读第二章', 2)]; const ui = mountComponent(abs('frontend/components/ReaderView.tsx'), 'ReaderView', { project: p });
    assert.equal(ui.button('上一章').props.disabled, true); ui.click('下一章'); assert.match(ui.text(), /阅读第二章/); assert.equal(ui.button('下一章').props.disabled, true); ui.click('明亮');
    assert.equal(ui.nodes().find(n => n.props['aria-label'] === '作品阅读器').props['data-reading-theme'], 'light'); ui.click('放大阅读字号'); assert.equal(ui.nodes().find(n => n.props.className?.includes('reader-prose')).props.style.fontSize, 20);
    return { navigation: 'first -> second', theme: 'light', fontSize: 20 };
  });
  await check('P04', '世界书常驻、开关、主次关键词与排序', () => {
    const { LorebookService } = load('frontend/services/lorebookService.ts'); const e = { id: 'e', name: '月球', keys: ['月球'], secondaryKeys: ['基地'], enabled: true, isConstant: false, insertionOrder: 9, scanDepth: 1000, content: '低重力' };
    assert.equal(LorebookService.scanAndActivate([e], ['月球']).activated.length, 0); assert.equal(LorebookService.scanAndActivate([e], ['月球基地']).activated.length, 1); assert.equal(LorebookService.scanAndActivate([{ ...e, enabled: false }], ['月球基地']).activated.length, 0);
    const hits = LorebookService.scanAndActivate([e, { ...e, id: 'constant', isConstant: true, insertionOrder: 1 }], ['月球基地']).activated; assert.equal(hits[0].id, 'constant'); return { primarySecondary: 'both required', disabledExcluded: true, ordering: hits.map(x => x.id) };
  });
  await check('P05', '世界法则添加、伏笔录入与回收切换', () => {
    let p = book(); const props = { project: p, onUpdateProject: x => p = x }; const ui = mountComponent(abs('frontend/components/WorldEditor.tsx'), 'WorldEditor', props);
    edit(ui, n => n.type === 'textarea' && n.props.placeholder?.includes('青溟石'), '月面重力六分之一'); ui.click('录入世界法则'); assert.equal(p.rules[0].rule, '月面重力六分之一'); ui.replaceProps({ ...props, project: p }); ui.click('伏笔追踪 (0)');
    edit(ui, n => n.type === 'input' && n.props.value === '', '失联信号'); ui.click('录入伏笔库'); ui.replaceProps({ ...props, project: p }); ui.click('埋设潜伏中'); assert.equal(p.foreshadowing[0].isResolved, true); return { ruleCount: p.rules.length, clueResolved: true };
  });
  await check('P06', '模拟单人休息与双人财富转移确实修改状态', () => {
    let p = book(); p.locations = [location()]; p.characters = [character()]; const rest = SimulationEngine.stepTime(p, 4); assert.equal(rest.updatedProject.characters[0].health, 60); assert.equal(rest.newEvents[0].eventType, 'rest');
    p.characters = [{ ...character('a'), relationships: { b: '照顾' } }, character('b')]; const social = SimulationEngine.stepTime(p, 4); assert.equal(social.updatedProject.characters[0].wealth, 8); assert.equal(social.updatedProject.characters[1].wealth, 12); return { restHealth: 60, socialWealth: [8, 12], timeAdvanced: rest.updatedProject.currentSimulationTime };
  });
  await check('P07', '同一世界内简单快照可恢复时钟和人物', () => {
    const store = loader({ 'frontend/services/indexedDbService.ts': { IndexedDbService: {} } })('frontend/services/storageService.ts').storageService; store.saveProject = () => {};
    let p = book(); p.characters = [character()]; p = store.createSnapshot(p, '基线', ''); const id = p.snapshots[0].id; p = { ...p, timeStepIndex: 3, characters: [{ ...p.characters[0], health: 10 }] }; const restored = store.restoreSnapshot(p, id); assert.equal(restored.timeStepIndex, 0); assert.equal(restored.characters[0].health, 50); return { timeStep: 0, health: 50 };
  });
  await check('P08', '叙事分析缺失评分留空，已有评分计算平均值', () => {
    const p = book(); p.chapters = [chapter(p, 'a'), { ...chapter(p, 'b'), tensionScore: 80 }]; const ui = mountComponent(abs('frontend/components/NarrativeAnalyticsModal.tsx'), 'NarrativeAnalyticsModal', { project: p, onClose() {} }); assert.match(ui.text(), /80 \/ 100 · 1 章已评分/); return { scoredChapters: 1, averageTension: 80 };
  });
  const report = { testedCommit: 'df5eebca99f9eb9ebb96ae341653bb49d932e551', testedAt: new Date().toISOString(), method: 'real TS/TSX handlers and services; synthetic projects; mocked AI and storage boundaries; no browser interaction', results: records };
  fs.writeFileSync(path.join(__dirname, 'functional-audit-2026-11-08.results.json'), JSON.stringify(report, null, 2) + '\n');
  for (const r of records) console.log(`${r.status}: ${r.id} ${r.name}${r.error ? '\n' + r.error : ''}`);
  console.log(JSON.stringify({ total: records.length, reproduced: records.filter(r => r.status === 'reproduced').length, verified: records.filter(r => r.status === 'verified').length, probeFailed: records.filter(r => r.status === 'probe_failed').length }));
  if (records.some(r => r.status === 'probe_failed')) process.exitCode = 1;
})();
