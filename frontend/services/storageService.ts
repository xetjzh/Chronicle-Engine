import { ProjectData, WorldSnapshot } from '../types';
import { initialProject } from './demoWorld';
import { IndexedDbService } from './indexedDbService';

const STORAGE_KEY = 'chronicle_engine_project_v1';
const LOCAL_CHAPTER_LIMIT = 15;
type StoredProject = ProjectData & { __storageRevision?: number; __storageComplete?: boolean };
let lastRevision = 0;

function readLocalProject(): StoredProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.id === 'string' && Array.isArray(parsed.chapters) ? parsed : null;
  } catch (error) {
    console.warn('Local project snapshot is unavailable.', error);
    return null;
  }
}

function withoutStorageMetadata(record: StoredProject): ProjectData {
  const { __storageRevision, __storageComplete, ...project } = record;
  return project;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Let the browser start the download before releasing its backing URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const storageService = {
  loadProject(): ProjectData {
    const localProject = readLocalProject();
    // Reading initial state must not write the demo over an existing IndexedDB
    // project while asynchronous hydration is still in progress.
    return localProject ? withoutStorageMetadata(localProject) : initialProject;
  },

  async loadProjectAsync(): Promise<ProjectData> {
    const localProject = readLocalProject();
    const activeProject = await IndexedDbService.loadActiveProject();
    const newerLocalFallback = localProject?.__storageComplete &&
      (localProject.__storageRevision || 0) > (activeProject?.revision || 0);
    const activeId = activeProject && !newerLocalFallback ? activeProject.projectId : localProject?.id || initialProject.id;
    const idbData: StoredProject | null = await IndexedDbService.loadProjectData(activeId);
    if (idbData && Array.isArray(idbData.chapters)) {
      // A complete local fallback may be newer than the last successful IDB
      // write. A truncated snapshot must never replace a full saved project.
      if (localProject?.id === idbData.id && localProject.__storageComplete && (localProject.__storageRevision || 0) > (idbData.__storageRevision || 0)) {
        return withoutStorageMetadata(localProject);
      }
      return withoutStorageMetadata(idbData);
    }
    if (localProject && (localProject.__storageComplete === false ||
      (localProject.__storageComplete === undefined && localProject.chapters.length >= LOCAL_CHAPTER_LIMIT))) {
      throw new Error('完整存档暂时无法读取。请关闭其它编年引擎窗口后重试，或从完整 JSON 备份还原。');
    }
    return localProject ? withoutStorageMetadata(localProject) : initialProject;
  },

  saveProject(project: ProjectData): void {
    // Retain the existing synchronous interface for component callbacks.
    this.saveProjectAsync(project).catch(error => {
      console.error('Failed to persist the complete project:', error);
    });
  },

  async saveProjectAsync(project: ProjectData): Promise<void> {
    const previousRevision = readLocalProject()?.__storageRevision || 0;
    lastRevision = Math.max(Date.now(), lastRevision + 1, previousRevision + 1);
    const record: StoredProject = { ...project, __storageRevision: lastRevision };
    let hasCompleteLocalBackup = false;
    try {
      const snapshot: StoredProject = {
        ...record,
        chapters: project.chapters.slice(-LOCAL_CHAPTER_LIMIT),
        __storageComplete: project.chapters.length <= LOCAL_CHAPTER_LIMIT,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      hasCompleteLocalBackup = !!snapshot.__storageComplete;
    } catch (error) {
      console.warn('Local snapshot could not be written; saving the full project in IndexedDB.', error);
    }
    try {
      await IndexedDbService.saveProjectData(record);
    } catch (error) {
      if (!hasCompleteLocalBackup) throw error;
      console.warn('IndexedDB is unavailable; the complete project was saved in localStorage.', error);
    }
  },

  exportAsJson(project: ProjectData): void {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `${project.title}_完整超长篇备份_${project.chapters.length}章_${new Date().toISOString().slice(0, 10)}.json`);
  },

  exportChaptersAsMarkdown(project: ProjectData): void {
    let md = `# ${project.title}\n\n**总章节数**：${project.chapters.length} 章 | **总字数**：${project.chapters.reduce((a,c) => a + c.wordCount, 0)} 字\n\n---\n\n`;
    project.chapters.forEach(ch => {
      md += `## 第${ch.volumeNumber}卷 第${ch.chapterNumber}章 ${ch.title}\n\n`;
      md += `*【大纲设定】*：${ch.outline}\n\n`;
      md += `${ch.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${project.title}_全篇正文_${project.chapters.length}章.md`);
  },

  createSnapshot(project: ProjectData, name: string, description: string): ProjectData {
    const snapshot: WorldSnapshot = {
      id: `snap_${Date.now()}`,
      snapshotName: name || `时间节点 #${project.timeStepIndex}`,
      simulationTime: project.currentSimulationTime,
      timeStepIndex: project.timeStepIndex,
      createdAt: new Date().toLocaleString(),
      characters: JSON.parse(JSON.stringify(project.characters)),
      eventsCount: project.events.length,
      description: description || '自动保存的历史状态快照'
    };
    const updated = {
      ...project,
      snapshots: [snapshot, ...project.snapshots]
    };
    this.saveProject(updated);
    return updated;
  },

  restoreSnapshot(project: ProjectData, snapshotId: string): ProjectData {
    const snap = project.snapshots.find(s => s.id === snapshotId);
    if (!snap) return project;

    const rolledBackCharacters = JSON.parse(JSON.stringify(snap.characters));
    const rolledBackEvents = project.events.filter(e => e.timeStepIndex <= snap.timeStepIndex);

    const updated: ProjectData = {
      ...project,
      currentSimulationTime: snap.simulationTime,
      timeStepIndex: snap.timeStepIndex,
      characters: rolledBackCharacters,
      events: rolledBackEvents
    };
    this.saveProject(updated);
    return updated;
  }
};
