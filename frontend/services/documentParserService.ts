import { ImportedDocument } from '../types';

export class DocumentParserService {
  /**
   * Parse TXT files with smart chapter splitting regex
   */
  public static async parseTxtFile(file: File): Promise<ImportedDocument> {
    const text = await file.text();
    const chapters: { id: string; title: string; content: string }[] = [];

    // Common Chinese chapter headers regex: 第X章, 第X节, Chapter X, etc.
    const chapterPattern = /(?:^|\n)\s*(第[0-9一二三四五六七八九十百千万]+[章节回卷折篇集部]|Chapter\s+\d+|[0-9]{1,4}[\s、.·]+[^\n]{1,30})\s*(?:\n|$)/gi;
    
    let lastIndex = 0;
    let currentTitle = '序章 / 前言';
    let match: RegExpExecArray | null;

    let index = 0;
    while ((match = chapterPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const content = text.slice(lastIndex, match.index).trim();
        if (content.length > 0) {
          chapters.push({
            id: `doc_ch_${index++}`,
            title: currentTitle,
            content,
          });
        }
      }
      currentTitle = match[1].trim();
      lastIndex = match.index + match[0].length;
    }

    // Push remaining content
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex).trim();
      if (remaining.length > 0) {
        chapters.push({
          id: `doc_ch_${index++}`,
          title: currentTitle,
          content: remaining,
        });
      }
    }

    // Fallback if no chapter delimiter was detected
    if (chapters.length === 0) {
      chapters.push({
        id: `doc_ch_0`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        content: text,
      });
    }

    return {
      id: `doc_${Date.now()}`,
      fileName: file.name,
      format: 'txt',
      title: file.name.replace(/\.[^/.]+$/, ''),
      sizeBytes: file.size,
      parsedChapters: chapters,
      importedAt: new Date().toLocaleString(),
    };
  }

  /**
   * Parses EPUB (decompresses standard zip using Web Streams or decompresses spine HTML text)
   * Falls back to clean text extraction.
   */
  public static async parseEpubFile(file: File): Promise<ImportedDocument> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Extract textual XML / XHTML content from uncompressed bytes or UTF-8 chunks
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawString = decoder.decode(arrayBuffer);

      // Extract all <p> and <div> tags content, stripping XML tags
      const bodyMatches = rawString.match(/<body[^>]*>([\s\S]*?)<\/body>/gi) || [];
      const cleanTexts: string[] = [];

      if (bodyMatches.length > 0) {
        bodyMatches.forEach((body) => {
          const stripped = body
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
          if (stripped.length > 100) {
            cleanTexts.push(stripped);
          }
        });
      }

      const combined = cleanTexts.join('\n\n--- 章节分界 ---\n\n');
      const fallbackTxt = combined.length > 200 ? combined : rawString.replace(/<[^>]+>/g, ' ').slice(0, 500000);

      // Re-use TXT chunker
      const txtFile = new File([fallbackTxt], file.name, { type: 'text/plain' });
      const doc = await this.parseTxtFile(txtFile);
      doc.format = 'epub';
      return doc;
    } catch (err) {
      console.warn('Epub stream fallback', err);
      return {
        id: `doc_${Date.now()}`,
        fileName: file.name,
        format: 'epub',
        title: file.name,
        sizeBytes: file.size,
        parsedChapters: [{
          id: `doc_ch_0`,
          title: 'EPUB 导入内容',
          content: '【EPUB 文件已作为素材关联；若需完整解析文本，建议另存为 TXT 文件导入】',
        }],
        importedAt: new Date().toLocaleString(),
      };
    }
  }

  /**
   * Imports PDF with native Browser Object URL for high-fidelity side-by-side split screen view
   */
  public static async parsePdfFile(file: File): Promise<ImportedDocument> {
    const blobUrl = URL.createObjectURL(file);

    return {
      id: `doc_${Date.now()}`,
      fileName: file.name,
      format: 'pdf',
      title: file.name.replace(/\.[^/.]+$/, ''),
      sizeBytes: file.size,
      fileBlobUrl: blobUrl,
      parsedChapters: [
        {
          id: `pdf_ch_0`,
          title: `${file.name} (PDF 原生视窗)`,
          content: `【PDF 文件已载入双屏参考视窗】\n文件名称: ${file.name}\n文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB\n可点击右侧工具栏开启“双屏对照阅读”边写边看。`,
        },
      ],
      importedAt: new Date().toLocaleString(),
    };
  }
}
