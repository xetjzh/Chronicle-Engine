import type { ImportedDocument } from '../types';
import { readEpubArchive, xmlAttributes, htmlText } from './epubArchive';
const MAX_FILE = 20 * 1024 * 1024;
function baseRecord(file: File, format: ImportedDocument['format']): ImportedDocument {
  return { id: `doc_${crypto.randomUUID()}`, fileName: file.name, format, title: file.name.replace(/\.[^/.]+$/, ''), sizeBytes: file.size, importedAt: new Date().toISOString(), parsedChapters: [] };
}
export class DocumentParserService {
  static async parseTxtFile(file: File): Promise<ImportedDocument> {
    if (file.size > MAX_FILE) throw new Error('文本超过 20 MB 导入上限。');
    const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const doc = baseRecord(file, /\.md$/i.test(file.name) ? 'md' : 'txt');
    const pattern = /^[ \t]*(?:(?:#{1,6})[ \t]+(.+)|((?:第[0-9零〇两一二三四五六七八九十百千万]+[章节回卷折篇集部]|Chapter[ \t]+\d+)[^\n]*|\d{1,4}[、.·][ \t]*[^\n]{1,80}))[ \t]*$/gim;
    let last = 0, title = '序章 / 前言';
    const push = (body: string) => { if (body.trim()) doc.parsedChapters.push({ id: `doc_ch_${crypto.randomUUID()}`, title, content: body.trim() }); };
    for (const match of text.matchAll(pattern)) { push(text.slice(last, match.index)); title = (match[1] || match[2]).trim(); last = match.index! + match[0].length; }
    push(text.slice(last));
    if (!doc.parsedChapters.length) doc.parsedChapters.push({ id: `doc_ch_${crypto.randomUUID()}`, title: doc.title, content: text });
    return doc;
  }
  static async parseEpubFile(file: File): Promise<ImportedDocument> {
    const archive = await readEpubArchive(file), container = archive.get('META-INF/container.xml');
    const rootfile = container?.match(/<(?:\w+:)?rootfile\b[^>]*>/i)?.[0];
    const opfPath = rootfile && xmlAttributes(rootfile)['full-path'], opf = opfPath && archive.get(opfPath);
    if (!opf || !opfPath) throw new Error('EPUB 缺少有效的目录文件。');
    const base = new URL(opfPath, 'https://epub.local/'), manifest = new Map<string, string>();
    for (const match of opf.matchAll(/<(?:\w+:)?item\b[^>]*>/gi)) {
      const attrs = xmlAttributes(match[0]);
      if (attrs.id && attrs.href && ['application/xhtml+xml', 'text/html'].includes(attrs['media-type'])) {
        const target = new URL(attrs.href, base); if (target.origin !== base.origin) throw new Error('EPUB 包含外部正文链接，无法离线导入。');
        manifest.set(attrs.id, decodeURIComponent(target.pathname.slice(1)));
      }
    }
    const doc = baseRecord(file, 'epub');
    for (const match of opf.matchAll(/<(?:\w+:)?itemref\b[^>]*>/gi)) {
      const entry = manifest.get(xmlAttributes(match[0]).idref); if (!entry) throw new Error('EPUB 阅读顺序引用的章节不存在。');
      const html = archive.get(entry); if (!html) throw new Error('EPUB 缺少章节内容。');
      const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] || html, content = htmlText(body); if (!content) continue;
      const heading = html.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
      doc.parsedChapters.push({ id: `doc_ch_${crypto.randomUUID()}`, title: heading ? htmlText(heading) : `第 ${doc.parsedChapters.length + 1} 节`, content });
    }
    if (!doc.parsedChapters.length) throw new Error('EPUB 没有可读取的正文。'); return doc;
  }
  static async parsePdfFile(file: File): Promise<ImportedDocument> {
    if (file.size > MAX_FILE) throw new Error('PDF 超过 20 MB 导入上限。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('不是有效的 PDF 文件。');
    let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { ...baseRecord(file, 'pdf'), fileDataBase64: btoa(binary), parsedChapters: [] };
  }
  static pdfBlob(doc: ImportedDocument): Blob {
    if (!doc.fileDataBase64 || doc.fileDataBase64.length > Math.ceil(MAX_FILE / 3) * 4) throw new Error('此旧 PDF 存档缺少文件内容，请重新关联原文件。');
    let binary: string; try { binary = atob(doc.fileDataBase64); } catch { throw new Error('PDF 备份内容损坏，请重新关联原文件。'); }
    if (!binary.startsWith('%PDF-')) throw new Error('PDF 文件内容无效。');
    return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: 'application/pdf' });
  }
}
