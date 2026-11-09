import type { ProjectData } from '../types';

export class HierarchicalMemoryService {
  // Bound every section by characters; this is context support, not a guarantee of model consistency.
  static buildRollingMemoryContext(project: ProjectData, chapterNumber: number, povCharacterId?: string): string {
    const clip = (value: unknown, max = 400) => String(value ?? '').slice(0, max);
    const previous = project.chapters.filter(c => c.chapterNumber < chapterNumber).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const pov = project.characters.find(c => c.id === povCharacterId) || project.characters[0];
    const lines = [`作品：${project.title}；世界：${clip(project.worldName, 200) || '尚未命名'}；题材：${project.genre}；文风：${project.settings.literaryStyle}；视角：${project.settings.povPreference}`,
      `作品简介：${clip(project.authorNote, 1500)}`, '【前文作者事实：不得自动视为每个人物都知晓】'];
    for (const ch of previous.slice(-2)) lines.push(`第${ch.chapterNumber}章《${clip(ch.title, 100)}》\n大纲：${clip(ch.outline)}\n正文收束：${ch.content.slice(-1600)}`);
    lines.push('【已提炼的历史摘要】');
    for (const ch of previous.filter(c => c.extraction).slice(-8)) lines.push(`第${ch.chapterNumber}章：${clip(ch.extraction!.chapterSummary)}；变化：${clip(ch.extraction!.keyStateChanges?.slice(0, 3).join('；'))}`);
    lines.push(`【当前视点人物认知边界】${pov ? `${pov.name}；性格：${clip(pov.personality, 200)}；欲望：${clip(pov.coreDesire, 200)}；目标：${clip(pov.currentGoal, 200)}` : '未指定人物'}。未获知的事实不得直接写成此人物已经知情。`);
    for (const fact of pov?.knownFacts?.slice(-12) || []) lines.push(`已知：${clip(fact.fact, 200)}`);
    lines.push('【世界硬规则】', ...project.rules.slice(0, 20).map(rule => clip(rule.rule, 200)));
    lines.push('【人物与位置】', ...project.characters.slice(0, 12).map(c => `${clip(c.name, 60)}@${project.locations.find(l => l.id === c.currentLocationId)?.name || c.currentLocationId || '未分配'}；${c.isAlive === false ? '已故' : '存活'}；${clip(c.currentMood, 40)}`));
    lines.push('【未解伏笔】', ...project.foreshadowing.filter(f => !f.isResolved).slice(0, 4).map(f => `${clip(f.title, 100)}：${clip(f.expectedResolution, 200)}`));
    return lines.join('\n').slice(0, 20000);
  }
}
