const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadService } = require('../testSupport/loadService.cjs');
const { zip } = require('../testSupport/zipFixture.cjs');
const { DocumentParserService: parser } = loadService(path.join(__dirname, 'documentParserService.ts'));

test('F09/F24 TXT and Markdown chapter headings split with titles and imports never collide', async () => {
  const txt = await parser.parseTxtFile(new File(['序言\n第一章 初见\n正文甲\n第二章 再见\n正文乙'], 'book.txt'));
  assert.equal(txt.parsedChapters.length, 3); assert.equal(txt.parsedChapters[1].title, '第一章 初见');
  const md = await parser.parseTxtFile(new File(['# 第一章 初见\n正文甲\n## 第二章 再见\n正文乙'], 'book.md'));
  assert.equal(md.format, 'md'); assert.equal(md.parsedChapters.length, 2); assert.equal(md.parsedChapters[1].content, '正文乙');
  const ids = await Promise.all(Array.from({ length: 100 }, () => parser.parseTxtFile(new File(['x'], 'a.txt')))); assert.equal(new Set(ids.map(x => x.id)).size, 100);
});
test('F08 EPUB reads ZIP/DEFLATE contents in OPF spine order, not archive order', async () => {
  const bytes = zip([['mimetype', 'application/epub+zip', 0], ['META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'], ['OPS/book.opf', '<package><manifest><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>'], ['OPS/two.xhtml', '<html><body><h1>第二章</h1><p>第二章真实内容</p></body></html>'], ['OPS/one.xhtml', '<html><body><h1>第一章</h1><script>不应读取脚本</script><p>第一章真实内容 &amp; 注释</p></body></html>']]);
  const doc = await parser.parseEpubFile(new File([bytes], 'book.epub'));
  assert.equal(doc.parsedChapters.length, 2); assert.match(doc.parsedChapters[0].content, /第一章真实内容 & 注释/); assert.doesNotMatch(doc.parsedChapters[0].content, /不应读取脚本/); assert.match(doc.parsedChapters[1].content, /第二章真实内容/);
  await assert.rejects(parser.parseEpubFile(new File(['not-a-zip'], 'bad.epub')), /EPUB|ZIP/);
});
test('F10 PDF bytes survive JSON serialization and can recreate the original file', async () => {
  const bytes = '%PDF-1.4\nAUDIT_ORIGINAL_BYTES\n%%EOF'; const doc = await parser.parsePdfFile(new File([bytes], 'ref.pdf', { type: 'application/pdf' }));
  const stored = JSON.parse(JSON.stringify(doc)); assert.ok(stored.fileDataBase64); assert.equal(stored.fileBlobUrl, undefined);
  assert.equal(await parser.pdfBlob(stored).text(), bytes);
  await assert.rejects(parser.parsePdfFile(new File(['no-pdf'], 'wrong.pdf')), /PDF/);
});
