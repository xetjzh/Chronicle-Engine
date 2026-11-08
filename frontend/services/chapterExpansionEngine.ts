import { ProjectData, Chapter, ChapterActBeat, WorldEvent } from '../types';
import { AIProviderService } from './aiProviderService';
import { LorebookService } from './lorebookService';

export interface ExpansionProgressCallback {
  (actNumber: number, actName: string, currentWords: number, logMsg: string): void;
}

export class ChapterExpansionEngine {
  /**
   * Generates a guaranteed 4000+ words chapter using a 4-Act Relay pipeline:
   * Act 1 (起, 1000~1200字): 场景营造、气象声色与主角当下状态感知
   * Act 2 (承, 1100~1300字): 因果事件碰撞、人物言语交锋与暗中博弈
   * Act 3 (转, 1100~1300字): 意外变故、心境震荡或线索险象环生
   * Act 4 (合, 1000~1200字): 局面收束、心理沉淀与伏笔余韵挂钩
   * If total word count is under 4000 words, automatically invokes dynamic continuation beat.
   */
  public static async generateDeepChapter(params: {
    project: ProjectData;
    volumeNumber: number;
    chapterNumber: number;
    povCharacterId?: string;
    events: WorldEvent[];
    userConstraint?: string;
    onProgress?: ExpansionProgressCallback;
  }): Promise<{ title: string; outline: string; content: string; beats: ChapterActBeat[] }> {
    const { project, volumeNumber, chapterNumber, povCharacterId, events, userConstraint, onProgress } = params;

    const povChar = project.characters.find(c => c.id === povCharacterId) || project.characters[0];
    const viewpoint = povChar?.name || '未指定人物，请依据作品简介与本章要求安排视角';
    const authorsNote = project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined;

    // Scan Lorebook
    const scanContexts = [
      ...events.map(e => `${e.title} ${e.description}`),
      povChar?.currentGoal || '',
      userConstraint || '',
      project.worldName,
    ];
    const { activated } = LorebookService.scanAndActivate(project.lorebook || [], scanContexts);
    const lorebookBlock = LorebookService.formatLorebookPrompt(activated);

    const eventsBrief = events.map(e => `[${e.simulationTime}] @${e.locationId} 事件:${e.title} -> ${e.description}`).join('\n') || '尚无模拟事件，请依据作品简介与本章要求创作，不沿用其他作品设定。';
    const rulesBrief = project.rules.map(r => `[${r.category}] ${r.rule}`).join('\n');

    // 1. Generate Master Outline for 4 Acts
    onProgress?.(0, '规划四幕细纲', 0, '正在将世界事件分解为四幕长篇架构...');
    const outlinePrompt = `请为长篇小说《${project.title}》第${volumeNumber}卷 第${chapterNumber}章设计包含四幕的详细扩写大纲。
题材：${project.genre} | 文风：${project.settings.literaryStyle}
作品简介：${project.authorNote || '尚未填写，以本章要求为准'}
视点人物：${viewpoint}${povChar?.title ? ` (${povChar.title})` : ''}
真实世界事件：
${eventsBrief}
创作者要求：${userConstraint || '遵循作品简介、所选文风与作者附注，保持人物与情节一致'}

请输出：
TITLE: [符合本书题材与文风的章节标题]
SUMMARY: [本章100字梗概]
ACT1: [第一幕·起：铺陈展开，字数指标1100字]
ACT2: [第二幕·承：对话试探与暗流，字数指标1200字]
ACT3: [第三幕·转：悬疑碰撞或危机显现，字数指标1200字]
ACT4: [第四幕·合：余韵收束与沉思，字数指标1000字]`;

    const outlineRaw = await AIProviderService.generateText(project.aiConfig, {
      prompt: outlinePrompt,
      systemInstruction: '你是一位精通超长篇巨著结构规划的小说架构大师。',
      lorebookBlock,
      authorsNote,
      thinkingBudget: 0,
    });

    const parsedOutline = this.parseMasterOutline(outlineRaw, chapterNumber);

    const beats: ChapterActBeat[] = [];
    let accumulatedContent = '';

    // ACT 1 (起)
    onProgress?.(1, '第一幕·起 (环境与感知铺垫)', accumulatedContent.length, '执笔第一幕，深描场景细节与人物心境...');
    const act1Prompt = `【超长篇创作·第一幕（起）执笔】
全书背景：${project.worldName || project.title} | 题材：${project.genre} | 文风：${project.settings.literaryStyle}
本章标题：${parsedOutline.title}
视点主角：${viewpoint} (心境:${povChar?.currentMood || '未设定'}, 欲求:${povChar?.coreDesire || '依本章要求确定'})
世界规则约束：\n${rulesBrief}

【第一幕大纲任务】：
${parsedOutline.actOutlines[0]}

【硬性要求】：
1. 依据本书题材与文风展开第一幕，描写符合当前场景的感知、行动与人物心境。
2. 禁止快餐式略写，本幕实际字数必须达到 1000~1200 汉字。
3. 直接输出第一幕正文，不加任何前言或总结。`;

    const act1Text = await AIProviderService.generateText(project.aiConfig, {
      prompt: act1Prompt,
      lorebookBlock,
      authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
    });
    beats.push({ actIndex: 1, actName: '第一幕·起', outline: parsedOutline.actOutlines[0], content: act1Text.trim(), wordCount: act1Text.trim().length });
    accumulatedContent += act1Text.trim() + '\n\n';

    // ACT 2 (承)
    onProgress?.(2, '第二幕·承 (言语试探与事件交互)', accumulatedContent.length, '第一幕已成，接续撰写第二幕深入对峙...');
    const act2Prompt = `【超长篇创作·第二幕（承）执笔】
承接前文剧情：
“...${accumulatedContent.slice(-400)}”

视点主角：${viewpoint}
【第二幕大纲任务】：
${parsedOutline.actOutlines[1]}

【硬性要求】：
1. 严丝合缝地承接上文，展开各方角色的微妙对话、目光交错或对关键线索的暗中打探。
2. 对话要句句有弦外之音，描写动作停顿与神态迟疑。
3. 严格遵循人物认知边界，绝不能透露他人隐秘。
4. 本幕实际字数必须达到 1100~1300 汉字。
5. 直接输出第二幕正文。`;

    const act2Text = await AIProviderService.generateText(project.aiConfig, {
      prompt: act2Prompt,
      lorebookBlock,
      authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
    });
    beats.push({ actIndex: 2, actName: '第二幕·承', outline: parsedOutline.actOutlines[1], content: act2Text.trim(), wordCount: act2Text.trim().length });
    accumulatedContent += act2Text.trim() + '\n\n';

    // ACT 3 (转)
    onProgress?.(3, '第三幕·转 (暗涌交锋与变局转折)', accumulatedContent.length, '接续第三幕，推向冲突高潮与悬念爆发...');
    const act3Prompt = `【超长篇创作·第三幕（转）执笔】
承接前文剧情：
“...${accumulatedContent.slice(-400)}”

视点主角：${viewpoint}
【第三幕大纲任务】：
${parsedOutline.actOutlines[2]}

【硬性要求】：
1. 承接前文，将矛盾或悬念推向实质性转折，发生实质性事件接触或情绪剧变。
2. 保持本书指定的文风与作者附注，不擅自改变题材。
3. 本幕实际字数必须达到 1100~1300 汉字。
4. 直接输出第三幕正文。`;

    const act3Text = await AIProviderService.generateText(project.aiConfig, {
      prompt: act3Prompt,
      lorebookBlock,
      authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
    });
    beats.push({ actIndex: 3, actName: '第三幕·转', outline: parsedOutline.actOutlines[2], content: act3Text.trim(), wordCount: act3Text.trim().length });
    accumulatedContent += act3Text.trim() + '\n\n';

    // ACT 4 (合)
    onProgress?.(4, '第四幕·合 (余韵收束与伏笔沉淀)', accumulatedContent.length, '撰写第四幕终局收束与余音袅袅...');
    const act4Prompt = `【超长篇创作·第四幕（合）执笔】
承接前文剧情：
“...${accumulatedContent.slice(-400)}”

视点主角：${viewpoint}
【第四幕大纲任务】：
${parsedOutline.actOutlines[3]}

【硬性要求】：
1. 依本章情节自然收束，保持既有时间、地点与人物动机一致。
2. 留下令人回味的悬念，使全章在此处圆融定格，为下一章埋下伏笔。
3. 本幕实际字数必须达到 1000~1200 汉字。
4. 直接输出第四幕正文。`;

    const act4Text = await AIProviderService.generateText(project.aiConfig, {
      prompt: act4Prompt,
      lorebookBlock,
      authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
    });
    beats.push({ actIndex: 4, actName: '第四幕·合', outline: parsedOutline.actOutlines[3], content: act4Text.trim(), wordCount: act4Text.trim().length });
    accumulatedContent += act4Text.trim();

    // 4000 Words Safety Check: If still under 4000, trigger automatic literary epilogue expansion
    if (accumulatedContent.length < 4000) {
      onProgress?.(5, '终章景深延展 (保底 4000 字自动补强)', accumulatedContent.length, `当前字数 ${accumulatedContent.length}，自动补强延展篇章以达 4000+ 字指标...`);
      const neededWords = 4200 - accumulatedContent.length;
      const extensionPrompt = `【篇章景深扩充】
当前第四幕收束后，请为本章补充一段长篇视界延伸描写（约 ${neededWords + 300} 字）：
作品：${project.title} | 题材：${project.genre} | 文风：${project.settings.literaryStyle}
依据本章既有地点、人物与情节，补充必要的场景、人物反应或过渡；不得引入其他作品的地名、人物或设定。
承接前文：“...${accumulatedContent.slice(-300)}”
必须自然衔接，扩充文本真实厚度，直接输出补充段落。`;

      const extText = await AIProviderService.generateText(project.aiConfig, {
        prompt: extensionPrompt,
        lorebookBlock,
        authorsNote,
      });
      if (extText.trim().length > 100) {
        accumulatedContent += '\n\n' + extText.trim();
        beats.push({ actIndex: 5, actName: '章节补充延展', outline: '补充本章场景与情节衔接', content: extText.trim(), wordCount: extText.trim().length });
      }
    }

    onProgress?.(6, '全章完工', accumulatedContent.length, `全章撰写完毕！实测总字数: ${accumulatedContent.length} 字。`);

    return {
      title: parsedOutline.title,
      outline: parsedOutline.summary,
      content: accumulatedContent,
      beats,
    };
  }

  private static parseMasterOutline(text: string, chapNum: number) {
    let title = '';
    let summary = '';
    const actOutlines: string[] = ['', '', '', ''];

    const lines = text.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('TITLE:')) title = trimmed.replace('TITLE:', '').trim();
      if (trimmed.startsWith('SUMMARY:')) summary = trimmed.replace('SUMMARY:', '').trim();
      if (trimmed.startsWith('ACT1:')) actOutlines[0] = trimmed.replace('ACT1:', '').trim();
      if (trimmed.startsWith('ACT2:')) actOutlines[1] = trimmed.replace('ACT2:', '').trim();
      if (trimmed.startsWith('ACT3:')) actOutlines[2] = trimmed.replace('ACT3:', '').trim();
      if (trimmed.startsWith('ACT4:')) actOutlines[3] = trimmed.replace('ACT4:', '').trim();
    });

    if (!title || !summary || actOutlines.some(outline => !outline)) throw new Error(`第${chapNum}章的 AI 生成大纲为空或不完整，请重新生成。`);
    return { title, summary, actOutlines };
  }
}
