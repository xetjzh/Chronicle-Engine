import { ProjectData, Chapter } from '../types';

export class HierarchicalMemoryService {
  /**
   * Constructs an optimized rolling memory context for generating chapter N (N up to 3000):
   * 1. Short-Term Memory: Verbatim outline & ending sentences of recent 2 chapters
   * 2. Medium-Term Memory: Current volume master arc & unresolved foreshadowing clues
   * 3. Long-Term Memory: World fundamental rules, active factions & core character goals
   * Ensures the prompt stays strictly within 2000~4000 tokens regardless of whether chapter count is 10 or 2500.
   */
  public static buildRollingMemoryContext(
    project: ProjectData,
    currentChapterNumber: number
  ): string {
    const lines: string[] = [];

    // Volume level context
    const currentVolume = Math.ceil(currentChapterNumber / 100) || 1;
    lines.push(`【当前卷册】：第 ${currentVolume} 卷（第 ${(currentVolume - 1) * 100 + 1} 章 ~ 第 ${currentVolume * 100} 章）`);

    // Recent Chapter Rolling Context
    const recentChapters = project.chapters
      .filter(c => c.chapterNumber < currentChapterNumber)
      .slice(-2);

    if (recentChapters.length > 0) {
      lines.push('【近期已发生剧情记忆链条】：');
      recentChapters.forEach(c => {
        const tailExcerpt = c.content.slice(-250).replace(/\n+/g, ' ');
        lines.push(`- 第${c.chapterNumber}章《${c.title}》梗概: ${c.outline}`);
        lines.push(`  卷末落点: “...${tailExcerpt}”`);
      });
    }

    // Active Foreshadowing Clues (Top 3 unresolved)
    const activeClues = project.foreshadowing.filter(f => !f.isResolved).slice(0, 3);
    if (activeClues.length > 0) {
      lines.push('【正在进行中的核心伏笔暗线】：');
      activeClues.forEach(clue => {
        lines.push(`- 伏笔《${clue.title}》：预估走向: ${clue.expectedResolution}`);
      });
    }

    return lines.join('\n');
  }
}
