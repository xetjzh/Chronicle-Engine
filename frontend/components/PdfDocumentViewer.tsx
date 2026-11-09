import React, { useEffect, useRef, useState } from 'react';
import type { ImportedDocument } from '../types';
import { DocumentParserService } from '../services/documentParserService';

export function PdfDocumentViewer({ document: doc, onRelink }: { document: ImportedDocument; onRelink: (doc: ImportedDocument) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const latest = useRef(onRelink); latest.current = onRelink;
  useEffect(() => {
    generation.current++; setUrl(''); setError(''); setBusy(false);
    let resource = '';
    try { resource = URL.createObjectURL(DocumentParserService.pdfBlob(doc)); setUrl(resource); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'PDF 无法读取，请重新关联。'); }
    return () => { generation.current++; if (resource) URL.revokeObjectURL(resource); };
  }, [doc.id, doc.fileDataBase64]);
  const relink = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
    const run = generation.current; setBusy(true); setError('');
    try {
      const parsed = await DocumentParserService.parsePdfFile(file);
      if (run === generation.current) latest.current({ ...doc, ...parsed, id: doc.id, excerpts: doc.excerpts, category: doc.category, tags: doc.tags });
    } catch (failure) { if (run === generation.current) setError(failure instanceof Error ? failure.message : '关联失败。'); }
    finally { if (run === generation.current) setBusy(false); }
  };
  return <section aria-label="PDF 参考阅读" className="flex min-h-80 flex-1 flex-col gap-3 text-xs">
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    <label className="block">{busy ? '正在保存 PDF…' : '重新关联 PDF（原文件内容将随项目备份保存）'}<input aria-label="重新关联 PDF" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={relink} className="block mt-2 max-w-full" /></label>
    {url && <><a href={url} target="_blank" rel="noopener noreferrer" className="text-purple-300 underline">独立打开 PDF</a><iframe title={doc.title} src={url} className="min-h-96 w-full flex-1 rounded border border-slate-700" /></>}
  </section>;
}
