import { ProjectData, ChaosTwistPrompt } from '../types';
import { AIProviderService } from './aiProviderService';

export class ChaosTwistService {
  /**
   * Ported from GitHub narrative-agent / TaleCrafter Oracle:
   * When authors hit writer's block or the world simulation reaches a lull,
   * generates 3 distinct, causality-compliant unexpected plot twists (Plot Twists / Complications)
   * grounded strictly in the world's physical and social rules.
   */
  public static async rollChaosTwists(
    project: ProjectData,
    situationContext?: string,
    signal?: AbortSignal
  ): Promise<ChaosTwistPrompt[]> {
    const aliveChars = project.characters.filter(c => c.isAlive).map(c => `${c.name}(${c.occupation}@${c.currentLocationId})`).join(', ');
    const rulesBrief = project.rules.map(r => r.rule).join('；');
    const recentEvents = project.events.slice(-2).map(e => e.title).join('、');

    const prompt = `你现在是长篇小说《${project.title}》（世界：${project.worldName}）的【混沌因果神谕（Plot Oracle）】。
当前世界状态：
- 活跃人物：${aliveChars}
- 世界硬法则：${rulesBrief}
- 最近发生的正史：${recentEvents || '风平浪静'}
- 作者当前剧情阻滞/需求：“${situationContext || '局势平缓，需要不可预测但极度合乎世界因果的突发变故'}”

请生成3个不同维度的意外剧情破局提案（神谕摇骰结果）。
要求：
1. 恪守世界观物理、社会与神秘法则，严禁机械降神。
2. 每一个变故必须源于某角色的既有隐秘动机，或世界自然环境的突变（必须符合本书题材、环境和已发生的事实）。

请严格输出纯 JSON 数组：
[
  {
    "id": "twist_1",
    "title": "简短引人入胜的变故名",
    "triggerContext": "突发诱因说明",
    "suggestedIncident": "具体发生的情节与戏剧冲突",
    "affectedEntities": ["角色名1", "角色名2"],
    "dramaturgyEffect": "escalation"
  }
]`;

    const raw = await AIProviderService.generateText(project.aiConfig, {
        prompt,
        authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
        signal,
      });

    let parsed: unknown;
    try { parsed = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/gi, '').trim()); }
    catch { throw new Error('剧情提案 JSON 格式无效，请重试。'); }
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > 10 || parsed.some(item =>
      !item || typeof item !== 'object' || ['title', 'triggerContext', 'suggestedIncident'].some(key => typeof item[key] !== 'string' || !item[key].trim())
      || !Array.isArray(item.affectedEntities) || item.affectedEntities.some((x: unknown) => typeof x !== 'string')
      || !['escalation', 'revelation', 'obstacle', 'downtime'].includes(item.dramaturgyEffect))) throw new Error('剧情提案字段格式不完整，请重试。');
    return parsed.map((item, index) => ({ ...item, id: 'twist_' + index })) as ChaosTwistPrompt[];
  }
}
