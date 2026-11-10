import type { ProjectData, ChapterActBeat, WorldEvent } from '../types';
import { AIProviderService } from './aiProviderService';
import { LorebookService } from './lorebookService';
import { HierarchicalMemoryService } from './hierarchicalMemoryService';
export interface ExpansionProgressCallback { (actNumber: number, actName: string, currentWords: number, logMsg: string): void }

export class ChapterExpansionEngine {
  static async generateDeepChapter(params: {
    project: ProjectData; volumeNumber: number; chapterNumber: number; povCharacterId?: string;
    events: WorldEvent[]; userConstraint?: string; targetWordCount?: number;
    onProgress?: ExpansionProgressCallback; signal?: AbortSignal;
  }): Promise<{ title: string; outline: string; content: string; beats: ChapterActBeat[] }> {
    const { project, chapterNumber, volumeNumber, events, userConstraint, onProgress, signal } = params;
    const check = () => { if (signal?.aborted) throw new Error('创作已取消'); };
    const target = Math.min(12000, Math.max(100, Math.round(params.targetWordCount || project.settings.chapterLengthTarget || 4000)));
    const context = HierarchicalMemoryService.buildRollingMemoryContext(project, chapterNumber, params.povCharacterId);
    const pov = project.characters.find(c => c.id === params.povCharacterId) || project.characters[0];
    const scanContexts = [...events.map(e => `${e.title} ${e.description}`), pov?.currentGoal || '', userConstraint || '', project.worldName, context];
    const { activated } = LorebookService.scanAndActivate(project.lorebook || [], scanContexts);
    const lorebookBlock = LorebookService.formatLorebookPrompt(activated);
    const authorsNote = project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined;
    const request = async (prompt: string, systemInstruction?: string) => {
      check(); const result = await AIProviderService.generateText(project.aiConfig, { prompt, systemInstruction, lorebookBlock, authorsNote, signal }); check();
      if (!result.trim()) throw new Error('章节生成返回的正文为空，请重试。'); return result.trim();
    };
    const eventsBrief = events.map(e => `[${e.simulationTime}] ${e.title}：${e.description}`).join('\n').slice(0, 6000) || '尚无模拟事件，依据本书简介与作者要求创作。';
    onProgress?.(0, '规划四幕细纲', 0, '正在构建前文记忆与本章大纲…'); check();
    const outlineRaw = await request(`请为作品《${project.title}》第${volumeNumber}卷 第${chapterNumber}章规划四幕。\n目标篇幅：${target} 字。\n${context}\n本章事件：${eventsBrief}\n作者要求：${userConstraint || '保持本书题材、视角与事实连贯'}\n请严格逐行输出（每行内容须完整）：\nTITLE: 章节标题\nSUMMARY: 本章梗概\nACT1: 第一幕任务\nACT2: 第二幕任务\nACT3: 第三幕任务\nACT4: 第四幕任务`, '你是小说结构编辑，尊重作者设定、叙述视角及人物认知边界。');
    const get = (key: string) => outlineRaw.split('\n').find(line => line.trim().startsWith(`${key}:`))?.trim().slice(key.length + 1).trim() || '';
    const title = get('TITLE'), outline = get('SUMMARY'), tasks = [1, 2, 3, 4].map(n => get(`ACT${n}`));
    if (!title || !outline || tasks.some(task => !task)) throw new Error(`第${chapterNumber}章的 AI 生成大纲为空或不完整，请重新生成。`);
    const beats: ChapterActBeat[] = []; let content = '';
    const names = ['第一幕·起', '第二幕·承', '第三幕·转', '第四幕·合'];
    for (let i = 0; i < 4; i++) {
      check(); const actTarget = Math.ceil(target / 4);
      onProgress?.(i + 1, names[i], content.length, `正在撰写${names[i]}，目标约 ${actTarget} 字…`); check();
      const text = await request(`【${names[i]}】\n章节：${title}\n本幕任务：${tasks[i]}\n本幕目标：约 ${actTarget} 字，全章目标 ${target} 字。\n${context}\n本章事件：${eventsBrief}\n作者要求：${userConstraint || '保持本书文风与叙述视角'}\n承接本章已写正文：${content.slice(-2000) || '本章开始'}\n直接输出本幕正文，不添加前言、幕名或总结。保持情节连贯，不泄露视点人物未知的秘密。`);
      beats.push({ actIndex: i + 1, actName: names[i], outline: tasks[i], content: text, wordCount: text.length });
      content += (content ? '\n\n' : '') + text;
    }
    if (content.length < target) {
      onProgress?.(5, '章节补充延展', content.length, `当前 ${content.length} 字，尝试补充至目标 ${target} 字…`); check();
      const text = await request(`【篇章景深扩充】\n作品：${project.title}\n${context}\n依据本章既有地点、人物与情节补充约 ${target - content.length} 字，不引入其他作品设定。\n作者要求：${userConstraint || '保持本书风格'}\n承接前文：${content.slice(-2000)}\n直接输出自然衔接的补充正文。`);
      content += '\n\n' + text;
      beats.push({ actIndex: 5, actName: '章节补充延展', outline: '补充本章场景与情节衔接', content: text, wordCount: text.length });
    }
    check(); onProgress?.(6, '全章完工', content.length, `实际 ${content.length} 字；目标 ${target} 字，请审阅。`);
    return { title, outline, content, beats };
  }

  /**
   * 针对某一特定幕（起、承、转、合）单独重新生成，结合前置幕的正文衔接，保持全章连贯
   */
  static async regenerateSingleAct(params: {
    project: ProjectData;
    chapterNumber: number;
    actIndex: number; // 1 ~ 4
    chapterTitle: string;
    actTask: string;
    existingBeats: ChapterActBeat[];
    povCharacterId?: string;
    events: WorldEvent[];
    userConstraint?: string;
    targetWordCount?: number;
    signal?: AbortSignal;
  }): Promise<{ updatedAct: ChapterActBeat; fullContent: string; beats: ChapterActBeat[] }> {
    const { project, chapterNumber, actIndex, chapterTitle, actTask, existingBeats, events, userConstraint, signal } = params;
    if (signal?.aborted) throw new Error('创作已取消');
    const target = Math.min(12000, Math.max(100, Math.round(params.targetWordCount || project.settings.chapterLengthTarget || 4000)));
    const actTarget = Math.ceil(target / 4);
    const context = HierarchicalMemoryService.buildRollingMemoryContext(project, chapterNumber, params.povCharacterId);
    const pov = project.characters.find(c => c.id === params.povCharacterId) || project.characters[0];
    const scanContexts = [...events.map(e => `${e.title} ${e.description}`), pov?.currentGoal || '', userConstraint || '', project.worldName, context];
    const { activated } = LorebookService.scanAndActivate(project.lorebook || [], scanContexts);
    const lorebookBlock = LorebookService.formatLorebookPrompt(activated);
    const authorsNote = project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined;

    // 前置幕正文收束
    const precedingContent = existingBeats
      .filter(b => b.actIndex < actIndex)
      .sort((a, b) => a.actIndex - b.actIndex)
      .map(b => b.content)
      .join('\n\n');

    const names = ['第一幕·起', '第二幕·承', '第三幕·转', '第四幕·合'];
    const actName = names[actIndex - 1] || `第${actIndex}幕`;
    const eventsBrief = events.map(e => `[${e.simulationTime}] ${e.title}：${e.description}`).join('\n').slice(0, 6000) || '依据本书设定与作者要求展开。';

    const prompt = `【${actName} · 定向重新推敲】\n章节：《${chapterTitle}》\n本幕任务：${actTask}\n本幕目标篇幅：约 ${actTarget} 字。\n${context}\n本章事件：${eventsBrief}\n作者补充要求：${userConstraint || '保持文风自然、情节紧凑，符合人物性格'}\n承接前置已写正文：${precedingContent.slice(-2000) || '本章起始'}\n请直接输出本幕重写的全新正文，不带前言、不带幕名。`;

    const text = await AIProviderService.generateText(project.aiConfig, {
      prompt,
      systemInstruction: '你是一位精益求精的小说家，负责对本幕做重写与文笔精修。',
      lorebookBlock,
      authorsNote,
      signal,
    });
    if (!text.trim()) throw new Error('单幕重新生成返回正文为空，请重试。');

    const updatedAct: ChapterActBeat = {
      actIndex,
      actName,
      outline: actTask,
      content: text.trim(),
      wordCount: text.trim().length,
    };

    const newBeats = existingBeats.some(b => b.actIndex === actIndex)
      ? existingBeats.map(b => (b.actIndex === actIndex ? updatedAct : b))
      : [...existingBeats, updatedAct].sort((a, b) => a.actIndex - b.actIndex);

    const fullContent = newBeats.map(b => b.content).join('\n\n');
    return { updatedAct, fullContent, beats: newBeats };
  }
}
