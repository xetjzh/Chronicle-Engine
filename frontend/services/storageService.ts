import { ProjectData, WorldSnapshot, Chapter } from '../types';
import { initialProject } from './demoWorld';
import { IndexedDbService } from './indexedDbService';

const STORAGE_KEY = 'chronicle_engine_project_v1';

export const storageService = {
  loadProject(): ProjectData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveProject(initialProject);
        return initialProject;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load project from storage, falling back to demo', e);
      return initialProject;
    }
  },

  async loadProjectAsync(): Promise<ProjectData> {
    const idbData = await IndexedDbService.loadProjectData('proj_chronicle_001');
    if (idbData && idbData.chapters && idbData.chapters.length > 0) {
      return idbData;
    }
    return this.loadProject();
  },

  saveProject(project: ProjectData): void {
    // 1. Asynchronously persist to high-capacity IndexedDB (handles gigabytes, 3000+ chapters)
    IndexedDbService.saveProjectData(project).catch(err => {
      console.error('Failed to write to IndexedDB:', err);
    });

    // 2. Write light metadata snapshot to localStorage (cap chapters at latest 15 to prevent QuotaExceededError)
    try {
      const lightweight = {
        ...project,
        chapters: project.chapters.slice(-15) // Keep only recent chapters in localStorage
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
    } catch (e) {
      console.warn('LocalStorage quota limit reached; IndexedDB remains authoritative for full text.', e);
    }
  },

  exportAsJson(project: ProjectData): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.title}_完整超长篇备份_${project.chapters.length}章_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  exportChaptersAsMarkdown(project: ProjectData): void {
    let md = `# ${project.title}\n\n**总章节数**：${project.chapters.length} 章 | **总字数**：${project.chapters.reduce((a,c) => a + c.wordCount, 0)} 字\n\n---\n\n`;
    project.chapters.forEach(ch => {
      md += `## 第${ch.volumeNumber}卷 第${ch.chapterNumber}章 ${ch.title}\n\n`;
      md += `*【大纲设定】*：${ch.outline}\n\n`;
      md += `${ch.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}_全篇正文_${project.chapters.length}章.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
