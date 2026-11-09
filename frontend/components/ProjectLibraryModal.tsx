import React, { useEffect, useRef, useState } from 'react';
import type { CreationMode, ProjectData } from '../types';
import { Dialog } from './Dialog';
import { storageService, type BookSummary } from '../services/storageService';
import { createEmptyProject } from '../services/projectFactory';

interface Props {
  project: ProjectData;
  onActivate: (next: ProjectData, mode?: CreationMode) => Promise<void>;
  onClose: () => void;
}

export function ProjectLibraryModal({ project, onActivate, onClose }: Props) {
  const titleId = React.useId();
  const mounted = useRef(true);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [premise, setPremise] = useState('');
  const [copyConnection, setCopyConnection] = useState(true);
  const [mode, setMode] = useState<CreationMode>('CO_WRITING');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [currentTitle, setCurrentTitle] = useState(project.title);
  const [currentGenre, setCurrentGenre] = useState(project.genre);
  const [worldName, setWorldName] = useState(project.worldName);
  const [settings, setSettings] = useState(project.settings);
  const [currentPremise, setCurrentPremise] = useState(project.authorNote);
  useEffect(() => {
    mounted.current = true;
    storageService.listProjectsAsync().then(result => { if (mounted.current) setBooks(result); })
      .catch(() => { if (mounted.current) setError('书架读取失败。当前作品仍保留，可关闭后重试；重要作品请先导出备份。'); });
    return () => { mounted.current = false; };
  }, []);
  const activate = async (getProject: () => Promise<ProjectData> | ProjectData, entry?: CreationMode) => {
    if (working) return;
    setWorking(true); setError('');
    try {
      await onActivate(await getProject(), entry);
      if (mounted.current) onClose();
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : '保存或切换失败，当前作品仍保留，请先导出备份后重试。');
    } finally { if (mounted.current) setWorking(false); }
  };
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100';
  const knownBooks = [{ id: project.id, title: project.title, chapterCount: project.chapters.length,
    wordCount: project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0) }, ...books.filter(book => book.id !== project.id)];
  return <Dialog titleId={titleId} onClose={() => { if (!working) onClose(); }} className="p-4 bg-black/70" panelClassName="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 text-slate-200">
    <div className="flex items-center justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">作品书架 · 新建作品</h2><button disabled={working} onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">关闭书架</button></div>
    <p className="mt-3 text-xs leading-6 text-slate-400">每本书独立保存。创建或切换前会完整保存当前作品，并停止当前页面后续任务；保存失败时保留当前作品。书架只属于此浏览器，请定期导出备份。</p>
    {error && <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    <div className="mt-5 grid gap-6 sm:grid-cols-2"><section className="space-y-3">
      <h3 className="font-semibold">新建空白作品</h3>
      <label className="block text-xs">书名<input aria-label="新书书名" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} maxLength={200} disabled={working} /></label>
      <label className="block text-xs">题材<input aria-label="新书题材" value={genre} onChange={e => setGenre(e.target.value)} className={inputClass} disabled={working} placeholder="例如科幻、现实、悬疑" /></label>
      <label className="block text-xs">作品简介 / 故事起点<textarea aria-label="新书简介" value={premise} onChange={e => setPremise(e.target.value)} className={inputClass} rows={3} disabled={working} placeholder="可留空手写；使用 AI 时可在此提供故事起点" /></label>
      <label className="block text-xs">开始方式<select aria-label="新书开始方式" value={mode} onChange={e => setMode(e.target.value as CreationMode)} className={inputClass} disabled={working}><option value="CO_WRITING">B · 人机共写 / 纯享写作</option><option value="AUTO_NOVEL">A · 自动成章流水线</option><option value="SIMULATION">C · 本地规则世界模拟</option></select></label>
      <label className="flex gap-2 text-xs leading-5"><input type="checkbox" aria-label="沿用当前 AI 连接" checked={copyConnection} onChange={e => setCopyConnection(e.target.checked)} disabled={working} />沿用当前 AI 连接（包含密钥，不复制原书采样、作者附注、人物或正文）</label>
      <button disabled={working || !title.trim()} onClick={() => activate(() => createEmptyProject(`proj_${crypto.randomUUID()}`, { title, genre, premise }, copyConnection ? project.aiConfig : undefined), mode)} className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white disabled:opacity-40">创建空白作品</button>
    </section><section className="space-y-3"><h3 className="font-semibold">已有作品</h3>
      {knownBooks.map(book => <div key={book.id} className="rounded-xl border border-slate-700 p-3"><p className="break-words text-sm">{book.title}{book.id === project.id && <span className="ml-2 text-xs text-purple-300">当前作品</span>}</p><p className="my-2 text-xs text-slate-400">{book.chapterCount} 章 · {book.wordCount} 字</p><button aria-label={`切换到：${book.title}`} disabled={working || book.id === project.id} onClick={() => activate(() => storageService.loadSavedProjectAsync(book.id))} className="rounded border border-slate-700 px-3 py-1.5 text-xs disabled:opacity-40">打开作品</button></div>)}
      <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm">编辑当前作品信息</summary><div className="mt-3 space-y-3"><label className="block text-xs">书名<input aria-label="当前书名" className={inputClass} value={currentTitle} disabled={working} onChange={e => setCurrentTitle(e.target.value)} /></label><label className="block text-xs">题材<input aria-label="当前题材" className={inputClass} value={currentGenre} disabled={working} onChange={e => setCurrentGenre(e.target.value)} /></label><label className="block text-xs">简介<textarea aria-label="当前作品简介" className={inputClass} value={currentPremise} disabled={working} onChange={e => setCurrentPremise(e.target.value)} /></label><label className="block text-xs">世界名称<input aria-label="当前世界名" className={inputClass} value={worldName} disabled={working} onChange={e => setWorldName(e.target.value)} /></label><label className="block text-xs">文学风格<select aria-label="当前文风" className={inputClass} disabled={working} value={settings.literaryStyle} onChange={e => setSettings({ ...settings, literaryStyle: e.target.value as typeof settings.literaryStyle })}>{['严肃文学', '古朴古典', '轻快细腻', '悬疑冷峻', '生活日常'].map(style => <option key={style}>{style}</option>)}</select></label><label className="block text-xs">叙述视角<select aria-label="当前视角" className={inputClass} disabled={working} value={settings.povPreference} onChange={e => setSettings({ ...settings, povPreference: e.target.value as typeof settings.povPreference })}>{['第三人称有限视角', '第一人称', '第三人称全知视角', '多重视角轮转'].map(pov => <option key={pov}>{pov}</option>)}</select></label><label className="block text-xs">章节目标字数 (100–12000)<input aria-label="章节目标字数" className={inputClass} type="number" min={100} max={12000} disabled={working} value={settings.chapterLengthTarget} onChange={e => setSettings({ ...settings, chapterLengthTarget: Number(e.target.value) || 100 })} /></label><button disabled={working || !currentTitle.trim() || settings.chapterLengthTarget < 100 || settings.chapterLengthTarget > 12000} onClick={() => activate(() => ({ ...project, title: currentTitle.trim(), genre: currentGenre.trim(), authorNote: currentPremise.trim(), worldName: worldName.trim(), settings }))} className="rounded-lg border border-purple-700 px-3 py-2 text-xs">保存作品信息</button></div></details>
    </section></div>
    {working && <p role="status" className="mt-4 text-sm text-purple-300">正在完整保存并打开作品…</p>}
  </Dialog>;
}
