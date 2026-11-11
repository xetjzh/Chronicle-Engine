const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const React = require('react');
const { transform } = require('sucrase');

const makeProject = () => ({
  id: 'book', title: '当前作品', chapters: [],
  aiConfig: {
    activeProvider: 'openai_compatible', activePreset: 'custom',
    sampling: { temperature: 1, topP: 1, topK: 60, repetitionPenalty: 1, frequencyPenalty: 0, presencePenalty: 0, maxTokens: 5000, stopSequences: ['结束'] },
    authorsNote: { enabled: false, content: '自己的附注', insertionDepth: 3 },
    gemini: { model: 'gemini-custom', thinkingBudget: 100 },
    ollama: { baseUrl: 'http://localhost:11434', model: 'local-custom', contextLength: 4096, keepAlive: '10m' },
    openaiCompatible: { baseUrl: 'https://example.test/v1', apiKey: 'test-only', model: 'remote-custom', customHeaders: { 'X-Project': 'book' } },
  },
});

// Run the real component and its handlers. Replace only React's mounting hooks
// (there is no DOM in Node) and the external connection-test boundary.
function mount(project = makeProject(), testProviderHealth = async () => ({ ok: true, provider: 'gemini', message: '连接成功' })) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let root;
  let saved;
  let closed = false;
  const hooks = {
    ...React,
    useId: () => 'ai-settings-title',
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] || (slots[index] = { current: initial });
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = effects[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        previous?.cleanup?.();
        effects[index] = { dependencies, cleanup: effect() };
      }
    },
  };
  const filename = path.join(__dirname, 'AISettingsModal.tsx');
  const output = transform(fs.readFileSync(filename, 'utf8'), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic' }).code;
  const module = { exports: {} };
  const evaluate = vm.runInNewContext(`(function(require, module, exports) { ${output}\n})`, { AbortController }, { filename });
  evaluate(specifier => {
    if (specifier === 'react') return hooks;
    if (specifier === './Dialog') return { Dialog: 'dialog' };
    if (specifier === '../services/aiProviderService') return { AIProviderService: { testProviderHealth } };
    return require(specifier);
  }, module, module.exports);
  const render = () => {
    cursor = 0;
    root = module.exports.AISettingsModal({ project, onUpdateProject: value => { saved = value; }, onClose: () => { closed = true; } });
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
    const buttons = nodes().filter(node => node.type === 'button');
    const exact = buttons.filter(node => content(node) === label);
    const matches = exact.length ? exact : buttons.filter(node => content(node).includes(label));
    assert.equal(matches.length, 1, `Expected one button containing ${label}`);
    return matches[0];
  };
  render();
  return {
    button,
    click(label) { const result = button(label).props.onClick(); render(); return result; },
    change(label, value) {
      const input = nodes().find(node => node.props['aria-label'] === label);
      assert.ok(input, `Missing input ${label}`);
      input.props.onChange({ target: { value } });
      render();
    },
    toggle(label, checked) {
      const input = nodes().find(node => node.props['aria-label'] === label);
      assert.ok(input); input.props.onChange({ target: { checked } }); render();
    },
    render, text: () => content(root),
    readInput: label => nodes().find(node => node.props['aria-label'] === label)?.props.value,
    unmount: () => effects.forEach(effect => effect?.cleanup?.()),
    replaceProject(value) { project = value; render(); },
    get saved() { return saved; }, get closed() { return closed; },
  };
}

const choices = [
  ['古典文学', 'sillytavern_literary', 'openai_compatible', 0.85, 3500],
  ['Ollama 本地写作', 'ollama_arm_efficient', 'ollama', 0.68, 2000],
  ['DeepSeek 逻辑推演', 'deepseek_causality', 'openai_compatible', 0.6, 4000],
  ['Gemini 长篇起草', 'gemini_epic', 'gemini', 0.8, 4000],
];

test('server relay choice is used by connection tests, saved, and retained after reopening', async () => {
  let tested;
  const modal = mount(makeProject(), async (_provider, config) => { tested = config; return { ok:true, provider:'openai_compatible', message:'通过' }; });
  modal.toggle('通过本服务转发兼容接口', true);
  assert.match(modal.text(), /密钥将经过当前部署服务器/);
  await modal.click('测试连通性'); assert.equal(tested.openaiCompatible.useServerProxy, true);
  modal.click('保存设置'); assert.equal(modal.saved.aiConfig.openaiCompatible.useServerProxy, true);
  const reopened = mount(modal.saved); reopened.toggle('通过本服务转发兼容接口', false); reopened.click('保存设置');
  assert.equal(reopened.saved.aiConfig.openaiCompatible.useServerProxy, false);
});

test('each preset can be selected, saved, and shown as selected after reopening', () => {
  const original = makeProject();
  const modal = mount(original);
  modal.click('调优预设方案');
  for (const [label, preset, provider, temperature, maxTokens] of choices) {
    modal.click(label);
    assert.equal(modal.button(label).props['aria-pressed'], true);
    assert.match(modal.text(), /已选择/);
    for (const [other] of choices) if (other !== label) assert.equal(modal.button(other).props['aria-pressed'], false);
    modal.click('保存设置');
    assert.equal(modal.saved.aiConfig.activePreset, preset);
    assert.equal(modal.saved.aiConfig.activeProvider, provider);
    assert.equal(modal.saved.aiConfig.sampling.temperature, temperature);
    assert.equal(modal.saved.aiConfig.sampling.maxTokens, maxTokens);
    assert.equal(modal.saved.aiConfig.authorsNote.enabled, true);
    assert.deepEqual(Array.from(modal.saved.aiConfig.sampling.stopSequences), ['结束']);
    assert.deepEqual(modal.saved.aiConfig.openaiCompatible, original.aiConfig.openaiCompatible);
    assert.equal(modal.saved.aiConfig.gemini.model, 'gemini-custom');
    assert.equal(modal.saved.aiConfig.ollama.model, 'local-custom');
    assert.equal(original.aiConfig.sampling.temperature, 1);
    const reopened = mount(modal.saved);
    reopened.click('调优预设方案');
    assert.equal(reopened.button(label).props['aria-pressed'], true);
  }
});

test('manual sampling and author-note changes save as custom and clear preset selection', () => {
  for (const [tab, input, value] of [
    ['生成参数', '采样温度', '0.95'],
    ['作者附注 (', '作者附注内容', '自己的写作要求'],
  ]) {
    const modal = mount();
    modal.click('调优预设方案');
    modal.click('古典文学');
    modal.click(tab);
    modal.change(input, value);
    modal.click('保存设置');
    assert.equal(modal.saved.aiConfig.activePreset, 'custom');
    modal.click('调优预设方案');
    for (const [label] of choices) assert.equal(modal.button(label).props['aria-pressed'], false);
    assert.match(modal.text(), /自定义/);
  }
});

test('the DeepSeek preset preserves the configured model and connection credentials', () => {
  const project = makeProject();
  const modal = mount(project);
  modal.click('调优预设方案');
  modal.click('DeepSeek 逻辑推演');
  modal.click('保存设置');
  assert.deepEqual(modal.saved.aiConfig.openaiCompatible, project.aiConfig.openaiCompatible);
});

test('saving uses the latest project so unrelated edits survive an open settings modal', () => {
  const project = makeProject();
  const modal = mount(project);
  modal.click('调优预设方案');
  modal.click('古典文学');
  modal.replaceProject({ ...project, title: '更新后的作品名' });
  modal.click('保存设置');
  assert.equal(modal.saved.title, '更新后的作品名');
  assert.equal(modal.saved.aiConfig.activePreset, 'sillytavern_literary');
});

test('cancelling the modal leaves the original configuration untouched', () => {
  const project = makeProject();
  const modal = mount(project);
  modal.click('调优预设方案');
  modal.click('DeepSeek 逻辑推演');
  modal.click('取消');
  assert.equal(modal.saved, undefined);
  assert.equal(modal.closed, true);
  assert.equal(project.aiConfig.activePreset, 'custom');
  assert.equal(project.aiConfig.openaiCompatible.model, 'remote-custom');
});

test('a cancelled connection test cannot replace the result or loading state of a newer test', async () => {
  const requests = [];
  const modal = mount(makeProject(), (provider, config, signal) => new Promise(resolve => { requests.push({ provider, config, signal, resolve }); }));
  const first = modal.click('测试连通性');
  assert.ok(modal.button('测试中').props.disabled);
  modal.click('取消测试');
  assert.equal(requests[0].signal.aborted, true);
  const second = modal.click('测试连通性');
  requests[0].resolve({ provider: 'openai_compatible', ok: false, message: '过期的失败结果' });
  await first;
  modal.render();
  assert.doesNotMatch(modal.text(), /过期的失败结果/);
  assert.ok(modal.button('测试中').props.disabled);
  requests[1].resolve({ provider: 'openai_compatible', ok: true, message: '新的连接成功' });
  await second;
  modal.render();
  assert.match(modal.text(), /新的连接成功/);
  assert.equal(modal.button('测试连通性').props.disabled, false);
});

test('editing a connection, switching provider, closing, and unmounting abort pending tests', async () => {
  for (const action of [
    modal => modal.change('兼容接口服务地址', 'https://new.example.test/v1'),
    modal => modal.click('Google Gemini API'),
    modal => { modal.click('调优预设方案'); modal.click('古典文学'); },
    modal => modal.click('取消'),
    modal => modal.unmount(),
  ]) {
    let signal;
    let finish;
    const modal = mount(makeProject(), (_provider, _config, requestSignal) => {
      signal = requestSignal;
      return new Promise(resolve => { finish = resolve; });
    });
    const pending = modal.click('测试连通性');
    action(modal);
    assert.equal(signal?.aborted, true);
    finish({ provider: 'openai_compatible', ok: true, message: '过期的连接成功' });
    await pending;
    modal.render();
    assert.doesNotMatch(modal.text(), /过期的连接成功/);
  }
});

test('unexpected connection-test errors appear in the dialog and leave retry available', async () => {
  const modal = mount(makeProject(), async () => { throw new Error('端点连接超时'); });
  await modal.click('测试连通性');
  modal.render();
  assert.match(modal.text(), /端点连接超时/);
  assert.equal(modal.button('测试连通性').props.disabled, false);
});

test('the Gemini model can be edited and saved without resetting other connection settings', () => {
  const project = makeProject();
  const modal = mount(project);
  modal.click('Google Gemini API');
  assert.equal(modal.readInput('Gemini 模型名称'), 'gemini-custom');
  modal.change('Gemini 模型名称', 'gemini-other');
  modal.click('保存设置');
  assert.equal(modal.saved.aiConfig.gemini.model, 'gemini-other');
  assert.equal(modal.saved.aiConfig.gemini.thinkingBudget, 100);
  assert.deepEqual(modal.saved.aiConfig.openaiCompatible, project.aiConfig.openaiCompatible);
});
