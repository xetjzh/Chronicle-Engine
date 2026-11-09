import type { Character, ProjectData } from '../types';

export const characterMoods = ['平静', '警惕', '焦虑', '激动', '愤怒', '悲恸', '疲惫'] as const;
export const characterAlignments = ['守序良善', '中立善', '守序中立', '绝对中立', '混乱中立', '守序邪恶', '混乱邪恶'] as const;

export function createBlankCharacter(project: ProjectData): Character {
  return { id: `char_${crypto.randomUUID()}`, name: '新人物', title: '', age: 0, gender: '',
    factionId: project.factions[0]?.id || '', currentLocationId: project.locations[0]?.id || '',
    occupation: '', appearance: '', personality: '', coreDesire: '', greatestFear: '',
    currentMood: '平静', moralityAlignment: '绝对中立', health: 100, wealth: 0,
    inventory: [], currentGoal: '', isAlive: true, relationships: {}, knownFacts: [] };
}

export function parseGeneratedCharacter(raw: string, project: ProjectData): Character {
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/gi, '').trim()); }
  catch { throw new Error('人物返回的 JSON 格式无效。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('人物字段格式无效。');
  const data = value as Record<string, unknown>;
  if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('人物姓名不能为空。');
  const result = createBlankCharacter(project);
  const textKeys = ['name', 'title', 'gender', 'occupation', 'appearance', 'personality', 'coreDesire', 'greatestFear', 'currentGoal'] as const;
  for (const key of textKeys) {
    if (data[key] === undefined) continue;
    if (typeof data[key] !== 'string') throw new Error(`人物字段 ${key} 必须为文本。`);
    result[key] = data[key].trim();
  }
  for (const key of ['age', 'health', 'wealth'] as const) {
    const number = data[key]; if (number === undefined) continue;
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || (key === 'health' && number > 100)) throw new Error(`人物字段 ${key} 超出有效范围。`);
    result[key] = number;
  }
  if (data.inventory !== undefined) {
    if (!Array.isArray(data.inventory) || data.inventory.some(item => typeof item !== 'string')) throw new Error('人物 inventory 必须为文本数组。');
    result.inventory = data.inventory as string[];
  }
  if (data.currentMood !== undefined) {
    if (!characterMoods.includes(data.currentMood as Character['currentMood'])) throw new Error('人物心境字段无效。');
    result.currentMood = data.currentMood as Character['currentMood'];
  }
  if (data.moralityAlignment !== undefined) {
    if (!characterAlignments.includes(data.moralityAlignment as Character['moralityAlignment'])) throw new Error('人物阵营字段无效。');
    result.moralityAlignment = data.moralityAlignment as Character['moralityAlignment'];
  }
  return result;
}
