import type { ProjectData } from '../types';

type Schema = 'string' | 'number' | 'boolean' | 'record' | { [key: string]: Schema } | [Schema];
const strings: Schema = ['string'];
const character: Schema = {
  'relationshipScores?': { __recordOf: { affection: 'number', trust: 'number' } },
  'travelDestinationId?': 'string',
  'travel?': { destinationId: 'string', route: strings, remainingHours: 'number' },
  'diedAtTimeStep?': 'number',
  id: 'string', name: 'string', title: 'string', age: 'number', gender: 'string', factionId: 'string',
  currentLocationId: 'string', occupation: 'string', appearance: 'string', personality: 'string',
  coreDesire: 'string', greatestFear: 'string', currentMood: 'string', moralityAlignment: 'string',
  health: 'number', wealth: 'number', inventory: strings, currentGoal: 'string', relationships: 'record',
  knownFacts: [{ id: 'string', fact: 'string', learnedAtTime: 'string', confidence: 'number' }], isAlive: 'boolean',
};
const schema: Schema = {
  'recoveryWarnings?': strings,
  id: 'string', title: 'string', genre: 'string', authorNote: 'string', worldName: 'string',
  currentSimulationTime: 'string', timeStepIndex: 'number',
  chapters: [{ id: 'string', title: 'string', content: 'string', outline: 'string', wordCount: 'number',
    chapterNumber: 'number', volumeNumber: 'number', associatedEventIds: strings, createdAt: 'string', updatedAt: 'string', status: 'string',
    'povCharacterId?': 'string', 'tensionScore?': 'number',
    'generationCheckpoint?': { version: 'number', signature: 'string', title: 'string', outline: 'string', tasks: strings, userConstraint: 'string', 'editorInstruction?': 'string', beats: [{ actIndex: 'number', actName: 'string', outline: 'string', content: 'string', wordCount: 'number' }] },
    'actBeats?': [{ actIndex: 'number', actName: 'string', outline: 'string', content: 'string', wordCount: 'number' }],
    'extraction?': { chapterSummary: 'string', keyStateChanges: strings, newLoreLearned: strings, tensionScore: 'number' } }],
  characters: [character],
  locations: [{ id: 'string', name: 'string', type: 'string', description: 'string', connectedLocationIds: strings, climateOrDanger: 'string' }],
  factions: [{ id: 'string', name: 'string', ideology: 'string', powerLevel: 'number', allies: strings, enemies: strings }],
  rules: [{ id: 'string', category: 'string', rule: 'string', consequenceOfViolation: 'string' }],
  events: [{ id: 'string', simulationTime: 'string', timeStepIndex: 'number', eventType: 'string', locationId: 'string',
    participantIds: strings, causeEventIds: strings, title: 'string', description: 'string', consequences: strings,
    stateChanges: [{ characterId: 'string', field: 'string' }], visibility: { isPublic: 'boolean', knownByCharacterIds: strings }, confirmed: 'boolean' }],
  lorebook: [{ id: 'string', name: 'string', keys: strings, 'secondaryKeys?': strings, content: 'string', isConstant: 'boolean', enabled: 'boolean', insertionOrder: 'number', scanDepth: 'number', 'comment?': 'string' }],
  snapshots: [{ id: 'string', snapshotName: 'string', simulationTime: 'string', timeStepIndex: 'number', createdAt: 'string', characters: [character], eventsCount: 'number', description: 'string' }],
  foreshadowing: [{ id: 'string', title: 'string', plantedTime: 'string', relatedCharacterIds: strings, expectedResolution: 'string', isResolved: 'boolean', notes: 'string' }],
  referenceDocs: [{ id: 'string', title: 'string', fileName: 'string', format: 'string', sizeBytes: 'number', importedAt: 'string',
    parsedChapters: [{ id: 'string', title: 'string', content: 'string' }], 'tags?': strings, 'category?': 'string', 'fileBlobUrl?': 'string',
    'fileDataBase64?': 'string',
    'excerpts?': [{ id: 'string', docId: 'string', docTitle: 'string', chapterTitle: 'string', selectedText: 'string', userNote: 'string', tags: strings, createdAt: 'string' }] }],
  'volumes?': [{ volumeNumber: 'number', title: 'string', theme: 'string', summary: 'string', chapterCount: 'number' }],
  'deskSettings?': {
    'lastWritingDate?': 'string',
    'targetDailyWords?': 'number', 'currentSessionWords?': 'number', 'isZenMode?': 'boolean', 'typewriterMode?': 'boolean',
    'indentParagraphs?': 'boolean', 'theme?': 'string', 'fontSize?': 'number', 'lineHeight?': 'number',
    'fontFamily?': 'string', 'soundEnabled?': 'boolean', 'ambientMode?': 'string',
  },
  settings: { povPreference: 'string', literaryStyle: 'string', chapterLengthTarget: 'number', 'referenceRetrievalEnabled?': 'boolean' },
  aiConfig: {
    activeProvider: 'string', activePreset: 'string',
    gemini: { model: 'string', 'thinkingBudget?': 'number' }, ollama: { baseUrl: 'string', model: 'string', contextLength: 'number', keepAlive: 'string' },
    openaiCompatible: { baseUrl: 'string', apiKey: 'string', model: 'string', 'customHeaders?': 'record', 'useServerProxy?': 'boolean' },
    authorsNote: { enabled: 'boolean', content: 'string', insertionDepth: 'number' },
    sampling: { temperature: 'number', topP: 'number', topK: 'number', repetitionPenalty: 'number', frequencyPenalty: 'number', presencePenalty: 'number', maxTokens: 'number', stopSequences: strings },
  },
};

// New snapshots are self-contained; older snapshots remain readable.
const fields = schema as Record<string, Schema>;
(fields.locations as [Record<string, Schema>])[0]['travelHours?'] = 'number';
const snapshotFields = (fields.snapshots as [Record<string, Schema>])[0];
snapshotFields['events?'] = fields.events;
snapshotFields['worldState?'] = { worldName: 'string', locations: fields.locations, factions: fields.factions, rules: fields.rules, foreshadowing: fields.foreshadowing };

function validate(value: unknown, expected: Schema, path: string): void {
  const fail = () => { throw new Error(`备份数据不完整或格式错误：${path}`); };
  if (typeof expected === 'string') {
    if (expected === 'record') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(v => typeof v !== 'string')) fail();
    } else if (typeof value !== expected || (expected === 'number' && !Number.isFinite(value))) fail();
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(value)) return fail();
    value.forEach((item, i) => validate(item, expected[0], `${path}[${i}]`));
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  if ('__recordOf' in expected) {
    for (const [key, item] of Object.entries(value)) validate(item, expected.__recordOf, `${path}.${key}`);
    return;
  }
  for (const [key, child] of Object.entries(expected)) {
    const optional = key.endsWith('?');
    const field = optional ? key.slice(0, -1) : key;
    const fieldValue = (value as Record<string, unknown>)[field];
    if (optional && fieldValue === undefined) continue;
    validate(fieldValue, child, `${path}.${field}`);
  }
}

/** Reject incomplete imports before replacing the current manuscript. */
export function parseProjectBackup(raw: string): ProjectData {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('无法读取备份，请选择有效的 JSON 文件。'); }
  validate(value, schema, 'project');
  const project = value as ProjectData;
  if (!project.id.trim() || !['gemini', 'ollama', 'openai_compatible'].includes(project.aiConfig.activeProvider)) {
    throw new Error('备份的作品标识或模型提供商无效。');
  }
  validateAndRepair(project);
  return project;
}

function validateAndRepair(project: ProjectData): void {
  const fail = (path: string) => { throw new Error(`备份字段无效：${path}。请保留原备份并检查此字段。`); };
  const unique = (items: { id: string }[], path: string) => {
    const seen = new Set<string>();
    for (const item of items) { if (!item.id.trim() || seen.has(item.id)) throw new Error(`备份 ${path} 的标识为空或重复，必须唯一；原备份未被修改。`); seen.add(item.id); }
  };
  const range = (value: number, path: string, min = 0, max = Infinity, integer = false) => { if (value < min || value > max || (integer && !Number.isInteger(value))) fail(path); };
  const choice = (value: string, values: string[], path: string) => { if (!values.includes(value)) fail(path); };
  const warnings = new Set(project.recoveryWarnings || []);
  const warn = (message: string) => warnings.add(message);
  for (const key of ['chapters', 'characters', 'locations', 'factions', 'rules', 'events', 'lorebook', 'snapshots', 'foreshadowing'] as const) unique(project[key], key);
  // Historical document IDs used milliseconds; repair these without dropping a document.
  const docIds = new Set<string>();
  for (const doc of project.referenceDocs) {
    if (!doc.id.trim()) fail('referenceDocs.id');
    const original = doc.id; let suffix = 1;
    while (docIds.has(doc.id)) doc.id = `${original}_recovered_${suffix++}`;
    if (doc.id !== original) { for (const card of doc.excerpts || []) card.docId = doc.id; warn('旧文献有重复标识，已为各份资料分配独立标识并保留内容。'); }
    docIds.add(doc.id); unique(doc.parsedChapters, 'referenceDocs.parsedChapters'); unique(doc.excerpts || [], 'referenceDocs.excerpts');
    choice(doc.format, ['txt', 'md', 'pdf', 'epub'], 'referenceDocs.format'); range(doc.sizeBytes, 'referenceDocs.sizeBytes');
    if (doc.fileDataBase64 !== undefined && (!/^[A-Za-z0-9+/]*={0,2}$/.test(doc.fileDataBase64) || doc.fileDataBase64.length % 4 || doc.fileDataBase64.length > 27962028 || !doc.fileDataBase64.startsWith('JVBERi0'))) fail('referenceDocs.fileDataBase64');
    if (doc.format === 'pdf' && !doc.fileDataBase64) warn('有旧 PDF 只保留了临时地址，请在文献库重新关联原文件以便后续备份。');
  }
  range(project.timeStepIndex, 'timeStepIndex', 0, Infinity, true);
  const numbers = new Set<number>();
  for (const ch of project.chapters) {
    if (ch.generationCheckpoint) {
      const cp = ch.generationCheckpoint;
      if (cp.version !== 1 || !/^[a-f0-9]{1,8}$/.test(cp.signature) || cp.tasks.length !== 4 || cp.beats.length > 5 || cp.beats.some((beat, i) => beat.actIndex !== i + 1 || beat.wordCount < 0)) fail('chapters.generationCheckpoint');
    }
    choice(ch.status, ['draft', 'audited', 'final'], 'chapters.status'); range(ch.chapterNumber, 'chapters.chapterNumber', 1, Infinity, true); range(ch.volumeNumber, 'chapters.volumeNumber', 1, Infinity, true); range(ch.wordCount, 'chapters.wordCount');
    if (numbers.has(ch.chapterNumber)) fail('chapters.chapterNumber 重复'); numbers.add(ch.chapterNumber);
    if (ch.tensionScore !== undefined) range(ch.tensionScore, 'chapters.tensionScore', 0, 100);
    if (ch.extraction) range(ch.extraction.tensionScore, 'chapters.extraction.tensionScore', 0, 100);
  }
  choice(project.settings.literaryStyle, ['严肃文学', '古朴古典', '轻快细腻', '悬疑冷峻', '生活日常'], 'settings.literaryStyle');
  choice(project.settings.povPreference, ['第三人称有限视角', '第一人称', '第三人称全知视角', '多重视角轮转'], 'settings.povPreference');
  range(project.settings.chapterLengthTarget, 'settings.chapterLengthTarget', 100, 12000, true);
  const repair = (world: Pick<ProjectData, 'characters' | 'locations' | 'factions' | 'rules' | 'foreshadowing'>, events: ProjectData['events'], chapters: ProjectData['chapters'] = []) => {
    unique(world.characters, 'characters'); unique(world.locations, 'locations'); unique(world.factions, 'factions'); unique(world.rules, 'rules'); unique(world.foreshadowing, 'foreshadowing'); unique(events, 'events');
    const characters = new Set(world.characters.map(c => c.id)), locations = new Set(world.locations.map(l => l.id)), factions = new Set(world.factions.map(f => f.id)), eventIds = new Set(events.map(e => e.id));
    const ref = (value: string | undefined, ids: Set<string>, path: string) => { if (!value || ids.has(value)) return value || ''; warn(`${path} 引用了不存在的记录，已清除关联并保留原文，请重新确认。`); return ''; };
    const refs = (values: string[], ids: Set<string>, path: string) => values.map(value => ref(value, ids, path)).filter(Boolean);
    for (const c of world.characters) {
      if (c.relationshipScores) {
        for (const score of Object.values(c.relationshipScores)) { range(score.affection, 'characters.relationshipScores.affection', -100, 100); range(score.trust, 'characters.relationshipScores.trust', 0, 100); }
        c.relationshipScores = Object.fromEntries(Object.entries(c.relationshipScores).filter(([id]) => !!ref(id, characters, '人物关系分值')));
      }
      if (c.travelDestinationId) c.travelDestinationId = ref(c.travelDestinationId, locations, '旅行目的地') || undefined;
      if (c.travel) {
        range(c.travel.remainingHours, 'characters.travel.remainingHours', Number.EPSILON, 168);
        const path = [c.currentLocationId, ...c.travel.route];
        if (!c.travel.route.length || path[path.length - 1] !== c.travel.destinationId || path.some(id => !locations.has(id)) || path.slice(0, -1).some((id, i) => !world.locations.find(l => l.id === id)!.connectedLocationIds.includes(path[i + 1]))) {
          c.travel = undefined; warn('旅行路线已失效，已停止计划并保留人物最后到达位置。');
        }
      }
      range(c.age, 'characters.age'); range(c.health, 'characters.health', 0, 100); range(c.wealth, 'characters.wealth');
      if (c.diedAtTimeStep !== undefined) range(c.diedAtTimeStep, 'characters.diedAtTimeStep', 0, Infinity, true);
      choice(c.currentMood, ['平静', '警惕', '焦虑', '激动', '愤怒', '悲恸', '疲惫'], 'characters.currentMood');
      choice(c.moralityAlignment, ['守序良善', '中立善', '守序中立', '绝对中立', '混乱中立', '守序邪恶', '混乱邪恶'], 'characters.moralityAlignment');
      c.currentLocationId = ref(c.currentLocationId, locations, '人物地点'); c.factionId = ref(c.factionId, factions, '人物势力');
      c.relationships = Object.fromEntries(Object.entries(c.relationships).filter(([id]) => !!ref(id, characters, '人物关系')));
      unique(c.knownFacts, 'characters.knownFacts');
      for (const fact of c.knownFacts) { range(fact.confidence, 'characters.knownFacts.confidence', 0, 1); if (fact.sourceEventId) fact.sourceEventId = ref(fact.sourceEventId, eventIds, '事实来源') || undefined; }
    }
    for (const l of world.locations) { if (l.travelHours !== undefined) { range(l.travelHours, 'locations.travelHours', 2, 168, true); if (l.travelHours % 2) fail('locations.travelHours'); } choice(l.type, ['city', 'tavern', 'palace', 'wilderness', 'market', 'dungeon'], 'locations.type'); l.connectedLocationIds = refs(l.connectedLocationIds, locations, '地点连接'); }
    for (const f of world.factions) { range(f.powerLevel, 'factions.powerLevel', 0, 100); f.allies = refs(f.allies, factions, '同盟'); f.enemies = refs(f.enemies, factions, '敌对势力'); if (f.leaderId) f.leaderId = ref(f.leaderId, characters, '势力领袖') || undefined; }
    for (const r of world.rules) choice(r.category, ['natural', 'magic', 'social', 'taboo'], 'rules.category');
    for (const e of events) {
      choice(e.eventType, ['encounter', 'dialogue', 'trade', 'discovery', 'conflict', 'travel', 'conspiracy', 'rest'], 'events.eventType'); range(e.timeStepIndex, 'events.timeStepIndex', 0, Infinity, true);
      e.locationId = ref(e.locationId, locations, '事件地点'); e.participantIds = refs(e.participantIds, characters, '事件人物'); e.causeEventIds = refs(e.causeEventIds, eventIds, '事件前因');
      e.visibility.knownByCharacterIds = refs(e.visibility.knownByCharacterIds, characters, '事件知情人'); e.stateChanges = e.stateChanges.filter(change => !!ref(change.characterId, characters, '事件状态人物'));
    }
    for (const ch of chapters) { ch.associatedEventIds = refs(ch.associatedEventIds, eventIds, '章节关联事件'); if (ch.povCharacterId) ch.povCharacterId = ref(ch.povCharacterId, characters, '章节视点') || undefined; }
    for (const clue of world.foreshadowing) clue.relatedCharacterIds = refs(clue.relatedCharacterIds, characters, '伏笔人物');
  };
  repair(project, project.events, project.chapters);
  for (const snap of project.snapshots) {
    range(snap.timeStepIndex, 'snapshots.timeStepIndex', 0, Infinity, true); range(snap.eventsCount, 'snapshots.eventsCount', 0, Infinity, true);
    const world = snap.worldState || JSON.parse(JSON.stringify({ locations: project.locations, factions: project.factions, rules: project.rules, foreshadowing: project.foreshadowing })) as ProjectData;
    const events = snap.events || JSON.parse(JSON.stringify(project.events.filter(e => e.timeStepIndex <= snap.timeStepIndex))) as ProjectData['events'];
    repair({ ...world, characters: snap.characters }, events);
  }
  if (warnings.size) project.recoveryWarnings = [...warnings];
}
