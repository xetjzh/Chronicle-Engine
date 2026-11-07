import type { ProjectData } from '../types';

type Schema = 'string' | 'number' | 'boolean' | 'record' | { [key: string]: Schema } | [Schema];
const strings: Schema = ['string'];
const character: Schema = {
  id: 'string', name: 'string', title: 'string', age: 'number', gender: 'string', factionId: 'string',
  currentLocationId: 'string', occupation: 'string', appearance: 'string', personality: 'string',
  coreDesire: 'string', greatestFear: 'string', currentMood: 'string', moralityAlignment: 'string',
  health: 'number', wealth: 'number', inventory: strings, currentGoal: 'string', relationships: 'record',
  knownFacts: [{ id: 'string', fact: 'string', learnedAtTime: 'string', confidence: 'number' }], isAlive: 'boolean',
};
const schema: Schema = {
  id: 'string', title: 'string', genre: 'string', authorNote: 'string', worldName: 'string',
  currentSimulationTime: 'string', timeStepIndex: 'number',
  chapters: [{ id: 'string', title: 'string', content: 'string', outline: 'string', wordCount: 'number',
    chapterNumber: 'number', volumeNumber: 'number', associatedEventIds: strings, createdAt: 'string', updatedAt: 'string', status: 'string',
    'povCharacterId?': 'string', 'tensionScore?': 'number',
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
    'excerpts?': [{ id: 'string', docId: 'string', docTitle: 'string', chapterTitle: 'string', selectedText: 'string', userNote: 'string', tags: strings, createdAt: 'string' }] }],
  'volumes?': [{ volumeNumber: 'number', title: 'string', theme: 'string', summary: 'string', chapterCount: 'number' }],
  'deskSettings?': {
    'targetDailyWords?': 'number', 'currentSessionWords?': 'number', 'isZenMode?': 'boolean', 'typewriterMode?': 'boolean',
    'indentParagraphs?': 'boolean', 'theme?': 'string', 'fontSize?': 'number', 'lineHeight?': 'number',
    'fontFamily?': 'string', 'soundEnabled?': 'boolean', 'ambientMode?': 'string',
  },
  settings: { povPreference: 'string', literaryStyle: 'string', chapterLengthTarget: 'number' },
  aiConfig: {
    activeProvider: 'string', activePreset: 'string',
    gemini: { model: 'string', 'thinkingBudget?': 'number' }, ollama: { baseUrl: 'string', model: 'string', contextLength: 'number', keepAlive: 'string' },
    openaiCompatible: { baseUrl: 'string', apiKey: 'string', model: 'string', 'customHeaders?': 'record' },
    authorsNote: { enabled: 'boolean', content: 'string', insertionDepth: 'number' },
    sampling: { temperature: 'number', topP: 'number', topK: 'number', repetitionPenalty: 'number', frequencyPenalty: 'number', presencePenalty: 'number', maxTokens: 'number', stopSequences: strings },
  },
};

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
  return project;
}
