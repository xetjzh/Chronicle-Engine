// Bounded ZIP/DEFLATE reader; imported HTML is converted to text, never executed.
const MAX_FILE = 20 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024;
export async function readEpubArchive(file: File): Promise<Map<string, string>> {
  if (file.size > MAX_FILE) throw new Error('EPUB 超过 20 MB 导入上限。');
  const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer), decoder = new TextDecoder();
  const error = () => new Error('EPUB ZIP 结构损坏或使用不支持的压缩格式。');
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw error();
  const count = view.getUint16(end + 10, true), directoryEnd = view.getUint32(end + 16, true) + view.getUint32(end + 12, true);
  let cursor = view.getUint32(end + 16, true), total = 0;
  if (count > 5000 || directoryEnd > end) throw error();
  const entries = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directoryEnd || view.getUint32(cursor, true) !== 0x02014b50) throw error();
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true), crcExpected = view.getUint32(cursor + 16, true);
    const packed = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true), nameLen = view.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLen + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true), offset = view.getUint32(cursor + 42, true);
    if (next > directoryEnd || size > MAX_FILE || packed > MAX_FILE || (flags & 1) || ![0, 8].includes(method) || offset + 30 > bytes.length) throw error();
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen)); cursor = next;
    if (!/\.(?:xml|opf|xhtml|html|htm)$/i.test(name)) continue;
    if (entries.has(name) || name.startsWith('/') || name.split('/').includes('..') || name.includes('\\')) throw error();
    if (view.getUint32(offset, true) !== 0x04034b50) throw error();
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    if (start + packed > bytes.length) throw error();
    let data: Uint8Array;
    if (method === 0) data = bytes.slice(start, start + packed);
    else {
      let stream: DecompressionStream;
      try { stream = new DecompressionStream('deflate-raw'); }
      catch { throw new Error('当前浏览器不支持 EPUB 解压，请更新浏览器或改用 TXT。'); }
      const reader = new Blob([bytes.slice(start, start + packed)]).stream().pipeThrough(stream).getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length;
          if (length > size || total + length > MAX_TOTAL) throw error(); chunks.push(part.value); }
      } catch (cause) { await reader.cancel().catch(() => {}); throw new Error('EPUB 解压失败或内容超出上限。', { cause }); }
      data = new Uint8Array(length); let position = 0; for (const part of chunks) { data.set(part, position); position += part.length; }
    }
    total += data.length; if (data.length !== size || total > MAX_TOTAL) throw error();
    let crc = -1; for (const value of data) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    if (((crc ^ -1) >>> 0) !== crcExpected) throw error();
    entries.set(name, decoder.decode(data));
  }
  return entries;
}
export function decodeXml(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] || match;
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
  });
}
export function xmlAttributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1], decodeXml(m[3])]));
}
export function htmlText(html: string): string {
  return decodeXml(html.replace(/<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi, '')
    .replace(/<(?:\/p|\/div|\/h[1-6]|br|\/li|\/section)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}
