import { ProjectData, WorldSnapshot } from '../types';
import { IndexedDbService } from './indexedDbService';
import { createEmptyProject } from './projectFactory';

const STORAGE_KEY = 'chronicle_engine_project_v1';
const LOCAL_CHAPTER_LIMIT = 15;
type StoredProject = ProjectData & { __storageRevision?: number; __storageComplete?: boolean };
let lastRevision = 0;
let writeQueue: Promise<unknown> = Promise.resolve();
function queueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => {});
  return result;
}

export interface BookSummary { id: string; title: string; chapterCount: number; wordCount: number }

function recordFor(project: ProjectData): StoredProject {
  lastRevision = Math.max(Date.now(), lastRevision + 1, readLocalProject()?.__storageRevision || 0);
  return { ...project, __storageRevision: lastRevision };
}
function retainLocalSnapshot(record: StoredProject) {
  try {
    if ((readLocalProject()?.__storageRevision || 0) > (record.__storageRevision || 0)) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...record, chapters: record.chapters.slice(-LOCAL_CHAPTER_LIMIT), __storageComplete: record.chapters.length <= LOCAL_CHAPTER_LIMIT }));
    return true;
  } catch { return false; }
}

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
    return localProject ? withoutStorageMetadata(localProject) : createEmptyProject('proj_first_book');
  },

  async loadProjectAsync(): Promise<ProjectData> {
    const localProject = readLocalProject();
    const activeProject = await IndexedDbService.loadActiveProject();
    const newerLocalFallback = localProject?.__storageComplete &&
      (localProject.__storageRevision || 0) > (activeProject?.revision || 0);
    const activeId = activeProject && !newerLocalFallback ? activeProject.projectId : localProject?.id || 'proj_chronicle_001';
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
    if (activeProject && activeId === activeProject.projectId) throw new Error('当前作品的完整存档暂时无法读取，请重试或还原备份。');
    return localProject ? withoutStorageMetadata(localProject) : createEmptyProject('proj_first_book');
  },

  async listProjectsAsync(): Promise<BookSummary[]> {
    const records = await IndexedDbService.listProjectData();
    return records.map(record => ({ id: record.id, title: record.title, chapterCount: record.chapters.length,
      wordCount: record.chapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0) }));
  },

  async loadSavedProjectAsync(id: string): Promise<ProjectData> {
    const record = await IndexedDbService.loadProjectData(id);
    if (!record) throw new Error('作品暂时无法读取；当前作品仍保留，请重试或还原备份。');
    return withoutStorageMetadata(record);
  },

  async activateProjectAsync(current: ProjectData, next: ProjectData): Promise<void> {
    const oldRecord = recordFor(current);
    const nextRecord = recordFor(next);
    return queueWrite(async () => {
      // A single local fallback cannot retain two books. Book transitions must
      // durably retain the full current manuscript before replacing its pointer.
      await IndexedDbService.saveProjectData(oldRecord);
      retainLocalSnapshot(oldRecord);
      await IndexedDbService.saveProjectData(nextRecord);
      retainLocalSnapshot(nextRecord);
    });
  },

  saveProject(project: ProjectData): void {
    // Retain the existing synchronous interface for component callbacks.
    this.saveProjectAsync(project).catch(error => {
      console.error('Failed to persist the complete project:', error);
    });
  },

  async saveProjectAsync(project: ProjectData): Promise<void> {
    // Capture the fallback before yielding: pagehide cannot wait for a queued
    // transaction. Only IndexedDB work is serialized; newer snapshots win.
    const record = recordFor(project);
    const hasCompleteLocalBackup = retainLocalSnapshot(record) && project.chapters.length <= LOCAL_CHAPTER_LIMIT;
    return queueWrite(async () => {
      try {
        await IndexedDbService.saveProjectData(record);
      } catch (error) {
        if (!hasCompleteLocalBackup) throw error;
        console.warn('IndexedDB is unavailable; the complete project was saved in localStorage.', error);
      }
    });
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
      id: `snap_${crypto.randomUUID()}`,
      snapshotName: name || `时间节点 #${project.timeStepIndex}`,
      simulationTime: project.currentSimulationTime,
      timeStepIndex: project.timeStepIndex,
      createdAt: new Date().toLocaleString(),
      characters: JSON.parse(JSON.stringify(project.characters)),
      events: JSON.parse(JSON.stringify(project.events)),
      worldState: JSON.parse(JSON.stringify({ worldName: project.worldName, locations: project.locations, factions: project.factions, rules: project.rules, foreshadowing: project.foreshadowing })),
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
    const rolledBackEvents = JSON.parse(JSON.stringify(snap.events || project.events.filter(e => e.timeStepIndex <= snap.timeStepIndex))) as ProjectData['events'];
    const world = snap.worldState ? JSON.parse(JSON.stringify(snap.worldState)) as NonNullable<WorldSnapshot['worldState']> : {
      worldName: project.worldName, locations: project.locations, factions: project.factions, rules: project.rules, foreshadowing: project.foreshadowing,
    };
    const locationIds = new Set(world.locations.map(l => l.id)), factionIds = new Set(world.factions.map(f => f.id));
    const characterIds = new Set<string>(rolledBackCharacters.map((c: ProjectData['characters'][number]) => c.id));
    const eventIds = new Set(rolledBackEvents.map(e => e.id));
    for (const c of rolledBackCharacters) {
      if (!locationIds.has(c.currentLocationId)) c.currentLocationId = '';
      if (!factionIds.has(c.factionId)) c.factionId = '';
      c.relationships = Object.fromEntries(Object.entries(c.relationships).filter(([id]) => characterIds.has(id)));
      c.knownFacts = c.knownFacts.map((fact: ProjectData['characters'][number]['knownFacts'][number]) => ({ ...fact, sourceEventId: fact.sourceEventId && eventIds.has(fact.sourceEventId) ? fact.sourceEventId : undefined }));
    }
    for (const event of rolledBackEvents) {
      if (!locationIds.has(event.locationId)) event.locationId = '';
      event.participantIds = event.participantIds.filter(id => characterIds.has(id));
      event.visibility.knownByCharacterIds = event.visibility.knownByCharacterIds.filter(id => characterIds.has(id));
      event.causeEventIds = event.causeEventIds.filter(id => eventIds.has(id));
      event.stateChanges = event.stateChanges.filter(change => characterIds.has(change.characterId));
    }

    const updated: ProjectData = {
      ...project,
      currentSimulationTime: snap.simulationTime,
      timeStepIndex: snap.timeStepIndex,
      ...world,
      foreshadowing: world.foreshadowing.map(clue => ({ ...clue, relatedCharacterIds: clue.relatedCharacterIds.filter(id => characterIds.has(id)) })),
      characters: rolledBackCharacters,
      chapters: project.chapters.map(ch => ({ ...ch, povCharacterId: ch.povCharacterId && characterIds.has(ch.povCharacterId) ? ch.povCharacterId : undefined, associatedEventIds: ch.associatedEventIds.filter(id => eventIds.has(id)) })),
      events: rolledBackEvents
    };
    this.saveProject(updated);
    return updated;
  }
};
