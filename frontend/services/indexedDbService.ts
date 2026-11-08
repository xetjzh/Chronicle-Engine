import { ProjectData, Chapter } from '../types';

const DB_NAME = 'ChronicleEngineDB';
const DB_VERSION = 2;
const STORE_PROJECT = 'projects';
const STORE_SETTINGS = 'settings';
const ACTIVE_PROJECT = 'active-project';

interface ActiveProjectRecord { id: string; projectId: string; revision: number }

export class IndexedDbService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      let failed = false;

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PROJECT)) {
          db.createObjectStore(STORE_PROJECT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (failed) { db.close(); return; }
        db.onversionchange = () => { db.close(); this.dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => {
        failed = true;
        this.dbPromise = null;
        reject(request.error);
      };
      request.onblocked = () => {
        failed = true;
        this.dbPromise = null;
        reject(new Error('请关闭其它编年引擎窗口后重试读取存档。'));
      };
    });

    return this.dbPromise;
  }

  /**
   * The project record already contains its full chapter list. Save it atomically
   * as the authority for chapter membership, including an intentionally empty list.
   */
  public static async saveProjectData(project: ProjectData): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction([STORE_PROJECT, STORE_SETTINGS], 'readwrite');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
      tx.objectStore(STORE_PROJECT).put(project);
      // Commit the activity pointer with the manuscript, even if localStorage
      // is full or blocked. A successful save must remain discoverable.
      tx.objectStore(STORE_SETTINGS).put({
        id: ACTIVE_PROJECT,
        projectId: project.id,
        revision: (project as ProjectData & { __storageRevision?: number }).__storageRevision || Date.now(),
      } satisfies ActiveProjectRecord);
    });
  }

  public static async loadActiveProject(): Promise<ActiveProjectRecord | null> {
    try {
      const db = await this.getDB();
      const request = db.transaction(STORE_SETTINGS, 'readonly').objectStore(STORE_SETTINGS).get(ACTIVE_PROJECT);
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Loads full project including all chapters from IndexedDB
   */
  public static async loadProjectData(projectId: string): Promise<ProjectData | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_PROJECT, 'readonly');
      const projectReq = tx.objectStore(STORE_PROJECT).get(projectId);
      return await new Promise<ProjectData | null>((resolve, reject) => {
        projectReq.onsuccess = () => resolve(projectReq.result || null);
        projectReq.onerror = () => reject(projectReq.error);
      });
    } catch (e) {
      console.warn('IndexedDB load failed', e);
      return null;
    }
  }

  public static async listProjectData(): Promise<ProjectData[]> {
    const db = await this.getDB();
    const request = db.transaction(STORE_PROJECT, 'readonly').objectStore(STORE_PROJECT).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('无法读取作品列表。'));
    });
  }

  /**
   * Retrieves a chapter-number window from one saved project. The project ID is
   * explicit so legacy chapter-store entries cannot leak across projects.
   */
  public static async getChapterSlice(startNum: number, count: number, projectId: string): Promise<Chapter[]> {
    if (count <= 0) return [];
    const project = await this.loadProjectData(projectId);
    return (project?.chapters || []).filter(ch => ch.chapterNumber >= startNum && ch.chapterNumber < startNum + count);
  }
}
