import type { ProjectData, ConsistencyIssue, WorldEvent } from '../types';
import { AIProviderService } from './aiProviderService';
import { LorebookService } from './lorebookService';
import { HierarchicalMemoryService } from './hierarchicalMemoryService';
import { ChapterExpansionEngine } from './chapterExpansionEngine';
import type { ExpansionProgressCallback } from './chapterExpansionEngine';

export class GeminiService {
  /**
   * Generates a literary chapter through the four-act pipeline.
   * Failed model requests remain failures so callers can preserve the draft.
   */
  public static async generateChapter(params: {
    project: ProjectData;
    volumeNumber: number;
    chapterNumber: number;
    povCharacterId?: string;
    events: WorldEvent[];
    userConstraint?: string;
    targetWordCount?: number;
    signal?: AbortSignal;
    onProgress?: ExpansionProgressCallback;
  }): Promise<{ title: string; outline: string; content: string; activatedLorebookKeys: string[] }> {
    const { project, volumeNumber, chapterNumber, povCharacterId, events, userConstraint, onProgress } = params;

    // Scan Lorebook keys for audit badge
    const scanContexts = [
      ...events.map(e => `${e.title} ${e.description}`),
      userConstraint || '',
      project.worldName,
    ];
    const { activatedKeys } = LorebookService.scanAndActivate(project.lorebook || [], scanContexts);

    const expanded = await ChapterExpansionEngine.generateDeepChapter({
      project,
      volumeNumber,
      chapterNumber,
      povCharacterId,
      events,
      userConstraint,
      onProgress,
      targetWordCount: params.targetWordCount,
      signal: params.signal,
    });
    if (!expanded.content?.trim()) throw new Error('章节生成返回的正文为空，请重试。');

    return {
      title: expanded.title,
      outline: expanded.outline,
      content: expanded.content,
      activatedLorebookKeys: activatedKeys,
    };
  }

  /**
   * Run automated consistency audit for timeline paradoxes, location teleportation, and epistemic leaks.
   */
  public static async auditConsistency(project: ProjectData): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    // 1. Deterministic Rule-Based Checks
    project.characters.forEach(c => {
      if (!c.isAlive && c.diedAtTimeStep !== undefined) {
        const recentParticipation = project.events.filter(e => e.participantIds.includes(c.id) && e.timeStepIndex > c.diedAtTimeStep!);
        if (recentParticipation.length > 0) {
          issues.push({
            id: `iss_dead_${c.id}`,
            severity: 'critical',
            title: `已故角色仍然产生事件`,
            description: `角色【${c.name}】死亡时间步为 ${c.diedAtTimeStep}，此后仍有参与事件。`,
            suspectedEntities: [c.name],
            suggestedFix: `核对死亡时间与死后事件，不要删除生前的历史记录。`
          });
        }
      }
    });

    const sortedEvents = [...project.events].sort((a, b) => a.timeStepIndex - b.timeStepIndex);
    const lastLocMap: Record<string, { locId: string; timeStep: number }> = {};
    sortedEvents.forEach(evt => {
      evt.participantIds.forEach(charId => {
        const prev = lastLocMap[charId];
        if (prev && prev.timeStep === evt.timeStepIndex && prev.locId !== evt.locationId) {
          const char = project.characters.find(c => c.id === charId);
          issues.push({
            id: `iss_${Date.now()}_teleport_${charId}`,
            severity: 'critical',
            title: `瞬时地理分身悖论`,
            description: `角色【${char?.name || charId}】在同一时间片(${evt.simulationTime})内，同时出现于不同地点。`,
            suspectedEntities: [char?.name || charId],
            suggestedFix: `核对事件发生顺序，插入迁徙事件或修改地点归属。`
          });
        }
        lastLocMap[charId] = { locId: evt.locationId, timeStep: evt.timeStepIndex };
      });
    });

    // 2. AI Semantic Consistency Audit
    const recentChapters = project.chapters.slice(-2).map(c => `《${c.title}》：\n${c.content.slice(0, 500)}...`).join('\n\n');
    const auditPrompt = `请作为小说架构总编辑，审计以下世界近期章节与设定的一致性：
世界规则：${JSON.stringify(project.rules.map(r => r.rule))}
人物近期表现：${JSON.stringify(project.characters.map(c => ({ name: c.name, mood: c.currentMood, goal: c.currentGoal })))}
近期章节摘录：
${recentChapters}

请列出是否存在：1.角色性格断裂(OOC) 2.世界规则冲突 3.未交代便知晓秘密的认知穿帮。
若无严重问题，请回复"ALL_CONSISTENT"；若有，请简要列出1~2条条目。`;

    const response = await AIProviderService.generateText(project.aiConfig, {
      prompt: auditPrompt,
      thinkingBudget: 0,
      authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
    });
    const text = response.trim();
    if (text !== 'ALL_CONSISTENT') {
      if (text.length <= 20) throw new Error('一致性审计返回内容不完整，请重试。');
      issues.push({
        id: `iss_ai_${Date.now()}`,
        severity: 'warning',
        title: `AI 深度文学与逻辑审计建议 (${project.aiConfig.activeProvider})`,
        description: text.slice(0, 300),
        suspectedEntities: ['主线章节剧情'],
        suggestedFix: '参考审计提示微调章节中的人物措辞与反应。'
      });
    }

    if (issues.length === 0) {
      issues.push({
        id: 'iss_ok',
        severity: 'suggestion',
        title: '世界因果网络运行平稳',
        description: '本次规则检查与 AI 审计未发现明显冲突，可结合全文继续复核。',
        suspectedEntities: [],
        suggestedFix: '可以继续推进模拟时间或生成下一章节。'
      });
    }

    return issues;
  }

  /**
   * Brainstorms next narrative beat with human-in-the-loop (Mode B)
   */
  public static async coWriteSuggestions(
    project: ProjectData,
    directionPrompt: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    const memory = HierarchicalMemoryService.buildRollingMemoryContext(project, Math.max(0, ...project.chapters.map(c => c.chapterNumber)) + 1);
    const prompt = `${memory}
当前作品：《${project.title}》
世界当前时间：${project.currentSimulationTime}
当前主要人物分布：${project.characters.map(c => `${c.name}在${c.currentLocationId}(心境:${c.currentMood})`).join('、')}
用户提出的剧情意图：“${directionPrompt}”

请根据当前世界真实因果与人物动机，提供3个不同方向的后续情节推进建议，要求：
1. 恪守世界观物理与社交法则
2. 不擅自捏造脱离现实的巧合
3. 展现深厚文学张力

直接输出3条，用1. 2. 3. 分段。`;

    const text = await AIProviderService.generateText(project.aiConfig, {
      prompt,
      signal,
      authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
    });
    if (!text.trim()) throw new Error('创作建议返回内容为空，请重试。');
    const lines = text.split('\n').filter(line => /^\d+\./.test(line.trim()));
    return lines.length > 0 ? lines : [text];
  }
}
