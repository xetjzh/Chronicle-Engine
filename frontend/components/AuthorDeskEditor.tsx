import React, { useEffect, useRef, useState } from 'react';
import type { ProjectData, WritingDeskSettings } from '../types';
import { soundEffects } from '../services/soundEffects';
import { AIProviderService } from '../services/aiProviderService';
import { AlignLeft, BookOpen, Check, ChevronRight, Feather, List, Maximize2, Minimize2, Palette, Plus, RefreshCw, Sparkles, SplitSquareVertical, Target, Volume2, VolumeX, Wand2, X } from 'lucide-react';
import { applyWritingAssistantResult, createWritingChapter, defaultWritingSettings, formatWritingParagraphs, updateWritingContent, updateWritingPreferences } from './writingWorkspace';

interface AuthorDeskEditorProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  onOpenDocumentLibrary: () => void;
}

const writingThemes = {
  ink: { label: '玄墨暗夜', bg: '#161817', surface: '#1d201e', text: '#e9e4d9', muted: '#a09e92', border: '#373a32', accent: '#dfbc7e' },
  sepia: { label: '古雅羊皮', bg: '#f4ecd8', surface: '#e9dec5', text: '#3f2f21', muted: '#7c644c', border: '#d3c29e', accent: '#85602b' },
  dark_emerald: { label: '竹墨护眼', bg: '#081b16', surface: '#102a23', text: '#c7e8dc', muted: '#8aac9f', border: '#2b4d40', accent: '#a6cdb5' },
  solarized: { label: '日光暖纸', bg: '#fdf6e3', surface: '#eee8d5', text: '#586e75', muted: '#657b83', border: '#d4cdbb', accent: '#926b08' },
  nord: { label: '极地冰蓝', bg: '#2e3440', surface: '#3b4252', text: '#eceff4', muted: '#b2bdce', border: '#566175', accent: '#b0c9dc' },
};

export const AuthorDeskEditor: React.FC<AuthorDeskEditorProps> = ({ project, onUpdateProject, onOpenDocumentLibrary }) => {
  const [activeChapterId, setActiveChapterId] = useState(project.chapters[0]?.id || '');
  const [showChapterList, setShowChapterList] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isSplitReferenceOpen, setIsSplitReferenceOpen] = useState(false);
  const [referenceId, setReferenceId] = useState(project.referenceDocs?.[0]?.id || '');
  const [saveStatus, setSaveStatus] = useState('编辑内容将自动保存');
  const [isAIAssisting, setIsAIAssisting] = useState(false);
  const [assistantNotice, setAssistantNotice] = useState('');
  const [pendingAIText, setPendingAIText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestProject = useRef(project);
  const latestCallback = useRef(onUpdateProject);
  const mounted = useRef(true);
  const requestRunning = useRef(false);
  latestProject.current = project;
  latestCallback.current = onUpdateProject;

  const deskSettings = { ...defaultWritingSettings, ...project.deskSettings };
  const currentChapter = project.chapters.find(chapter => chapter.id === activeChapterId) || project.chapters[0];
  const currentChapterId = useRef(currentChapter?.id);
  currentChapterId.current = currentChapter?.id;
  const reference = project.referenceDocs?.find(doc => doc.id === referenceId) || project.referenceDocs?.[0];
  const theme = writingThemes[deskSettings.theme] || writingThemes.ink;
  const themeStyle = {
    '--desk-bg': theme.bg, '--desk-surface': theme.surface, '--desk-text': theme.text,
    '--desk-muted': theme.muted, '--desk-border': theme.border, '--desk-accent': theme.accent,
    background: theme.bg, color: theme.text, borderColor: theme.border,
    colorScheme: deskSettings.theme === 'sepia' || deskSettings.theme === 'solarized' ? 'light' : 'dark',
  } as React.CSSProperties;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const commitProject = (updated: ProjectData) => {
    latestProject.current = updated;
    latestCallback.current(updated);
    setSaveStatus('修改已交由工作台保存');
  };
  const changePreferences = (patch: Partial<WritingDeskSettings>) => {
    commitProject(updateWritingPreferences(latestProject.current, patch));
  };

  useEffect(() => {
    if (!deskSettings.isZenMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const updated = updateWritingPreferences(latestProject.current, { isZenMode: false });
        latestProject.current = updated;
        latestCallback.current(updated);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [deskSettings.isZenMode]);

  const handleContentChange = (content: string) => {
    const latest = latestProject.current;
    const id = currentChapterId.current;
    if (!id) return;
    if (latest.deskSettings?.soundEnabled ?? defaultWritingSettings.soundEnabled) soundEffects.playKeyClick();
    commitProject(updateWritingContent(latest, id, content, new Date().toISOString()));
  };
  const handleCreateChapter = () => {
    const latest = latestProject.current;
    const chapter = createWritingChapter(latest, `chap_${crypto.randomUUID()}`, new Date().toISOString());
    commitProject({ ...latest, chapters: [...latest.chapters, chapter] });
    setActiveChapterId(chapter.id);
    setShowChapterList(false);
  };
  const handleFormatIndent = () => {
    if (!currentChapter) return;
    handleContentChange(formatWritingParagraphs(currentChapter.content));
    if (deskSettings.soundEnabled) soundEffects.playChime();
  };

  const handleAIPolishSnippet = async (operation: 'polish' | 'expand') => {
    const source = latestProject.current;
    const chapter = source.chapters.find(item => item.id === currentChapterId.current);
    if (!chapter || requestRunning.current) return;
    const textarea = textareaRef.current;
    const hasSelection = !!textarea && textarea.selectionStart !== textarea.selectionEnd;
    const start = hasSelection ? textarea!.selectionStart : Math.max(0, chapter.content.length - 350);
    const end = hasSelection ? textarea!.selectionEnd : chapter.content.length;
    const targetText = chapter.content.slice(start, end);
    if (!targetText.trim()) {
      setAssistantNotice('先写下一段文字，或选中想要修改的段落。');
      return;
    }
    const request = {
      projectId: source.id, chapterId: chapter.id, sourceContent: chapter.content,
      replaceStart: operation === 'expand' && !hasSelection ? chapter.content.length : start,
      replaceEnd: operation === 'expand' && !hasSelection ? chapter.content.length : end,
    };
    requestRunning.current = true;
    setIsAIAssisting(true);
    setAssistantNotice('正在整理灵感，你可以继续写作。');
    setPendingAIText('');
    const instruction = operation === 'polish'
      ? '请将以下小说段落进行古典文学性润色，增强环境音画、人物细微眼神与情绪暗涌，去除网络化白话：'
      : '请紧密接续以下剧情，顺畅扩写两段具有极强文学厚度的叙事正文（约300字）：';
    try {
      const generated = await AIProviderService.generateText(source.aiConfig, {
        prompt: `${instruction}\n\n“${targetText}”\n\n直接输出处理后的纯正文。`, overrideSampling: { temperature: 0.75 },
      });
      if (!mounted.current) return;
      if (!generated?.trim()) { setAssistantNotice('本次没有生成文字，请稍后重试。'); return; }
      const text = operation === 'expand' && !hasSelection ? `\n\n${generated.trim()}` : generated.trim();
      const result = applyWritingAssistantResult(latestProject.current, request, text, new Date().toISOString());
      if (!result.applied || currentChapterId.current !== request.chapterId) {
        setPendingAIText(generated.trim());
        setAssistantNotice('正文或当前章节已变化，生成结果已保留供你参考。');
        return;
      }
      commitProject(result.project);
      setAssistantNotice(operation === 'polish' ? '段落润色已应用。' : '续写已添加。');
      if (result.project.deskSettings?.soundEnabled) soundEffects.playChime();
    } catch (error) {
      if (mounted.current) setAssistantNotice(`灵感生成暂未完成：${error instanceof Error ? error.message : '请检查模型设置后重试'}`);
    } finally {
      requestRunning.current = false;
      if (mounted.current) setIsAIAssisting(false);
    }
  };

  const totalWords = project.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  const progressRatio = Math.min(100, Math.round(deskSettings.currentSessionWords / Math.max(1, deskSettings.targetDailyWords) * 100));
  const toolClass = 'desk-tool inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--desk-border)] px-2.5 py-1.5 text-xs transition hover:bg-black/10 disabled:opacity-40';
  const iconClass = 'h-3.5 w-3.5';

  return (
    <section aria-label="写作工作台" data-writing-theme={deskSettings.theme} style={themeStyle} className={`writing-workspace flex min-w-0 flex-col overflow-hidden rounded-2xl border shadow-xl ${deskSettings.isZenMode ? 'fixed inset-0 z-50 rounded-none border-0' : 'min-h-[700px]'}`}>
      <header className="desk-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-surface)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--desk-border)] text-[var(--desk-accent)]"><Feather className="h-4 w-4" /></span><div><h3 className="font-serif text-sm font-semibold">留白之间，故事生长</h3><p className="mt-1 text-[10px] text-[var(--desk-muted)]" role="status">{saveStatus}</p></div></div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setShowChapterList(!showChapterList)} className={`${toolClass} xl:hidden`} aria-expanded={showChapterList} aria-controls="desk-chapter-list"><List className={iconClass} />章节</button>
          <button onClick={() => setIsSplitReferenceOpen(!isSplitReferenceOpen)} className={toolClass} aria-pressed={isSplitReferenceOpen} aria-label="对照素材"><SplitSquareVertical className={iconClass} /><span className="hidden sm:inline">对照素材</span></button>
          <button onClick={onOpenDocumentLibrary} className={toolClass} aria-label="打开文献库"><BookOpen className={iconClass} /><span className="hidden sm:inline">文献库</span></button>
          <button onClick={() => changePreferences({ soundEnabled: !deskSettings.soundEnabled })} className={toolClass} aria-label={deskSettings.soundEnabled ? '关闭打字音效' : '开启打字音效'} aria-pressed={deskSettings.soundEnabled}>{deskSettings.soundEnabled ? <Volume2 className={iconClass} /> : <VolumeX className={iconClass} />}</button>
          <div className="relative">
            <button onClick={() => setShowThemePicker(!showThemePicker)} className={toolClass} aria-label="写作外观设置" aria-expanded={showThemePicker} aria-controls="desk-appearance"><Palette className={iconClass} /></button>
            {showThemePicker && <div id="desk-appearance" className="desk-appearance absolute right-0 top-11 z-40 w-60 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-surface)] p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">写作外观</span><button onClick={() => setShowThemePicker(false)} aria-label="关闭外观设置" className="rounded p-1"><X className={iconClass} /></button></div>
              <div className="space-y-1">{Object.entries(writingThemes).map(([id, choice]) => <button key={id} onClick={() => changePreferences({ theme: id as WritingDeskSettings['theme'] })} aria-pressed={deskSettings.theme === id} className="flex min-h-9 w-full items-center justify-between rounded-lg px-2 text-left text-xs hover:bg-black/10"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-black/20" style={{ background: choice.bg }} />{choice.label}</span>{deskSettings.theme === id && <Check className={iconClass} />}</button>)}</div>
              <label className="mt-3 block border-t border-[var(--desk-border)] pt-3 text-xs">正文字体<select value={deskSettings.fontFamily} onChange={event => changePreferences({ fontFamily: event.target.value as 'serif' | 'sans' })} className="mt-2 w-full rounded-lg border border-[var(--desk-border)] bg-[var(--desk-bg)] p-2 text-inherit"><option value="serif">宋体 · 文学阅读</option><option value="sans">黑体 · 清晰简洁</option></select></label>
              <label className="mt-3 block text-xs">行间距<select value={deskSettings.lineHeight} onChange={event => changePreferences({ lineHeight: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-[var(--desk-border)] bg-[var(--desk-bg)] p-2 text-inherit"><option value={1.6}>紧凑</option><option value={1.9}>舒适</option><option value={2.2}>宽松</option></select></label>
            </div>}
          </div>
          <button onClick={() => changePreferences({ isZenMode: !deskSettings.isZenMode })} className={toolClass} aria-label={deskSettings.isZenMode ? '退出专注模式' : '进入专注模式'} aria-pressed={deskSettings.isZenMode}>{deskSettings.isZenMode ? <Minimize2 className={iconClass} /> : <Maximize2 className={iconClass} />}</button>
        </div>
      </header>

      <div className={`desk-body flex min-h-0 flex-1 flex-col xl:flex-row ${deskSettings.isZenMode ? 'overflow-y-auto xl:overflow-hidden' : ''}`}>
        <aside id="desk-chapter-list" aria-label="章节目录" className={`desk-chapter-sidebar shrink-0 border-b border-[var(--desk-border)] bg-[var(--desk-surface)] p-4 xl:w-56 xl:border-b-0 xl:border-r ${showChapterList ? 'block' : 'hidden xl:block'} ${deskSettings.isZenMode ? 'xl:overflow-y-auto' : ''}`}>
          <div className="mb-4 flex items-center justify-between"><div><h4 className="text-xs font-semibold">作品目录</h4><p className="mt-1.5 text-[10px] text-[var(--desk-muted)]">{project.chapters.length} 章 · {totalWords.toLocaleString()} 字</p></div><button onClick={handleCreateChapter} aria-label="新建章节" title="新建章节" className={`${toolClass} !px-2`}><Plus className={iconClass} /></button></div>
          <nav aria-label="选择写作章节" className="max-h-80 space-y-1.5 overflow-y-auto xl:max-h-[650px]">
            {project.chapters.map(chapter => { const selected = chapter.id === currentChapter?.id; return <button key={chapter.id} onClick={() => { setActiveChapterId(chapter.id); setShowChapterList(false); }} aria-current={selected ? 'page' : undefined} className={`desk-chapter flex w-full items-start gap-2 rounded-lg border p-2.5 text-left ${selected ? 'border-[var(--desk-border)] bg-black/10' : 'border-transparent hover:bg-black/5'}`}><span className="mt-0.5 shrink-0 font-mono text-[10px] text-[var(--desk-muted)]">{String(chapter.chapterNumber).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{chapter.title || '未命名章节'}</span><span className="mt-1.5 block text-[10px] text-[var(--desk-muted)]">{chapter.wordCount.toLocaleString()} 字 · {chapter.status === 'final' ? '定稿' : chapter.status === 'audited' ? '已审阅' : '草稿'}</span></span>{selected && <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--desk-accent)]" />}</button>; })}
            {project.chapters.length === 0 && <p className="py-5 text-center text-xs text-[var(--desk-muted)]">故事从第一章开始。</p>}
          </nav>
          <div className="mt-6 border-t border-[var(--desk-border)] pt-4"><span className="flex items-center gap-2 text-[10px] text-[var(--desk-muted)]"><Target className={iconClass} />今日写作目标</span><div className="mt-2 flex items-baseline gap-1"><strong className="font-mono text-lg font-medium text-[var(--desk-accent)]">{deskSettings.currentSessionWords.toLocaleString()}</strong><span className="text-[10px] text-[var(--desk-muted)]">/ {deskSettings.targetDailyWords.toLocaleString()} 字</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-black/15" role="progressbar" aria-label="今日写作进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressRatio}><div className="h-full rounded-full bg-[var(--desk-accent)]" style={{ width: `${progressRatio}%` }} /></div></div>
        </aside>

        <div className="desk-manuscript min-w-0 flex-1 xl:overflow-y-auto">
          <div className="desk-editor-actions flex flex-wrap items-center justify-between gap-2 border-b border-[var(--desk-border)] px-4 py-2.5 sm:px-7"><span className="text-[10px] text-[var(--desk-muted)]">{currentChapter ? `第 ${currentChapter.volumeNumber} 卷 / 第 ${currentChapter.chapterNumber} 章` : '准备开启新篇章'}</span><div className="flex flex-wrap items-center gap-1.5"><button onClick={() => handleAIPolishSnippet('polish')} disabled={!currentChapter || isAIAssisting} className={toolClass} title="润色选中文字，未选择时润色末尾段落">{isAIAssisting ? <RefreshCw className={`${iconClass} animate-spin`} /> : <Wand2 className={iconClass} />}润色</button><button onClick={() => handleAIPolishSnippet('expand')} disabled={!currentChapter || isAIAssisting} className={`${toolClass} text-[var(--desk-accent)]`}><Sparkles className={iconClass} />续写</button><button onClick={handleFormatIndent} disabled={!currentChapter} className={toolClass}><AlignLeft className={iconClass} />排版</button></div></div>
          {assistantNotice && <div className="desk-assistant-notice mx-4 mt-4 rounded-lg border border-[var(--desk-border)] bg-[var(--desk-surface)] p-3 text-xs sm:mx-7"><div className="flex items-start justify-between gap-3"><p role="status" className="leading-relaxed">{assistantNotice}</p>{!isAIAssisting && <button onClick={() => { setAssistantNotice(''); setPendingAIText(''); }} aria-label="关闭灵感提示" className="shrink-0 rounded p-0.5"><X className={iconClass} /></button>}</div>{pendingAIText && <details className="mt-2"><summary className="cursor-pointer text-[var(--desk-accent)]">查看并选取生成文字</summary><textarea aria-label="保留的 AI 生成文字" readOnly value={pendingAIText} className="mt-2 min-h-40 w-full rounded-lg border border-[var(--desk-border)] bg-[var(--desk-bg)] p-3 font-serif leading-relaxed text-inherit" /></details>}</div>}
          {currentChapter ? <div className="desk-writing-sheet mx-auto flex min-h-[580px] w-full max-w-3xl flex-col px-5 pb-10 pt-9 sm:px-10 sm:pt-12">
            <label className="mb-3 text-[10px] tracking-[0.2em] text-[var(--desk-muted)]" htmlFor="desk-chapter-title">章节标题</label>
            <input id="desk-chapter-title" value={currentChapter.title} onChange={event => { const latest = latestProject.current; commitProject({ ...latest, chapters: latest.chapters.map(chapter => chapter.id === currentChapter.id ? { ...chapter, title: event.target.value, updatedAt: new Date().toISOString() } : chapter) }); }} className="desk-title w-full border-0 border-b border-transparent bg-transparent pb-5 font-serif text-2xl font-medium leading-relaxed text-inherit outline-none sm:text-[28px]" placeholder="给这一章起个名字…" />
            <div className="mb-7 mt-3 flex items-center gap-2 text-[10px] text-[var(--desk-muted)]"><span className="h-1 w-1 rounded-full bg-[var(--desk-accent)]" />{currentChapter.status === 'final' ? '定稿' : '创作中'}<span className="px-1 opacity-40">·</span>{currentChapter.wordCount.toLocaleString()} 字</div>
            <textarea ref={textareaRef} aria-label="章节正文" value={currentChapter.content} onChange={event => handleContentChange(event.target.value)} placeholder="把光标停在这里，让故事慢慢开始…" className={`desk-content min-h-[420px] w-full flex-1 resize-y border-0 bg-transparent pb-24 text-inherit outline-none ${deskSettings.fontFamily === 'sans' ? 'font-sans' : 'font-serif'}`} style={{ fontSize: `${deskSettings.fontSize}px`, lineHeight: deskSettings.lineHeight }} spellCheck={false} />
          </div> : <div className="desk-empty flex min-h-[540px] flex-col items-center justify-center px-6 text-center"><span className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-[var(--desk-border)] text-[var(--desk-accent)]"><Feather className="h-7 w-7" /></span><h3 className="font-serif text-2xl">每个故事，都有第一行</h3><p className="mt-3 max-w-xs text-xs leading-6 text-[var(--desk-muted)]">新建第一章，记下脑海里的人物、场景，或一个尚未成形的念头。</p><button onClick={handleCreateChapter} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--desk-accent)] px-5 text-xs font-semibold text-[var(--desk-bg)]"><Plus className="h-4 w-4" />创建第一章</button></div>}
        </div>

        {isSplitReferenceOpen && <aside aria-label="对照素材" className="desk-reference flex max-h-[450px] min-w-0 shrink-0 flex-col border-t border-[var(--desk-border)] bg-[var(--desk-surface)] text-xs xl:max-h-none xl:w-72 xl:border-l xl:border-t-0 2xl:w-80"><div className="flex items-center justify-between border-b border-[var(--desk-border)] p-4"><h4 className="flex items-center gap-2 font-semibold"><BookOpen className={iconClass} />对照素材</h4><button onClick={() => setIsSplitReferenceOpen(false)} className="rounded p-1" aria-label="关闭对照素材"><X className={iconClass} /></button></div><label className="p-3"><span className="sr-only">参考文献</span><select value={reference?.id || ''} onChange={event => setReferenceId(event.target.value)} className="w-full rounded-lg border border-[var(--desk-border)] bg-[var(--desk-bg)] p-2 text-inherit">{!reference && <option value="">暂无参考文献</option>}{(project.referenceDocs || []).map(doc => <option key={doc.id} value={doc.id}>{doc.title} ({doc.format.toUpperCase()})</option>)}</select></label><div className="flex-1 overflow-y-auto whitespace-pre-line p-4 font-serif text-[13px] leading-7">{reference?.parsedChapters?.[0]?.content || '在文献库导入资料，即可边阅读、边创作。'}</div>{!reference && <button onClick={onOpenDocumentLibrary} className="m-4 rounded-lg border border-[var(--desk-border)] p-2 text-[var(--desk-accent)]">打开文献库</button>}</aside>}
      </div>

      <footer className="desk-statusbar flex flex-wrap items-center justify-between gap-3 border-t border-[var(--desk-border)] bg-[var(--desk-surface)] px-4 py-3 text-[10px] sm:px-5"><span className="text-[var(--desk-muted)]">本章 <strong className="font-mono font-medium text-[var(--desk-text)]">{(currentChapter?.wordCount || 0).toLocaleString()}</strong> 字<span className="mx-3 opacity-30">|</span>全书 <strong className="font-mono font-medium text-[var(--desk-text)]">{totalWords.toLocaleString()}</strong> 字</span><div className="flex items-center gap-3"><span className="hidden text-[var(--desk-muted)] sm:inline">{deskSettings.isZenMode ? 'Esc 退出专注' : '安心写作，随时停笔'}</span><div className="flex items-center gap-1 rounded-lg border border-[var(--desk-border)] p-0.5"><button onClick={() => changePreferences({ fontSize: Math.max(14, deskSettings.fontSize - 1) })} disabled={deskSettings.fontSize <= 14} className="min-h-7 min-w-7 rounded px-1.5 hover:bg-black/10 disabled:opacity-40" aria-label="缩小正文字号">A−</button><span className="px-1 font-mono">{deskSettings.fontSize}</span><button onClick={() => changePreferences({ fontSize: Math.min(28, deskSettings.fontSize + 1) })} disabled={deskSettings.fontSize >= 28} className="min-h-7 min-w-7 rounded px-1.5 hover:bg-black/10 disabled:opacity-40" aria-label="放大正文字号">A+</button></div></div></footer>
    </section>
  );
};
