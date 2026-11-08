const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mountComponent } = require('./testSupport/mountComponent.cjs');
const { createEmptyProject } = require('./services/projectFactory.ts');
function mount(activate = async () => {}) {
  const old = createEmptyProject('old', { title: '旧书' });
  const ui = mountComponent(path.join(__dirname, 'App.tsx'), 'default', {}, {
    './services/storageService': { storageService: { loadProjectAsync: async () => old, activateProjectAsync: activate, saveProjectAsync: async () => {} } },
    './components/ProjectLibraryModal': { ProjectLibraryModal: 'book-library' },
    './components/AuthorDeskEditor': { AuthorDeskEditor: 'author-desk' },
  }, { window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {}, setTimeout: () => 1, clearTimeout() {} }, document: { querySelector: () => null } });
  return ui;
}
test('app activates an independently saved book and rejects stale updates from the old editor', async () => {
  const transitions = [];
  const ui = mount(async (...args) => transitions.push(args));
  await ui.flush();
  const oldEditor = ui.nodes().find(n => n.type === 'author-desk');
  ui.click('新建作品');
  const library = ui.nodes().find(n => n.type === 'book-library');
  const next = createEmptyProject('new', { title: '新书' });
  await library.props.onActivate(next, 'CO_WRITING');
  ui.render();
  assert.equal(transitions[0][0].id, 'old');
  assert.equal(transitions[0][1].id, 'new');
  assert.equal(ui.nodes().find(n => n.type === 'author-desk').props.project.id, 'new');
  oldEditor.props.onUpdateProject({ ...transitions[0][0], title: '过期异步结果' });
  ui.render();
  assert.match(ui.text(), /新书/);
  assert.doesNotMatch(ui.text(), /过期异步结果/);
});
test('failed book transition retains the active manuscript and A/B/C entries navigate without running AI', async () => {
  const ui = mount(async () => { throw new Error('磁盘已满'); });
  await ui.flush();
  ui.click('新建作品');
  await assert.rejects(ui.nodes().find(n => n.type === 'book-library').props.onActivate(createEmptyProject('new')), /磁盘/);
  ui.render();
  assert.equal(ui.nodes().find(n => n.type === 'author-desk').props.project.id, 'old');
  ui.click('模式 A · 自动成书');
  assert.equal(ui.nodes().find(n => n.props.onOpenAISettings).props.pipelineMode, 'AUTO_NOVEL');
  ui.click('模式 B · 人机共写');
  assert.equal(ui.nodes().find(n => n.props.onOpenAISettings).props.pipelineMode, 'CO_WRITING');
  ui.click('模式 C · 世界模拟');
  assert.ok(ui.nodes().find(n => n.props.onJumpToWriting));
});

test('importing another book backup creates a separate copy rather than overwriting an existing book ID', async () => {
  const transitions = [];
  const ui = mount(async (...args) => transitions.push(args));
  await ui.flush();
  const backup = createEmptyProject('another-existing-book', { title: '导入作品' });
  const input = ui.nodes().find(n => n.props['aria-label'] === '选择项目备份');
  await input.props.onChange({ target: { files: [{ text: async () => JSON.stringify(backup) }], value: 'backup.json' } });
  ui.render();
  assert.equal(transitions[0][0].id, 'old');
  assert.notEqual(transitions[0][1].id, 'another-existing-book');
  assert.equal(transitions[0][1].title, '导入作品');
});
