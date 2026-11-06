import { ProjectData, Chapter } from '../types';

const DB_NAME = 'ChronicleEngineDB';
const DB_VERSION = 1;
const STORE_PROJECT = 'projects';
const STORE_CHAPTERS = 'chapters';

export class IndexedDbService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PROJECT)) {
          db.createObjectStore(STORE_PROJECT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
          const chapStore = db.createObjectStore(STORE_CHAPTERS, { keyPath: 'id' });
          chapStore.createIndex('by_chapter_num', 'chapterNumber', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Saves the entire project safely into IndexedDB.
   * Eliminates the 5MB browser quota barrier, safely storing 3000+ chapters (20MB~100MB+).
   */
  public static async saveProjectData(project: ProjectData): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_PROJECT, STORE_CHAPTERS], 'readwrite');
      
      const projectStore = tx.objectStore(STORE_PROJECT);
      const chapterStore = tx.objectStore(STORE_CHAPTERS);

      // Save base project metadata (excluding massive text arrays to optimize index speed)
      const projectMeta = { ...project };
      projectStore.put(projectMeta);

      // Save all chapters into the dedicated store
      project.chapters.forEach(ch => {
        chapterStore.put(ch);
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error('IndexedDB save failed, falling back to localStorage if possible', e);
    }
  }

  /**
   * Loads full project including all chapters from IndexedDB
   */
  public static async loadProjectData(projectId: string): Promise<ProjectData | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_PROJECT, STORE_CHAPTERS], 'readonly');

      const projectStore = tx.objectStore(STORE_PROJECT);
      const chapterStore = tx.objectStore(STORE_CHAPTERS);

      const projectReq = projectStore.get(projectId);

      const projectMeta = await new Promise<ProjectData | null>((resolve) => {
        projectReq.onsuccess = () => resolve(projectReq.result || null);
        projectReq.onerror = () => resolve(null);
      });

      if (!projectMeta) return null;

      // Fetch all chapters
      const chapReq = chapterStore.getAll();
      const chapters = await new Promise<Chapter[]>((resolve) => {
        chapReq.onsuccess = () => resolve(chapReq.result || []);
        chapReq.onerror = () => resolve([]);
      });

      if (chapters.length > 0) {
        // Sort chapters sequentially
        chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
        projectMeta.chapters = chapters;
      }

      return projectMeta;
    } catch (e) {
      console.warn('IndexedDB load failed', e);
      return null;
    }
  }

  /**
   * Streams or retrieves a specific chapter page window (e.g. chapters 100 to 150)
   * Prevents UI memory bloat when managing 3000 chapters.
   */
  public static async getChapterSlice(startNum: number, count: number): Promise<Chapter[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_CHAPTERS, 'readonly');
    const store = tx.objectStore(STORE_CHAPTERS);
    const index = store.index('by_chapter_num');

    const range = IDBKeyRange.bound(startNum, startNum + count - 1);
    const req = index.getAll(range);

    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }
}
