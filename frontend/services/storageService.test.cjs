const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transform } = require('sucrase');

const storageKey = 'chronicle_engine_project_v1';
const chapter = (id, chapterNumber = 1) => ({ id, chapterNumber, volumeNumber: 1, title: id, content: id, wordCount: 1 });
const project = (id, chapters = []) => ({ id, title: id, worldName: id, chapters });

// Only the browser storage boundary is simulated; every service method under test
// is loaded from the real TypeScript implementation without generating files.
function services({ projects = [], chapters = [], localProject, failWrites = false, failLocal = false, failOpen = false } = {}) {
  const records = { projects: new Map(projects.map(p => [p.id, structuredClone(p)])), chapters: new Map(chapters.map(c => [c.id, structuredClone(c)])), settings: new Map() };
  const local = new Map(localProject ? [[storageKey, JSON.stringify(localProject)]] : []);
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        if (failOpen) {
          request.error = new Error('IndexedDB unavailable');
          request.onerror?.();
          return;
        }
        request.result = {
          transaction(names, mode) {
            const tx = {};
            tx.objectStore = name => ({
              put(value) { if (!failWrites) records[name].set(value.id, structuredClone(value)); },
              get(id) { return read(() => records[name].get(id)); },
              getAll() { return read(() => [...records[name].values()]); },
              index() { return { getAll: range => read(() => [...records[name].values()].filter(c => c.chapterNumber >= range.lower && c.chapterNumber <= range.upper)) }; },
            });
            if (mode === 'readwrite') queueMicrotask(() => {
              if (failWrites) {
                tx.error = new Error('Disk quota exceeded');
                tx.onerror?.();
                tx.onabort?.();
              } else tx.oncomplete?.();
            });
            return tx;
          },
        };
        request.onsuccess?.();
      });
      return request;
    },
  };
  function read(getValue) {
    const request = {};
    queueMicrotask(() => { request.result = structuredClone(getValue()); request.onsuccess?.(); });
    return request;
  }
  const downloads = [];
  const blobs = [];
  const revoked = [];
  const timers = [];
  const environment = {
    indexedDB, Blob, IDBKeyRange: { bound: (lower, upper) => ({ lower, upper }) },
    localStorage: {
      getItem: key => local.get(key) ?? null,
      setItem(key, value) { if (failLocal) throw new Error('Local quota exceeded'); local.set(key, value); },
    },
    console: { error() {}, warn() {} },
    URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:export'; }, revokeObjectURL: url => revoked.push(url) },
    document: {
      body: { appendChild() {} },
      createElement: () => ({ setAttribute(name, value) { this[name] = value; }, click() { downloads.push(this.href); }, remove() {} }),
    },
    setTimeout: callback => { timers.push(callback); },
  };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(__dirname, filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const output = transform(fs.readFileSync(filename, 'utf8'), { transforms: ['typescript', 'imports'] }).code;
    const evaluate = vm.runInNewContext(`(function(require, module, exports) { ${output}\n})`, environment, { filename });
    evaluate(specifier => load(`${specifier}.ts`), module, module.exports);
    return module.exports;
  }
  return { ...load('indexedDbService.ts'), ...load('storageService.ts'), records, local, downloads, blobs, revoked, timers };
}

test('reloading a saved project does not resurrect chapters removed by a backup restore', async () => {
  const { IndexedDbService } = services();
  await IndexedDbService.saveProjectData(project('a', [chapter('kept'), chapter('removed', 2)]));
  await IndexedDbService.saveProjectData(project('a', [chapter('kept')]));
  const loaded = await IndexedDbService.loadProjectData('a');
  assert.deepEqual(Array.from(loaded.chapters, c => c.id), ['kept']);
});

test('project loading preserves its chapter membership and saved order', async () => {
  const { IndexedDbService } = services({
    projects: [project('a', [chapter('second', 2), chapter('first')]), project('b', [chapter('other')])],
    chapters: [chapter('first'), chapter('second', 2), chapter('other')],
  });
  const loaded = await IndexedDbService.loadProjectData('a');
  assert.deepEqual(Array.from(loaded.chapters, c => c.id), ['second', 'first']);
});

test('an empty saved project does not inherit another project chapters', async () => {
  const { IndexedDbService } = services({ projects: [project('empty')], chapters: [chapter('other')] });
  assert.equal((await IndexedDbService.loadProjectData('empty')).chapters.length, 0);
});

test('chapter windows only include chapters saved in the requested project', async () => {
  const { IndexedDbService } = services({
    projects: [project('a', [chapter('first'), chapter('second', 2)])],
    chapters: [chapter('unrelated', 2)],
  });
  assert.deepEqual(Array.from(await IndexedDbService.getChapterSlice(2, 1, 'a'), c => c.id), ['second']);
});

test('IndexedDB writes reject when the transaction fails', async () => {
  const { IndexedDbService } = services({ failWrites: true });
  await assert.rejects(IndexedDbService.saveProjectData(project('a')), /quota exceeded/);
});

test('IndexedDB writes reject when opening the database fails', async () => {
  const { IndexedDbService } = services({ failOpen: true });
  await assert.rejects(IndexedDbService.saveProjectData(project('a')), /unavailable/);
});

test('async hydration uses the active local project id and restores an empty project', async () => {
  const { storageService } = services({
    localProject: project('imported', [chapter('outdated')]),
    projects: [project('imported'), project('proj_chronicle_001', [chapter('unrelated')])],
  });
  const loaded = await storageService.loadProjectAsync();
  assert.equal(loaded.id, 'imported');
  assert.equal(loaded.chapters.length, 0);
});

test('initial synchronous loading cannot overwrite a full IndexedDB project', async () => {
  const stored = project('proj_chronicle_001', [chapter('actual-writing')]);
  const { storageService, records, local } = services({ projects: [stored] });
  storageService.loadProject();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(records.projects.get(stored.id).chapters[0].id, 'actual-writing');
  assert.equal(local.size, 0);
  assert.equal((await storageService.loadProjectAsync()).chapters[0].id, 'actual-writing');
});

test('async save rejects when only a truncated local backup survives', async () => {
  const { storageService, local } = services({ failWrites: true });
  const longProject = project('a', Array.from({ length: 16 }, (_, i) => chapter(`c${i}`, i + 1)));
  await assert.rejects(storageService.saveProjectAsync(longProject), /quota exceeded/);
  assert.equal(JSON.parse(local.get(storageKey)).chapters.length, 15);
});

test('async save accepts a complete local fallback when IndexedDB is unavailable', async () => {
  const { storageService, local } = services({ failWrites: true, projects: [project('a', [chapter('old')])] });
  await storageService.saveProjectAsync(project('a', [chapter('complete')]));
  assert.equal(JSON.parse(local.get(storageKey)).chapters[0].id, 'complete');
  const reloaded = await storageService.loadProjectAsync();
  assert.equal(reloaded.chapters[0].id, 'complete');
  assert.deepEqual(Object.keys(reloaded).sort(), ['chapters', 'id', 'title', 'worldName']);
});

test('a failed local snapshot does not prevent complete IndexedDB saving and hydration', async () => {
  const { storageService } = services({ localProject: project('a', [chapter('old')]), failLocal: true });
  await storageService.saveProjectAsync(project('a', [chapter('new')]));
  assert.equal((await storageService.loadProjectAsync()).chapters[0].id, 'new');
});

test('a newly imported project remains active when localStorage cannot update its old project id', async () => {
  const { storageService } = services({ localProject: project('a'), projects: [project('a')], failLocal: true });
  await storageService.saveProjectAsync(project('b', [chapter('new-book')]));
  const reloaded = await storageService.loadProjectAsync();
  assert.equal(reloaded.id, 'b');
  assert.equal(reloaded.chapters[0].id, 'new-book');
});

test('IndexedDB alone can restore the last saved project when localStorage is unavailable', async () => {
  const { storageService } = services({ failLocal: true });
  await storageService.saveProjectAsync(project('offline-book', [chapter('kept')]));
  assert.equal((await storageService.loadProjectAsync()).id, 'offline-book');
});

test('an unavailable full manuscript cannot be silently replaced by a truncated local snapshot', async () => {
  const localProject = { ...project('long-book', Array.from({ length: 15 }, (_, i) => chapter(`c${i}`))), __storageComplete: false };
  const { storageService } = services({ localProject, failOpen: true });
  await assert.rejects(storageService.loadProjectAsync(), /完整存档/);
});

test('async save rejects when neither browser store can retain the project', async () => {
  const { storageService } = services({ failWrites: true, failLocal: true });
  await assert.rejects(storageService.saveProjectAsync(project('a')), /quota exceeded/);
});

test('Markdown export releases its temporary URL after starting the download', () => {
  const { storageService, downloads, revoked, timers } = services();
  storageService.exportChaptersAsMarkdown(project('a', [chapter('text')]));
  assert.deepEqual(downloads, ['blob:export']);
  for (const timer of timers) timer();
  assert.deepEqual(revoked, ['blob:export']);
});

test('JSON export retains chapter content and releases its temporary download URL', async () => {
  const { storageService, downloads, blobs, revoked, timers } = services();
  storageService.exportAsJson(project('a', [chapter('text')]));
  assert.deepEqual(downloads, ['blob:export']);
  assert.equal(JSON.parse(await blobs[0].text()).chapters[0].content, 'text');
  for (const timer of timers) timer();
  assert.deepEqual(revoked, ['blob:export']);
});
