import type { Chapter, ProjectData, WritingDeskSettings } from '../types';

export const defaultWritingSettings: WritingDeskSettings = {
  targetDailyWords: 6000,
  currentSessionWords: 0,
  isZenMode: false,
  typewriterMode: true,
  indentParagraphs: true,
  theme: 'ink',
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: 'serif',
  soundEnabled: true,
};

export interface WritingAssistantRequest {
  projectId: string;
  chapterId: string;
  sourceContent: string;
  replaceStart: number;
  replaceEnd: number;
}

export function createWritingChapter(project: ProjectData, id: string, now: string): Chapter {
  const chapterNumber = Math.max(0, ...project.chapters.map(chapter => chapter.chapterNumber)) + 1;
  return {
    id, chapterNumber, volumeNumber: Math.ceil(chapterNumber / 100),
    title: `第${chapterNumber}章`, outline: '', content: '', wordCount: 0,
    associatedEventIds: [], createdAt: now, updatedAt: now, status: 'draft',
  };
}

export function deleteWritingChapter(
  project: ProjectData, chapterId: string, activeChapterId: string,
): { project: ProjectData; activeChapterId: string } {
  const index = project.chapters.findIndex(chapter => chapter.id === chapterId);
  if (index < 0) return { project, activeChapterId };
  const chapters = project.chapters.filter(chapter => chapter.id !== chapterId);
  const selected = chapters.find(chapter => chapter.id === activeChapterId);
  return {
    project: { ...project, chapters },
    activeChapterId: selected?.id || chapters[Math.min(index, chapters.length - 1)]?.id || '',
  };
}

export function updateWritingPreferences(project: ProjectData, patch: Partial<WritingDeskSettings>): ProjectData {
  return { ...project, deskSettings: { ...defaultWritingSettings, ...project.deskSettings, ...patch } };
}

export function formatWritingParagraphs(content: string): string {
  return content.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => `　　${line}`).join('\n\n');
}

export function writingSettingsForDay(project: ProjectData, now: string = new Date().toISOString()): WritingDeskSettings {
  const settings = { ...defaultWritingSettings, ...project.deskSettings };
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) return settings;
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return settings.lastWritingDate === day ? settings : { ...settings, lastWritingDate: day, currentSessionWords: 0 };
}

export function invalidateChapterAnalysis(chapter: Chapter): Chapter {
  const { extraction, tensionScore, actBeats, ...rest } = chapter;
  return { ...rest, status: 'draft' };
}

export function updateWritingContent(project: ProjectData, chapterId: string, content: string, now: string): ProjectData {
  const chapter = project.chapters.find(item => item.id === chapterId);
  if (!chapter) return project;
  const settings = writingSettingsForDay(project, now);
  return {
    ...project,
    chapters: project.chapters.map(item => item.id === chapterId
      ? { ...(item.content === content ? item : invalidateChapterAnalysis(item)), content, wordCount: content.length, updatedAt: now }
      : item),
    deskSettings: {
      ...settings,
      currentSessionWords: settings.currentSessionWords + Math.max(0, content.length - chapter.content.length),
    },
  };
}

export function applyWritingAssistantResult(
  project: ProjectData, request: WritingAssistantRequest, generated: string, now: string,
): { applied: true; project: ProjectData } | { applied: false } {
  const chapter = project.chapters.find(item => item.id === request.chapterId);
  if (project.id !== request.projectId || !chapter || chapter.content !== request.sourceContent) {
    return { applied: false };
  }
  const content = chapter.content.slice(0, request.replaceStart) + generated + chapter.content.slice(request.replaceEnd);
  return { applied: true, project: updateWritingContent(project, chapter.id, content, now) };
}
