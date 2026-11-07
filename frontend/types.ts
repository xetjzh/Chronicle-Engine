export type CreationMode = 'SIMULATION' | 'CO_WRITING' | 'AUTO_NOVEL';

export type AIProviderType = 'gemini' | 'ollama' | 'openai_compatible';

export type AIPresetType = 
  | 'sillytavern_literary'       // SillyTavern 风格：强调细腻肢体语言与古典描写
  | 'ollama_arm_efficient'       // 适配 4核 ARM 本地模型：短上下文剪裁、强防复读惩罚
  | 'deepseek_causality'         // DeepSeek 风格：高逻辑自洽与因果步步为营
  | 'gemini_epic';               // Gemini 2.5 Flash：全景史诗大纵深长文本

export interface LorebookEntry {
  id: string;
  name: string;
  keys: string[];
  secondaryKeys?: string[];
  content: string;
  isConstant: boolean;
  enabled: boolean;
  insertionOrder: number;
  scanDepth: number;
  comment?: string;
}

export interface SamplingParams {
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxTokens: number;
  stopSequences: string[];
}

export interface AuthorsNoteConfig {
  enabled: boolean;
  content: string;
  insertionDepth: number;
}

export interface AIProviderConfig {
  activeProvider: AIProviderType;
  activePreset: AIPresetType | 'custom';
  sampling: SamplingParams;
  authorsNote: AuthorsNoteConfig;

  gemini: {
    model: string;
    thinkingBudget?: number;
  };
  ollama: {
    baseUrl: string;
    model: string;
    contextLength: number;
    keepAlive: string;
  };
  openaiCompatible: {
    baseUrl: string;
    apiKey: string;
    model: string;
    customHeaders?: Record<string, string>;
  };
}

export interface LocationNode {
  id: string;
  name: string;
  type: 'city' | 'tavern' | 'palace' | 'wilderness' | 'market' | 'dungeon';
  description: string;
  connectedLocationIds: string[];
  climateOrDanger: string;
}

export interface Faction {
  id: string;
  name: string;
  ideology: string;
  powerLevel: number;
  leaderId?: string;
  allies: string[];
  enemies: string[];
}

export interface CognitiveFact {
  id: string;
  fact: string;
  learnedAtTime: string;
  sourceEventId?: string;
  confidence: number;
  isMisinformation?: boolean;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  age: number;
  gender: string;
  factionId: string;
  currentLocationId: string;
  occupation: string;
  appearance: string;
  
  personality: string;
  coreDesire: string;
  greatestFear: string;
  currentMood: '平静' | '警惕' | '焦虑' | '激动' | '愤怒' | '悲恸' | '疲惫';
  moralityAlignment: '守序良善' | '中立善' | '守序中立' | '绝对中立' | '混乱中立' | '守序邪恶' | '混乱邪恶';

  health: number;
  wealth: number;
  inventory: string[];
  currentGoal: string;
  statusEffect?: string;

  relationships: Record<string, string>;
  knownFacts: CognitiveFact[];
  isAlive: boolean;
}

export interface WorldEvent {
  id: string;
  simulationTime: string;
  timeStepIndex: number;
  eventType: 'encounter' | 'dialogue' | 'trade' | 'discovery' | 'conflict' | 'travel' | 'conspiracy' | 'rest';
  locationId: string;
  participantIds: string[];
  causeEventIds: string[];
  title: string;
  description: string;
  consequences: string[];
  stateChanges: {
    characterId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  visibility: {
    isPublic: boolean;
    knownByCharacterIds: string[];
  };
  confirmed: boolean;
}

export interface WorldRule {
  id: string;
  category: 'natural' | 'magic' | 'social' | 'taboo';
  rule: string;
  consequenceOfViolation: string;
}

export interface ForeshadowingClue {
  id: string;
  title: string;
  plantedChapterId?: string;
  plantedTime: string;
  relatedCharacterIds: string[];
  expectedResolution: string;
  isResolved: boolean;
  notes: string;
}

export interface ChapterActBeat {
  actIndex: number;              // 1: 起, 2: 承, 3: 转, 4: 合
  actName: string;
  outline: string;
  content: string;
  wordCount: number;
}

// 移植自开源项目递归状态沉淀 (Recursive Memory Extraction)
export interface ChapterExtraction {
  chapterSummary: string;        // 150字高密度正文事实梗概
  keyStateChanges: string[];     // 提炼出的人物状态变化
  newLoreLearned: string[];      // 本章新揭露的世界观要素
  tensionScore: number;          // 叙事张力评估 (0 - 100)
}

export interface Chapter {
  id: string;
  volumeNumber: number;
  chapterNumber: number;
  title: string;
  povCharacterId?: string;
  outline: string;
  content: string;
  wordCount: number;
  actBeats?: ChapterActBeat[];
  extraction?: ChapterExtraction;
  tensionScore?: number;
  associatedEventIds: string[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'audited' | 'final';
}

export interface Volume {
  volumeNumber: number;
  title: string;
  theme: string;
  summary: string;
  chapterCount: number;
}

export interface BatchPipelineStatus {
  isRunning: boolean;
  isPaused: boolean;
  targetChapterCount: number;
  completedInBatch: number;
  currentStepDescription: string;
  currentChapterWordCount: number;
  errors: string[];
  lastSavedAt: string;
}

export interface WorldSnapshot {
  id: string;
  snapshotName: string;
  simulationTime: string;
  timeStepIndex: number;
  createdAt: string;
  characters: Character[];
  eventsCount: number;
  description: string;
}

export interface ConsistencyIssue {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  title: string;
  description: string;
  suspectedEntities: string[];
  suggestedFix: string;
}

// 移植自开源项目 Solo-RPG Oracle / TaleCrafter: 混沌因果神谕扰动
export interface ChaosTwistPrompt {
  id: string;
  title: string;
  triggerContext: string;
  suggestedIncident: string;
  affectedEntities: string[];
  dramaturgyEffect: 'escalation' | 'revelation' | 'obstacle' | 'downtime';
}

// ----------------- 专业作者码字软件与多源文献参考库架构 -----------------

// 移植自 Zotero / Logseq / Foliate 的文献摘录考据卡片 (Zettelkasten Card)
export interface DocumentExcerpt {
  id: string;
  docId: string;
  docTitle: string;
  chapterTitle: string;
  selectedText: string;
  userNote: string;
  tags: string[];
  createdAt: string;
}

export interface ImportedDocument {
  id: string;
  fileName: string;
  format: 'txt' | 'epub' | 'pdf' | 'md';
  title: string;
  category?: 'history' | 'worldbuilding' | 'prose_sample' | 'lore' | 'general';
  tags?: string[];
  sizeBytes: number;
  parsedChapters: {
    id: string;
    title: string;
    content: string;
  }[];
  fileBlobUrl?: string;
  excerpts?: DocumentExcerpt[];
  importedAt: string;
}

export interface WritingDeskSettings {
  targetDailyWords: number;
  currentSessionWords: number;
  isZenMode: boolean;
  typewriterMode: boolean;
  indentParagraphs: boolean;
  theme: 'ink' | 'sepia' | 'dark_emerald' | 'solarized' | 'nord';
  fontSize: number;
  lineHeight: number;
  fontFamily: 'serif' | 'sans';
  soundEnabled: boolean;
  ambientMode?: 'rain' | 'campfire' | 'night' | 'none';
}

export interface ProjectData {
  id: string;
  title: string;
  genre: string;
  authorNote: string;
  worldName: string;
  currentSimulationTime: string;
  timeStepIndex: number;
  
  rules: WorldRule[];
  locations: LocationNode[];
  factions: Faction[];
  characters: Character[];
  events: WorldEvent[];
  chapters: Chapter[];
  volumes?: Volume[];
  foreshadowing: ForeshadowingClue[];
  lorebook: LorebookEntry[];
  snapshots: WorldSnapshot[];

  referenceDocs: ImportedDocument[];
  deskSettings?: WritingDeskSettings;

  aiConfig: AIProviderConfig;

  settings: {
    povPreference: '第三人称有限视角' | '第一人称' | '第三人称全知视角' | '多重视角轮转';
    literaryStyle: '严肃文学' | '古朴古典' | '轻快细腻' | '悬疑冷峻' | '生活日常';
    chapterLengthTarget: number;
  };
}
