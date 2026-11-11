const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const React = require('react');
const { transform } = require('sucrase');

const chapter = (id, title, content, chapterNumber) => ({
  id, title, content, chapterNumber, volumeNumber: 1, outline: '',
  wordCount: content.length, associatedEventIds: [], status: 'draft', createdAt: 'old', updatedAt: 'old',
});
const makeProject = () => ({
  id: 'book', title: '作品',
  chapters: [chapter('one', '第一章', '第一章正文', 1), chapter('two', '第二章', '第二章正文', 2), chapter('three', '第三章', '第三章正文', 3)],
  events: [{ id: 'event', description: '保留的世界事件' }],
  deskSettings: { soundEnabled: false }, aiConfig: { activeProvider: 'openai_compatible' },
});

// Exercise the real component, state transitions, and event handlers in Node.
// Only mounting hooks, the portal, and external AI/audio boundaries are replaced;
// browser layout, focus management, and pointer interaction still require UI QA.
function mount(project = makeProject(), generateText = async () => '生成正文') {
  const slots = [];
  const effects = [];
  let pendingEffects = [];
  let cursor = 0;
  let root;
  let dirty = false;
  const commits = [];
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(slots[index], next)) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = effects[index];
      if (!previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]))) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const filename = path.join(__dirname, 'AuthorDeskEditor.tsx');
  const output = transform(fs.readFileSync(filename, 'utf8'), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic' }).code;
  const module = { exports: {} };
  const evaluate = vm.runInNewContext(`(function(require, module, exports) { ${output}\n})`, { AbortController, crypto: require('node:crypto') }, { filename });
  evaluate(specifier => {
    if (specifier === 'react') return hooks;
    if (specifier === './Dialog') return { Dialog: 'dialog' };
    if (specifier === './PdfDocumentViewer') return { PdfDocumentViewer: 'pdf-viewer' };
    if (specifier === './listWindow') return require('./listWindow.ts');
    if (specifier === './writingWorkspace') return require('./writingWorkspace.ts');
    if (specifier === '../services/aiProviderService') return { AIProviderService: { generateText } };
    if (specifier === '../services/soundEffects') return { soundEffects: { playKeyClick() {}, playChime() {} } };
    return require(specifier);
  }, module, module.exports);
  const render = () => {
    let renders = 0;
    do {
      assert.ok(renders++ < 10, 'Component must settle after state/effect updates');
      dirty = false;
      cursor = 0;
      pendingEffects = [];
      root = module.exports.AuthorDeskEditor({ project, onUpdateProject: updated => { commits.push(updated); project = updated; }, onOpenDocumentLibrary() {} });
      pendingEffects.forEach(effect => effect());
    } while (dirty);
  };
  const nodes = () => {
    const found = [];
    const visit = value => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object') return;
      if (value.props) { found.push(value); visit(value.props.children); }
    };
    visit(root);
    return found;
  };
  const content = value => Array.isArray(value) ? value.map(content).join('') : value?.props ? content(value.props.children) : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const button = label => {
    const matches = nodes().filter(node => node.type === 'button' && (node.props['aria-label'] === label || content(node) === label));
    assert.equal(matches.length, 1, `Expected one button named ${label}`);
    return matches[0];
  };
  render();
  return {
    button,
    click(label) { const result = button(label).props.onClick(); render(); return result; },
    selectChapter(title) {
      const selected = nodes().find(node => node.type === 'button' && content(node).includes(title) && !node.props['aria-label']);
      assert.ok(selected, `Missing chapter ${title}`);
      selected.props.onClick(); render();
    },
    render, text: () => content(root),
    input: label => nodes().find(node => node.props['aria-label'] === label || node.props.id === label)?.props.value,
    dialog: () => nodes().find(node => node.type === 'dialog'),
    replaceProject(value) { project = value; render(); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
    get project() { return project; }, get commits() { return commits; },
  };
}

test('opening deletion then cancelling or closing the confirmation preserves every chapter', () => {
  for (const close of [desk => desk.click('取消'), desk => { desk.dialog().props.onClose(); desk.render(); }]) {
    const project = makeProject();
    const desk = mount(project);
    desk.click('删除章节：第一章');
    assert.ok(desk.dialog());
    assert.equal(desk.commits.length, 0);
    assert.equal(desk.input('章节正文'), '第一章正文');
    close(desk);
    assert.equal(desk.dialog(), undefined);
    assert.strictEqual(desk.project, project);
    assert.deepEqual(project.chapters.map(item => item.id), ['one', 'two', 'three']);
  }
});

test('confirmation removes the selected chapter, selects its next neighbor, and preserves newer unrelated edits', () => {
  const project = makeProject();
  const desk = mount(project);
  desk.selectChapter('第二章');
  desk.click('删除章节：第二章');
  desk.replaceProject({ ...project, title: '等待确认时的新作品名', chapters: [project.chapters[0], project.chapters[1], { ...project.chapters[2], content: '第三章的新正文' }] });
  desk.click('确认删除');
  assert.equal(desk.commits.length, 1);
  assert.deepEqual(desk.project.chapters.map(item => item.id), ['one', 'three']);
  assert.equal(desk.input('章节正文'), '第三章的新正文');
  assert.equal(desk.project.title, '等待确认时的新作品名');
  assert.strictEqual(desk.project.events, project.events);
  assert.equal(desk.dialog(), undefined);
});

test('deleting a nonselected chapter keeps the current writing selection', () => {
  const desk = mount();
  desk.selectChapter('第二章');
  desk.click('删除章节：第一章');
  desk.click('确认删除');
  assert.deepEqual(desk.project.chapters.map(item => item.id), ['two', 'three']);
  assert.equal(desk.input('章节正文'), '第二章正文');
});

test('deleting the final chapter opens the empty state and its create-first-chapter action works', () => {
  const project = makeProject();
  const desk = mount({ ...project, chapters: [project.chapters[0]] });
  desk.click('删除章节：第一章');
  desk.click('确认删除');
  assert.deepEqual(desk.project.chapters, []);
  assert.equal(desk.input('章节正文'), undefined);
  desk.click('创建第一章');
  assert.equal(desk.project.chapters.length, 1);
  assert.equal(desk.project.chapters[0].chapterNumber, 1);
  assert.equal(desk.input('章节正文'), '');
});

test('switching projects dismisses confirmation and a stale confirm callback cannot delete the new chapter', () => {
  const desk = mount();
  desk.click('删除章节：第一章');
  const staleConfirm = desk.button('确认删除').props.onClick;
  const replacement = { ...makeProject(), id: 'new-book', title: '新作品' };
  desk.replaceProject(replacement);
  assert.equal(desk.dialog(), undefined);
  staleConfirm(); desk.render();
  assert.equal(desk.commits.length, 0);
  assert.strictEqual(desk.project, replacement);
  assert.equal(desk.project.chapters[0].content, '第一章正文');
});

test('returning to a previous project does not reopen its old deletion confirmation', () => {
  const project = makeProject();
  const desk = mount(project);
  desk.click('删除章节：第一章');
  desk.replaceProject({ ...makeProject(), id: 'new-book' });
  desk.replaceProject(project);
  assert.equal(desk.dialog(), undefined);
  assert.equal(desk.commits.length, 0);
});

test('stopping generation aborts its signal and its late result cannot overwrite a newer generation', async () => {
  const requests = [];
  const desk = mount(makeProject(), (_config, options) => new Promise(resolve => { requests.push({ ...options, resolve }); }));
  const first = desk.click('润色');
  desk.click('停止生成');
  assert.equal(requests[0].signal?.aborted, true);
  assert.equal(desk.input('章节正文'), '第一章正文');
  assert.equal(desk.button('润色').props.disabled, false);
  const second = desk.click('续写');
  requests[0].resolve('旧的生成文字');
  await first; desk.render();
  assert.equal(desk.button('润色').props.disabled, true);
  assert.doesNotMatch(desk.text(), /旧的生成文字/);
  assert.equal(desk.commits.length, 0);
  requests[1].resolve('新的续写正文');
  await second; desk.render();
  assert.equal(desk.input('章节正文'), '第一章正文\n\n新的续写正文');
  assert.equal(desk.commits.length, 1);
  assert.equal(desk.button('润色').props.disabled, false);
});

test('cancelling deletion preserves generation, while confirming deletion aborts it and rejects late output', async () => {
  let request;
  const desk = mount(makeProject(), (_config, options) => new Promise(resolve => { request = { ...options, resolve }; }));
  const pending = desk.click('润色');
  desk.click('删除章节：第一章');
  desk.click('取消');
  assert.equal(request.signal?.aborted, false);
  desk.click('删除章节：第一章');
  desk.click('确认删除');
  assert.equal(request.signal?.aborted, true);
  request.resolve('迟到的正文');
  await pending; desk.render();
  assert.deepEqual(desk.project.chapters.map(item => item.id), ['two', 'three']);
  assert.equal(desk.input('章节正文'), '第二章正文');
  assert.equal(desk.commits.length, 1);
  assert.doesNotMatch(desk.text(), /迟到的正文/);
});

test('deleting another chapter lets generation finish without resurrecting the removed chapter', async () => {
  let request;
  const desk = mount(makeProject(), (_config, options) => new Promise(resolve => { request = { ...options, resolve }; }));
  const pending = desk.click('润色');
  desk.click('删除章节：第二章');
  desk.click('确认删除');
  assert.equal(request.signal?.aborted, false);
  request.resolve('润色后的第一章正文');
  await pending; desk.render();
  assert.deepEqual(desk.project.chapters.map(item => item.id), ['one', 'three']);
  assert.equal(desk.input('章节正文'), '润色后的第一章正文');
  assert.equal(desk.commits.length, 2);
});

test('project switching and unmounting abort pending generation and reject its late output', async () => {
  for (const action of ['switch', 'unmount']) {
    let request;
    const desk = mount(makeProject(), (_config, options) => new Promise(resolve => { request = { ...options, resolve }; }));
    const pending = desk.click('润色');
    if (action === 'switch') desk.replaceProject({ ...makeProject(), id: 'new-book' });
    else desk.unmount();
    assert.equal(request.signal?.aborted, true, action);
    request.resolve('旧作品的生成文字');
    await pending; desk.render();
    assert.equal(desk.commits.length, 0, action);
    assert.doesNotMatch(desk.text(), /旧作品的生成文字/);
  }
});

test('polish and continuation pass the enabled author note and keep configured sampling', async () => {
  for (const action of ['润色', '续写']) {
    const project = makeProject();
    project.aiConfig = {
      ...project.aiConfig,
      sampling: { temperature: 0.42, topP: 0.8, maxTokens: 1500 },
      authorsNote: { enabled: true, content: '保持现代悬疑文风，使用克制的第一人称叙述。', insertionDepth: 3 },
    };
    let captured;
    const desk = mount(project, async (config, options) => { captured = { config, options }; return '生成正文'; });
    await desk.click(action);
    assert.strictEqual(captured.config, project.aiConfig);
    assert.equal(captured.config.sampling.temperature, 0.42);
    assert.equal(captured.options.authorsNote, '保持现代悬疑文风，使用克制的第一人称叙述。');
    assert.equal(captured.options.overrideSampling?.temperature, undefined);
    assert.match(captured.options.prompt, /第一章正文/);
    assert.ok(captured.options.signal instanceof AbortSignal);
  }
});

test('a disabled author note is omitted and generation does not force a different temperature', async () => {
  const project = makeProject();
  project.aiConfig = {
    ...project.aiConfig,
    sampling: { temperature: 0.61 },
    authorsNote: { enabled: false, content: '未启用的文风要求', insertionDepth: 3 },
  };
  let captured;
  const desk = mount(project, async (config, options) => { captured = { config, options }; return '生成正文'; });
  await desk.click('润色');
  assert.equal(captured.options.authorsNote, undefined);
  assert.equal(captured.options.overrideSampling?.temperature, undefined);
  assert.equal(captured.config.sampling.temperature, 0.61);
  assert.equal(project.aiConfig.authorsNote.content, '未启用的文风要求');
});
