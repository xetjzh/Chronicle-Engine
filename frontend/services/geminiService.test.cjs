const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transform } = require('sucrase');

// Exercise the real service, expansion engine and lorebook logic. Only the
// remote AI text boundary is replaced so these tests need no credentials.
function service(generateText) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const output = transform(fs.readFileSync(filename, 'utf8'), { transforms: ['typescript', 'imports'] }).code;
    const evaluate = vm.runInNewContext(`(function(require, module, exports) { ${output}\n})`, {
      console: { warn() {}, error() {} },
    }, { filename });
    evaluate(specifier => specifier === './aiProviderService'
      ? { AIProviderService: { generateText } }
      : load(path.resolve(path.dirname(filename), `${specifier}.ts`)), module, module.exports);
    return module.exports;
  }
  const { initialProject } = load(path.join(__dirname, 'demoWorld.ts'));
  const project = structuredClone(initialProject);
  return {
    ...load(path.join(__dirname, 'geminiService.ts')),
    ...load(path.join(__dirname, 'recursiveSummaryEngine.ts')),
    project,
  };
}

function chapterParams(project) {
  return { project, volumeNumber: 1, chapterNumber: 2, events: project.events, povCharacterId: project.characters[0].id };
}

test('a blank new book uses its own premise and selected AI settings throughout the chapter pipeline', async () => {
  const calls = [];
  const { createEmptyProject } = require('./projectFactory.ts');
  const book = createEmptyProject('new-book', { title: '星际来信', genre: '科幻', premise: '船员寻找失联飞船' });
  book.aiConfig.sampling.temperature = 0.37;
  book.aiConfig.authorsNote = { enabled: true, content: '使用简洁的现代科幻叙述', insertionDepth: 1 };
  const { GeminiService } = service(async (config, options) => {
    calls.push({ config, options });
    return calls.length === 1 ? 'TITLE: 信号\nSUMMARY: 寻找飞船\nACT1: 出发\nACT2: 搜索\nACT3: 发现\nACT4: 决定' : '星'.repeat(1100);
  });
  await GeminiService.generateChapter({ project: book, volumeNumber: 1, chapterNumber: 1, events: [] });
  assert.match(calls[0].options.prompt, /船员寻找失联飞船/);
  assert.match(calls[0].options.prompt, /科幻/);
  assert.doesNotMatch(calls[0].options.prompt, /undefined|古朴典雅/);
  for (const { config, options } of calls) {
    assert.equal(config.sampling.temperature, 0.37);
    assert.equal(options.authorsNote, '使用简洁的现代科幻叙述');
    assert.equal(options.overrideSampling?.temperature, undefined);
  }
});

test('pipeline extension respects the new book and malformed outlines cannot substitute the old sample story', async () => {
  const { createEmptyProject } = require('./projectFactory.ts');
  const book = createEmptyProject('new', { title: '太空调查', genre: '科幻', premise: '寻找无人探测器' });
  book.aiConfig.authorsNote = { enabled: true, content: '现代科幻语气', insertionDepth: 1 };
  let calls = 0;
  const { GeminiService } = service(async (_config, options) => {
    calls++;
    assert.doesNotMatch(options.prompt, /听雨居|黑石城|寒关|寒江|undefined/);
    assert.equal(options.authorsNote, '现代科幻语气');
    return calls === 1 ? 'TITLE: 探测器\nSUMMARY: 找到信号\nACT1: 起航\nACT2: 调查\nACT3: 发现\nACT4: 抉择' : '星'.repeat(calls === 6 ? 1400 : 750);
  });
  await GeminiService.generateChapter({ project: book, volumeNumber: 1, chapterNumber: 1, events: [] });
  assert.equal(calls, 6);
  let incompleteCalls = 0;
  const invalid = service(async () => { incompleteCalls++; return 'TITLE: 只有一个标题'; });
  await assert.rejects(invalid.GeminiService.generateChapter({ project: book, volumeNumber: 1, chapterNumber: 1, events: [] }), /大纲.*不完整/);
  assert.equal(incompleteCalls, 1);
});

test('chapter generation rejects an AI failure instead of returning a fixed story', async () => {
  const { GeminiService, project } = service(async () => { throw new Error('模型连接超时'); });
  await assert.rejects(GeminiService.generateChapter(chapterParams(project)), /模型连接超时/);
});

test('chapter generation rejects empty AI output instead of saving an empty chapter', async () => {
  const { GeminiService, project } = service(async () => '   ');
  await assert.rejects(GeminiService.generateChapter(chapterParams(project)), /生成.*空|没有.*正文|正文.*空/);
});

test('successful generation preserves real expanded text and activated lorebook keys', async () => {
  const responses = [
    'TITLE: 山中来信\nSUMMARY: 收到来信。\nACT1: 拆信\nACT2: 商议\nACT3: 启程\nACT4: 回望',
    '甲'.repeat(1100), '乙'.repeat(1100), '丙'.repeat(1100), '丁'.repeat(1100),
  ];
  const { GeminiService, project } = service(async () => responses.shift());
  project.lorebook = [{ id: 'lore', name: '书房设定', keys: [], content: '书房临山', isConstant: true, enabled: true, insertionOrder: 1, scanDepth: 3 }];
  const result = await GeminiService.generateChapter(chapterParams(project));
  assert.equal(result.title, '山中来信');
  assert.equal(result.outline, '收到来信。');
  assert.equal(result.content, `${'甲'.repeat(1100)}\n\n${'乙'.repeat(1100)}\n\n${'丙'.repeat(1100)}\n\n${'丁'.repeat(1100)}`);
  assert.deepEqual(Array.from(result.activatedLorebookKeys), ['[常驻] 书房设定']);
});

test('audit failure cannot be reported as a consistent world', async () => {
  const { GeminiService, project } = service(async () => { throw new Error('审计模型不可用'); });
  project.events = [];
  project.characters = [];
  await assert.rejects(GeminiService.auditConsistency(project), /审计模型不可用/);
});

test('empty or incomplete audit answers require retry', async () => {
  for (const response of ['', '   ', 'OK']) {
    const { GeminiService, project } = service(async () => response);
    project.events = [];
    project.characters = [];
    await assert.rejects(GeminiService.auditConsistency(project), /审计.*重试|审计.*完整/);
  }
});

test('only an exact all-consistent response can produce the all-clear audit result', async () => {
  const { GeminiService, project } = service(async () => 'ALL_CONSISTENT，但第三章人物违背世界规则，需要修订。');
  project.events = [];
  project.characters = [];
  const issues = await GeminiService.auditConsistency(project);
  assert.equal(issues.some(issue => issue.id === 'iss_ok'), false);
  assert.equal(issues[0].severity, 'warning');
});

test('a completed audit can report no issues when the model explicitly confirms consistency', async () => {
  const { GeminiService, project } = service(async () => '  ALL_CONSISTENT\n');
  project.events = [];
  project.characters = [];
  const issues = await GeminiService.auditConsistency(project);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, 'iss_ok');
});

test('deterministic audit findings remain visible after a successful AI audit', async () => {
  const { GeminiService, project } = service(async () => 'ALL_CONSISTENT');
  project.characters[0].isAlive = false;
  project.characters[0].diedAtTimeStep = 0;
  project.events = project.events.map(event => ({ ...event, timeStepIndex: 1 }));
  const issues = await GeminiService.auditConsistency(project);
  assert.equal(issues.some(issue => issue.title === '已故角色仍然产生事件'), true);
  assert.equal(issues.some(issue => issue.id === 'iss_ok'), false);
});

test('writing suggestions reject provider errors instead of inventing fixed character stories', async () => {
  const { GeminiService, project } = service(async () => { throw new Error('建议生成失败'); });
  await assert.rejects(GeminiService.coWriteSuggestions(project, '下一步'), /建议生成失败/);
});

test('empty writing suggestions require retry', async () => {
  const { GeminiService, project } = service(async () => '\n  ');
  await assert.rejects(GeminiService.coWriteSuggestions(project, '下一步'), /建议.*空|建议.*重试/);
});

test('writing suggestions preserve actual model suggestions', async () => {
  const { GeminiService, project } = service(async () => '1. 拆开来信\n2. 前往山中\n3. 留守书房');
  assert.deepEqual(Array.from(await GeminiService.coWriteSuggestions(project, '下一步')), ['1. 拆开来信', '2. 前往山中', '3. 留守书房']);
});

test('summary extraction rejects an AI failure instead of inventing facts and tension', async () => {
  const { RecursiveSummaryEngine, project } = service(async () => { throw new Error('摘要模型不可用'); });
  await assert.rejects(RecursiveSummaryEngine.extractAndCompressChapter(project, project.chapters[0]), /摘要模型不可用/);
});

test('summary extraction rejects invalid JSON instead of silently substituting an outline', async () => {
  const { RecursiveSummaryEngine, project } = service(async () => '无法生成合法 JSON');
  await assert.rejects(RecursiveSummaryEngine.extractAndCompressChapter(project, project.chapters[0]), /摘要.*JSON.*重试/);
});

test('summary extraction requires factual summary, string lists and a finite score', async () => {
  const valid = { chapterSummary: '信件抵达书房。', keyStateChanges: [], newLoreLearned: [], tensionScore: 75 };
  for (const response of [
    {}, null, { ...valid, chapterSummary: '' }, { ...valid, keyStateChanges: [3] },
    { ...valid, newLoreLearned: '新事实' }, { ...valid, tensionScore: '高' },
  ]) {
    const { RecursiveSummaryEngine, project } = service(async () => JSON.stringify(response));
    await assert.rejects(RecursiveSummaryEngine.extractAndCompressChapter(project, project.chapters[0]), /摘要.*完整|摘要.*格式/);
  }
});

test('summary extraction preserves legitimate facts and a zero tension score', async () => {
  const response = { chapterSummary: '信件抵达书房。', keyStateChanges: ['收到来信'], newLoreLearned: ['书房临山'], tensionScore: 0 };
  const { RecursiveSummaryEngine, project } = service(async () => `\`\`\`json\n${JSON.stringify(response)}\n\`\`\``);
  const extraction = await RecursiveSummaryEngine.extractAndCompressChapter(project, project.chapters[0]);
  assert.equal(extraction.chapterSummary, '信件抵达书房。');
  assert.deepEqual(Array.from(extraction.keyStateChanges), ['收到来信']);
  assert.deepEqual(Array.from(extraction.newLoreLearned), ['书房临山']);
  assert.equal(extraction.tensionScore, 0);
});
