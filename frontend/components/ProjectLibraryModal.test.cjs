const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mountComponent } = require('../testSupport/mountComponent.cjs');
const { createEmptyProject } = require('../services/projectFactory.ts');
const file = path.join(__dirname, 'ProjectLibraryModal.tsx');
function mount(activate = async () => {}) {
  const current = createEmptyProject('old', { title: '旧作品' });
  current.chapters.push({ id: 'kept', content: '私人原稿', wordCount: 4 });
  return mountComponent(file, 'ProjectLibraryModal', { project: current, onActivate: activate, onClose() {} }, {
    '../services/storageService': { storageService: {
      listProjectsAsync: async () => [{ id: 'another', title: '另一部作品', chapterCount: 0, wordCount: 0 }],
      loadSavedProjectAsync: async () => createEmptyProject('another', { title: '另一部作品' }),
    } },
  });
}
test('new book form activates a blank independent manuscript and switching chooses a stored book', async () => {
  const activated = [];
  const ui = mount(async (...args) => activated.push(args));
  await ui.flush();
  ui.change('新书书名', '新的星际故事');
  ui.change('新书题材', '科幻');
  ui.change('新书简介', '寻找失联的飞船');
  await ui.click('创建空白作品');
  assert.equal(activated[0][0].title, '新的星际故事');
  assert.equal(activated[0][0].authorNote, '寻找失联的飞船');
  assert.equal(activated[0][0].chapters.length, 0);
  assert.notEqual(activated[0][0].id, 'old');
  await ui.flush();
  await ui.click('切换到：另一部作品');
  assert.equal(activated[1][0].id, 'another');
});
test('creation failure leaves the dialog open and shows storage error for retry', async () => {
  const ui = mount(async () => { throw new Error('存储空间不足'); });
  ui.change('新书书名', '新书');
  await ui.click('创建空白作品');
  await ui.flush();
  assert.match(ui.text(), /存储空间不足/);
  assert.equal(ui.button('创建空白作品').props.disabled, false);
});
