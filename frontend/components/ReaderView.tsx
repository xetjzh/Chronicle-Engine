import React, { useRef, useState } from 'react';
import type { ProjectData } from '../types';
import { BookOpen, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';

interface ReaderViewProps { project: ProjectData }

const readerThemes = {
  dark: { label: '暗夜', bg: '#181b19', text: '#e6e0d4', muted: '#aaa597', border: '#373b31', surface: '#22261f', accent: '#ddbc7f' },
  sepia: { label: '羊皮纸', bg: '#f4ecd8', text: '#4c3b29', muted: '#7b654d', border: '#d7c7aa', surface: '#e9dec6', accent: '#805d28' },
  light: { label: '明亮', bg: '#faf9f5', text: '#32362f', muted: '#727568', border: '#dfe1d7', surface: '#f0f0e9', accent: '#786137' },
};

export const ReaderView: React.FC<ReaderViewProps> = ({ project }) => {
  const [selectedChapterId, setSelectedChapterId] = useState(project.chapters[0]?.id || '');
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.9);
  const [theme, setTheme] = useState<keyof typeof readerThemes>('dark');
  const readerRef = useRef<HTMLElement>(null);
  const selectedIndex = project.chapters.findIndex(chapter => chapter.id === selectedChapterId);
  const currentIndex = selectedIndex < 0 ? 0 : selectedIndex;
  const chapter = project.chapters[currentIndex];
  const colors = readerThemes[theme];
  const style = {
    '--reader-bg': colors.bg, '--reader-text': colors.text, '--reader-muted': colors.muted,
    '--reader-border': colors.border, '--reader-surface': colors.surface, '--reader-accent': colors.accent,
    color: colors.text, background: colors.bg, borderColor: colors.border,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  } as React.CSSProperties;

  const changeChapter = (id: string) => {
    setSelectedChapterId(id);
    readerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const controlClass = 'reader-control inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-surface)] px-3 text-xs text-inherit hover:brightness-95 disabled:opacity-35';

  if (!chapter) {
    return <div className="workspace-empty rounded-2xl border border-slate-800 bg-slate-900 px-6 py-24 text-center"><BookOpen className="mx-auto h-9 w-9 text-purple-400" /><h3 className="mt-5 font-serif text-xl text-slate-100">期待与你的故事相遇</h3><p className="mt-3 text-xs leading-6 text-slate-400">先到纯享写作创建第一章，即可在这里预览作品。</p></div>;
  }

  return (
    <section ref={readerRef} aria-label="作品阅读器" data-reading-theme={theme} style={style} className="reader-workspace mx-auto max-w-5xl scroll-mt-24 overflow-hidden rounded-2xl border shadow-xl">
      <header className="reader-toolbar flex flex-wrap items-center justify-between gap-4 border-b border-[var(--reader-border)] bg-[var(--reader-surface)] px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><BookOpen className="h-4 w-4 shrink-0 text-[var(--reader-accent)]" /><div className="min-w-0"><p className="max-w-60 truncate font-serif text-sm font-semibold">{project.title}</p><p className="mt-1 text-[10px] text-[var(--reader-muted)]">阅读时间 · 回到故事本身</p></div></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--reader-border)] p-0.5" role="group" aria-label="阅读主题">
            {Object.entries(readerThemes).map(([id, choice]) => <button key={id} onClick={() => setTheme(id as keyof typeof readerThemes)} aria-pressed={theme === id} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px]" style={{ background: theme === id ? colors.accent : 'transparent', color: theme === id ? colors.bg : colors.text }}>{id === 'dark' ? <Moon className="h-3 w-3" /> : id === 'light' ? <Sun className="h-3 w-3" /> : null}{choice.label}</button>)}
          </div>
          <div className="flex items-center rounded-lg border border-[var(--reader-border)] p-0.5" role="group" aria-label="正文字号"><button onClick={() => setFontSize(value => Math.max(14, value - 2))} disabled={fontSize <= 14} className="min-h-8 min-w-8 rounded-md text-xs hover:bg-black/5 disabled:opacity-35" aria-label="缩小阅读字号">A−</button><span className="px-1 font-mono text-[10px]">{fontSize}</span><button onClick={() => setFontSize(value => Math.min(28, value + 2))} disabled={fontSize >= 28} className="min-h-8 min-w-8 rounded-md text-xs hover:bg-black/5 disabled:opacity-35" aria-label="放大阅读字号">A+</button></div>
        </div>
      </header>

      <div className="reader-chapter-picker flex flex-wrap items-center justify-between gap-3 border-b border-[var(--reader-border)] px-5 py-3 sm:px-8">
        <label className="flex min-w-0 flex-1 items-center gap-3 text-[11px]"><span className="shrink-0 text-[var(--reader-muted)]">跳转章节</span><select value={chapter.id} onChange={event => changeChapter(event.target.value)} className="min-h-9 min-w-0 max-w-sm flex-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-bg)] px-2 text-xs text-inherit">{project.chapters.map(item => <option key={item.id} value={item.id}>第 {item.chapterNumber} 章 · {item.title || '未命名章节'}</option>)}</select></label>
        <label className="flex items-center gap-2 text-[11px] text-[var(--reader-muted)]">行间距<select value={lineHeight} onChange={event => setLineHeight(Number(event.target.value))} className="min-h-9 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-bg)] px-2 text-xs text-[var(--reader-text)]"><option value={1.6}>紧凑</option><option value={1.9}>舒适</option><option value={2.2}>宽松</option></select></label>
      </div>

      <article className="reader-page mx-auto max-w-3xl px-6 pb-16 pt-12 sm:px-12 sm:pt-16">
        <header className="mb-10 text-center sm:mb-14"><p className="text-[10px] tracking-[0.18em] text-[var(--reader-accent)]">第 {chapter.volumeNumber} 卷 · 第 {chapter.chapterNumber} 章</p><h3 className="mt-5 break-words font-serif text-2xl font-medium leading-relaxed sm:text-3xl">{chapter.title || '未命名章节'}</h3><div className="mx-auto my-5 h-px w-12 bg-[var(--reader-accent)] opacity-50" /><p className="text-[10px] text-[var(--reader-muted)]">{chapter.wordCount.toLocaleString()} 字 · 约 {Math.max(1, Math.ceil(chapter.wordCount / 400))} 分钟阅读</p></header>
        <div className="reader-prose whitespace-pre-wrap break-words font-serif" style={{ fontSize, lineHeight }}>
          {chapter.content || <p className="py-12 text-center text-sm text-[var(--reader-muted)]">这一章尚待落笔。</p>}
        </div>
        <p className="mt-14 text-center text-[10px] tracking-widest text-[var(--reader-muted)]">· 本章完 ·</p>
      </article>

      <nav aria-label="阅读章节翻页" className="reader-pagination flex items-center justify-between gap-2 border-t border-[var(--reader-border)] bg-[var(--reader-surface)] px-4 py-5 sm:px-8">
        <button onClick={() => changeChapter(project.chapters[currentIndex - 1].id)} disabled={currentIndex === 0} className={controlClass}><ChevronLeft className="h-3.5 w-3.5" />上一章</button>
        <span className="font-mono text-[11px] text-[var(--reader-muted)]" role="status">{currentIndex + 1} / {project.chapters.length}</span>
        <button onClick={() => changeChapter(project.chapters[currentIndex + 1].id)} disabled={currentIndex === project.chapters.length - 1} className={controlClass}>下一章<ChevronRight className="h-3.5 w-3.5" /></button>
      </nav>
    </section>
  );
};
