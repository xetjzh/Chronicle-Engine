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
    situationContext?: string
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
2. 每一个变故必须源于某角色的既有隐秘动机，或世界自然环境的突变（如寒潮暴雪加剧、官署突击戒严、密库暗渠坍塌）。

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

    try {
      const raw = await AIProviderService.generateText(project.aiConfig, {
        prompt,
        overrideSampling: { temperature: 0.85 },
      });

      const clean = raw.replace(/```json|```/gi, '').trim();
      const parsed: ChaosTwistPrompt[] = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      throw new Error('格式解析不符合预期');
    } catch {
      return [
        {
          id: 'twist_fallback_1',
          title: '严霜骤降·宵禁长街突发连环封锁',
          triggerContext: '黑石城巡检司二把手秘密接获密报，全城提前一刻钟下铁锁封街',
          suggestedIncident: '听雨居正门被铁卫重重拍击，门板被贴上红封条，店内所有人瞬间沦为嫌犯，互信彻底瓦解。',
          affectedEntities: ['裴子期', '罗无忌', '严素娘'],
          dramaturgyEffect: 'escalation'
        },
        {
          id: 'twist_fallback_2',
          title: '暗渠渗水·青溟石寒气在客栈地窖外泄',
          triggerContext: '客栈老地窖暗渠承重木柱朽裂，商号私藏的生矿遭遇积水催化',
          suggestedIncident: '大堂老炭炉的火焰瞬间被吸成幽蓝霜雾，堂倌指尖被冻成青紫，严素娘的暗桩身份险些彻底暴露。',
          affectedEntities: ['严素娘', '裴子期'],
          dramaturgyEffect: 'obstacle'
        },
        {
          id: 'twist_fallback_3',
          title: '拾荒盲叟的竹杖铜铃在后巷失落',
          triggerContext: '何老蔫在鬼市水渠翻找时被暗哨惊动，仓皇逃入客栈后柴房',
          suggestedIncident: '何老蔫误打误撞将铜箱钥匙掉落在炭筐里，被烤火的裴子期靴尖无意踢中。',
          affectedEntities: ['何老蔫', '裴子期'],
          dramaturgyEffect: 'revelation'
        }
      ];
    }
  }
}
