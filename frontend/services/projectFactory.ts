import type { AIProviderConfig, ProjectData } from '../types';

export interface NewBookDetails { title?: string; genre?: string; premise?: string }

export function createEmptyProject(id: string, details: NewBookDetails = {}, connection?: AIProviderConfig): ProjectData {
  if (!id.trim()) throw new Error('作品 ID 不能为空。');
  const aiConfig: AIProviderConfig = {
    activeProvider: connection?.activeProvider || 'gemini', activePreset: 'custom',
    sampling: { temperature: 0.8, topP: 0.92, topK: 40, repetitionPenalty: 1.1, frequencyPenalty: 0.2, presencePenalty: 0.2, maxTokens: 3500, stopSequences: [] },
    authorsNote: { enabled: false, content: '', insertionDepth: 1 },
    gemini: connection ? JSON.parse(JSON.stringify(connection.gemini)) : { model: 'gemini-2.5-flash', thinkingBudget: 0 },
    ollama: connection ? JSON.parse(JSON.stringify(connection.ollama)) : { baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b-instruct-q4_K_M', contextLength: 8192, keepAlive: '5m' },
    openaiCompatible: connection ? JSON.parse(JSON.stringify(connection.openaiCompatible)) : { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '' },
  };
  return {
    id, title: details.title?.trim() || '未命名作品', genre: details.genre?.trim() || '未分类',
    authorNote: details.premise?.trim() || '', worldName: '', currentSimulationTime: '第1日 子时', timeStepIndex: 0,
    chapters: [], characters: [], locations: [], factions: [], events: [], rules: [], lorebook: [],
    referenceDocs: [], snapshots: [], foreshadowing: [], volumes: [], aiConfig,
    settings: { povPreference: '第三人称有限视角', literaryStyle: '严肃文学', chapterLengthTarget: 4000 },
  };
}
