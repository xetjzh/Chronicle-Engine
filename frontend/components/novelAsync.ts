import type { Chapter, ProjectData } from '../types';

interface NovelChapterSnapshot { projectId: string; chapterId: string; fingerprint: string }

export function captureNovelChapter(project: ProjectData, chapterId: string): NovelChapterSnapshot | null {
  const chapter = project.chapters.find(item => item.id === chapterId);
  return chapter ? { projectId: project.id, chapterId, fingerprint: JSON.stringify(chapter) } : null;
}

export function applyNovelChapterPatch(project: ProjectData, snapshot: NovelChapterSnapshot | null, patch: Partial<Chapter>): ProjectData | null {
  if (!snapshot || project.id !== snapshot.projectId) return null;
  const chapter = project.chapters.find(item => item.id === snapshot.chapterId);
  if (!chapter || JSON.stringify(chapter) !== snapshot.fingerprint) return null;
  const changedProse = patch.content !== undefined && patch.content !== chapter.content;
  const base = changedProse ? { ...chapter, extraction: undefined, tensionScore: undefined, actBeats: undefined, generationCheckpoint: undefined, status: 'draft' as const } : chapter;
  return { ...project, chapters: project.chapters.map(item => item.id === chapter.id ? { ...base, ...patch, id: item.id } : item) };
}

export async function runNovelBatch(options: {
  targetCount: number;
  readProject: () => ProjectData;
  isCancelled: () => boolean;
  generate: (project: ProjectData, index: number) => Promise<ProjectData>;
  commit: (project: ProjectData, completed: number) => void;
  onConflict?: (project: ProjectData) => void;
  onError?: (message: string) => void;
}): Promise<{ completed: number; errors: string[]; stopped: boolean }> {
  let completed = 0;
  const errors: string[] = [];
  let stopped = false;
  for (let index = 0; index < options.targetCount; index++) {
    if (options.isCancelled()) { stopped = true; break; }
    const source = options.readProject();
    const fingerprint = JSON.stringify(source);
    try {
      const output = await options.generate(source, index);
      if (options.isCancelled()) { stopped = true; break; }
      if (JSON.stringify(options.readProject()) !== fingerprint) {
        errors.push('创作期间作品发生变化，批处理已停止。');
        options.onConflict?.(output);
        stopped = true;
        break;
      }
      options.commit(output, completed + 1);
      completed++;
    } catch (error) {
      if (options.isCancelled()) { stopped = true; break; }
      const message = `第 ${index + 1} 次创作失败：${error instanceof Error ? error.message : '模型请求未完成'}`;
      errors.push(message);
      options.onError?.(message);
    }
  }
  return { completed, errors, stopped };
}
