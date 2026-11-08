const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mountComponent } = require('../testSupport/mountComponent.cjs');
const { createEmptyProject } = require('../services/projectFactory.ts');
const project = () => createEmptyProject('book', { title: '新作品' });

test('pipeline renders the current preset/config and separates A batch from B single-chapter actions', () => {
  let book = project();
  const props = { project: book, onUpdateProject() {}, onOpenAISettings() {}, pipelineMode: 'CO_WRITING', onPipelineModeChange() {} };
  const ui = mountComponent(path.join(__dirname, 'NovelEditor.tsx'), 'NovelEditor', props, {
    '../services/geminiService': { GeminiService: {} },
    '../services/recursiveSummaryEngine': { RecursiveSummaryEngine: {} },
    './ChaosOracleModal': { ChaosOracleModal: 'chaos' },
  });
  assert.ok(ui.nodes().find(n => n.props.config === book.aiConfig), 'pipeline must bind the live project configuration');
  assert.ok(!ui.text().includes('连跑 3 章'));
  ui.replaceProps({ ...props, pipelineMode: 'AUTO_NOVEL' });
  assert.match(ui.text(), /连跑 3 章/);
  assert.equal(ui.button('连跑 3 章 (约1.2万字)').props.disabled, true, 'empty book needs a story premise before paid batch');
  book = { ...book, authorNote: '寻找失联的飞船', aiConfig: { ...book.aiConfig, activePreset: 'deepseek_causality' } };
  ui.replaceProps({ ...props, project: book, pipelineMode: 'AUTO_NOVEL' });
  assert.equal(ui.button('连跑 3 章 (约1.2万字)').props.disabled, false);
  assert.ok(ui.nodes().find(n => n.props.config === book.aiConfig));
});

test('configuration summary updates immediately with model, sampling and enabled note', () => {
  const book = project();
  const file = path.join(__dirname, 'AIConfigSummary.tsx');
  const ui = mountComponent(file, 'AIConfigSummary', { config: book.aiConfig, onEdit() {}, running: false });
  assert.match(ui.text(), /自定义/);
  const config = { ...book.aiConfig, activePreset: 'deepseek_causality', activeProvider: 'openai_compatible',
    sampling: { ...book.aiConfig.sampling, temperature: 0.6, maxTokens: 4000 }, authorsNote: { enabled: true, content: '因果逻辑优先', insertionDepth: 1 } };
  ui.replaceProps({ config, onEdit() {}, running: true });
  assert.match(ui.text(), /DeepSeek 逻辑推演/);
  assert.match(ui.text(), /deepseek-chat/);
  assert.match(ui.text(), /0.6/);
  assert.match(ui.text(), /4000/);
  assert.match(ui.text(), /因果逻辑优先/);
  assert.match(ui.text(), /启动时/);
});

test('Mode A uses the entered story instructions when they are the only seed for a new book', async () => {
  const calls = [];
  const book = project();
  const ui = mountComponent(path.join(__dirname, 'NovelEditor.tsx'), 'NovelEditor', {
    project: book, onUpdateProject() {}, onOpenAISettings() {}, pipelineMode: 'AUTO_NOVEL', onPipelineModeChange() {},
  }, {
    '../services/geminiService': { GeminiService: { async generateChapter(params) { calls.push(params); return { title: '考古', outline: '发现城市', content: '月球考古', activatedLorebookKeys: [] }; } } },
    '../services/recursiveSummaryEngine': { RecursiveSummaryEngine: {} }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' },
  });
  const instruction = ui.nodes().find(n => n.type === 'textarea' && n.props.value === '');
  instruction.props.onChange({ target: { value: '月球考古发现被掩埋的城市' } }); ui.render();
  await ui.click('连跑 3 章 (约1.2万字)');
  assert.equal(calls.length, 3);
  for (const call of calls) assert.match(call.userConstraint, /月球考古发现被掩埋的城市/);
});

test('Mode B offers a direct first-chapter action and creates an empty draft for the new book', () => {
  let saved;
  const ui = mountComponent(path.join(__dirname, 'NovelEditor.tsx'), 'NovelEditor', {
    project: project(), onUpdateProject(next) { saved = next; }, onOpenAISettings() {}, pipelineMode: 'CO_WRITING', onPipelineModeChange() {},
  }, { '../services/geminiService': { GeminiService: {} }, '../services/recursiveSummaryEngine': { RecursiveSummaryEngine: {} }, './ChaosOracleModal': { ChaosOracleModal: 'chaos' } });
  ui.click('新建第一章');
  assert.equal(saved.id, 'book');
  assert.equal(saved.chapters.length, 1);
  assert.equal(saved.chapters[0].content, '');
  assert.equal(saved.chapters[0].outline, '');
  assert.equal(saved.chapters[0].wordCount, 0);
});

test('world simulation honestly reports paused/running and its timer actually advances the latest world', () => {
  let book = project();
  book.locations = [{ id: 'home', name: '空间站', type: 'city', connectedLocationIds: [] }];
  book.characters = [{ id: 'hero', name: '林', currentLocationId: 'home', isAlive: true, health: 50, knownFacts: [], relationships: {} }];
  let tick, cleared = 0;
  const props = { project: book, onUpdateProject(next) { book = next; }, onJumpToWriting() {} };
  const ui = mountComponent(path.join(__dirname, 'WorldSimConsole.tsx'), 'WorldSimConsole', props, {}, {
    window: { setInterval(fn) { tick = fn; return 1; } }, clearInterval() { cleared++; }, setTimeout: () => 1, clearTimeout() {},
  });
  assert.match(ui.text(), /已暂停/);
  assert.match(ui.text(), /本地规则/);
  assert.doesNotMatch(ui.text(), /当前推理源/);
  ui.click('开启无人值守演进');
  assert.match(ui.text(), /运行中/);
  tick();
  assert.equal(book.timeStepIndex, 1);
  assert.equal(book.characters[0].health, 60);
  assert.equal(book.events.length, 1);
  ui.replaceProps({ ...props, project: book });
  tick();
  assert.equal(book.timeStepIndex, 2);
  ui.click('暂停自动模拟');
  assert.match(ui.text(), /已暂停/);
  assert.ok(cleared > 0);
  ui.unmount();
});
