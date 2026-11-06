import { ProjectData, Chapter, ChapterExtraction } from '../types';
import { AIProviderService } from './aiProviderService';

export class RecursiveSummaryEngine {
  /**
   * Ported from GitHub recursive-novel & Auto-Story architectures:
   * When a chapter is generated or finalized, analyzes the full text to:
   * 1. Produce a compact 100~150 word factual summary (preventing context overflow)
   * 2. Automatically detect character state changes (injuries, wealth, inventory, emotional shifts)
   * 3. Evaluate the narrative tension score (0-100) for pacing visualization
   */
  public static async extractAndCompressChapter(
    project: ProjectData,
    chapter: Chapter
  ): Promise<ChapterExtraction> {
    const textExcerpt = chapter.content.slice(0, 3000) + (chapter.content.length > 3000 ? '\n...\n' + chapter.content.slice(-1500) : '');

    const prompt = `你是一位严谨的虚构历史记录整理官。请对以下小说章节进行客观事实提取与张力审查。
作品：《${project.title}》
章节：第${chapter.chapterNumber}章《${chapter.title}》

章节内容：
${textExcerpt}

请严格按以下 JSON 格式输出（不要添加任何 markdown 代码块外部文字）：
{
  "chapterSummary": "100字以内的纯事实梗概，记录关键事件走向，不带主观评价",
  "keyStateChanges": [
    "角色X在事件中改变了对角色Y的信任",
    "角色Z获得了某物品或获知了某秘密"
  ],
  "newLoreLearned": [
    "新确认的世界规则或地理细节"
  ],
  "tensionScore": 75
}`;

    try {
      const rawText = await AIProviderService.generateText(project.aiConfig, {
        prompt,
        systemInstruction: '你是一位极其精确的事件因果整理官，提取客观事实，过滤文学修辞。',
        overrideSampling: { temperature: 0.2 },
        thinkingBudget: 0,
      });

      const clean = rawText.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(clean);

      return {
        chapterSummary: parsed.chapterSummary || chapter.outline,
        keyStateChanges: Array.isArray(parsed.keyStateChanges) ? parsed.keyStateChanges : [],
        newLoreLearned: Array.isArray(parsed.newLoreLearned) ? parsed.newLoreLearned : [],
        tensionScore: typeof parsed.tensionScore === 'number' ? Math.min(100, Math.max(10, parsed.tensionScore)) : 60,
      };
    } catch (e) {
      // Deterministic fallback based on text heuristics
      const hasConflict = /刀|剑|杀|血|暴|死|惊|斩|急|逼/g.test(chapter.content);
      const computedScore = hasConflict ? 75 : 45;
      return {
        chapterSummary: chapter.outline || `${chapter.title}：多方势力在此章节完成交汇与试探。`,
        keyStateChanges: [`视点人物推进了当前阶段的因果行动`],
        newLoreLearned: [],
        tensionScore: computedScore,
      };
    }
  }
}
