import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { ProjectData, WorldEvent, ConsistencyIssue, LorebookEntry, CreationMode } from './types';
import { storageService } from './services/storageService';
import { createEmptyProject } from './services/projectFactory';
import { ProjectLibraryModal } from './components/ProjectLibraryModal';
import { AuthorDeskEditor } from './components/AuthorDeskEditor';
import { Dialog } from './components/Dialog';
import { parseProjectBackup } from './services/backupValidation';
import {
  Globe, BookOpen, Users, Compass, Eye, ShieldCheck,
  Download, Upload, Sparkles, Settings2, RefreshCw, Cpu,
  BookMarked, Feather, FileText, Activity, Dices,
  ChevronRight, Book, Clock3, ScrollText, CircleHelp, Menu, X, Check, AlertCircle
} from 'lucide-react';

const WorldSimConsole = lazy(() => import('./components/WorldSimConsole').then(m => ({ default: m.WorldSimConsole })));
const NovelEditor = lazy(() => import('./components/NovelEditor').then(m => ({ default: m.NovelEditor })));
const CharacterManager = lazy(() => import('./components/CharacterManager').then(m => ({ default: m.CharacterManager })));
const WorldEditor = lazy(() => import('./components/WorldEditor').then(m => ({ default: m.WorldEditor })));
const LorebookEditor = lazy(() => import('./components/LorebookEditor').then(m => ({ default: m.LorebookEditor })));
const ReaderView = lazy(() => import('./components/ReaderView').then(m => ({ default: m.ReaderView })));
const DocumentLibraryModal = lazy(() => import('./components/DocumentLibraryModal').then(m => ({ default: m.DocumentLibraryModal })));
const AISettingsModal = lazy(() => import('./components/AISettingsModal').then(m => ({ default: m.AISettingsModal })));
const AboutSystemModal = lazy(() => import('./components/AboutSystemModal').then(m => ({ default: m.AboutSystemModal })));
const NarrativeAnalyticsModal = lazy(() => import('./components/NarrativeAnalyticsModal').then(m => ({ default: m.NarrativeAnalyticsModal })));
const ChaosOracleModal = lazy(() => import('./components/ChaosOracleModal').then(m => ({ default: m.ChaosOracleModal })));

function LoadingPanel() {
  return <div className="workspace-loading" role="status"><RefreshCw className="h-5 w-5 animate-spin" /><span>正在准备创作空间…</span></div>;
}

export default function App() {
  const [project, setProject] = useState<ProjectData>(() => createEmptyProject('proj_first_book'));
  const [currentTab, setCurrentTab] = useState<'SIMULATION' | 'NOVEL' | 'AUTHOR_DESK' | 'CHARACTERS' | 'WORLD' | 'LOREBOOK' | 'READER'>('AUTHOR_DESK');
  const [selectedEventForChapter, setSelectedEventForChapter] = useState<WorldEvent[]>([]);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showBookLibrary, setShowBookLibrary] = useState(false);
  const [isProjectChanging, setIsProjectChanging] = useState(false);
  const [pipelineMode, setPipelineMode] = useState<'AUTO_NOVEL' | 'CO_WRITING'>('CO_WRITING');
  const projectTransition = useRef(false);
  const auditRun = useRef(0);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showDocLibrary, setShowDocLibrary] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showChaosModal, setShowChaosModal] = useState(false);
  const [auditIssues, setAuditIssues] = useState<ConsistencyIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [compactNavigation, setCompactNavigation] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const latestProject = useRef(project);
  const saveRevision = useRef(0);
  const needsSave = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const navigationTrigger = useRef<HTMLButtonElement>(null);

  // Finish restoration before mounting editors, so late data cannot replace new typing.
  useEffect(() => {
    let cancelled = false;
    setIsRestoring(true);
    setRestoreError('');
    storageService.loadProjectAsync().then(loaded => {
      if (!cancelled && loaded) {
        const restored = parseProjectBackup(JSON.stringify(loaded));
        latestProject.current = restored;
        setProject(restored);
      }
    }).catch((error) => {
      if (!cancelled) setRestoreError(error instanceof Error ? error.message : '完整存档暂时无法读取，请重试。');
    }).finally(() => { if (!cancelled) setIsRestoring(false); });
    return () => { cancelled = true; };
  }, [restoreAttempt]);

  const handleUpdateProject = useCallback((p: ProjectData) => {
    if (projectTransition.current || p.id !== latestProject.current.id) return;
    latestProject.current = p;
    needsSave.current = true;
    saveRevision.current += 1;
    setSaveState('saving');
    setProject(p);
  }, []);

  useEffect(() => {
    if (isRestoring || isProjectChanging || restoreError || !needsSave.current) return;
    const revision = saveRevision.current;
    const timer = window.setTimeout(() => {
      if (projectTransition.current || revision !== saveRevision.current || project.id !== latestProject.current.id) return;
      storageService.saveProjectAsync(project).then(() => {
        if (revision !== saveRevision.current) return;
        needsSave.current = false;
        setSaveState('saved');
      }).catch(() => {
        if (revision !== saveRevision.current) return;
        setSaveState('error');
        setNotice({ message: '存盘未完成，请导出备份，并检查浏览器存储空间。', error: true });
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project, isRestoring, isProjectChanging, restoreError]);

  useEffect(() => {
    const flush = () => { if (needsSave.current && !projectTransition.current) storageService.saveProject(latestProject.current); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.error ? 9000 : 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const change = () => { setCompactNavigation(query.matches); setMobileNavOpen(false); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen || !compactNavigation) return;
    const navigation = navigationRef.current;
    const controls = () => Array.from(navigation?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])
      .filter(button => button.getClientRects().length > 0);
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileNavOpen(false); }
      if (event.key !== 'Tab') return;
      const buttons = controls();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if ((event.shiftKey && index <= 0) || (!event.shiftKey && (index < 0 || index === buttons.length - 1))) {
        event.preventDefault();
        buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (!document.querySelector('[role="dialog"]')) navigationTrigger.current?.focus();
    };
  }, [mobileNavOpen, compactNavigation]);

  const handleRunAudit = async () => {
    if (isAuditing || isRestoring || restoreError) return;
    setIsAuditing(true);
    setAuditError('');
    setAuditIssues([]);
    setShowAuditModal(true);
    setMobileNavOpen(false);
    const run = ++auditRun.current;
    const source = project;
    try {
      const { GeminiService } = await import('./services/geminiService');
      const issues = await GeminiService.auditConsistency(source);
      if (auditRun.current === run && latestProject.current.id === source.id) setAuditIssues(issues);
    } catch (error) {
      if (auditRun.current === run) setAuditError(error instanceof Error ? error.message : '审计暂时无法完成，请检查模型设置后重试。');
    } finally {
      if (auditRun.current === run) setIsAuditing(false);
    }
  };

  const openWorkflow = (mode: CreationMode) => {
    if (mode === 'SIMULATION') setCurrentTab('SIMULATION');
    else { setPipelineMode(mode); setCurrentTab('NOVEL'); }
    setMobileNavOpen(false);
  };

  const handleActivateProject = async (next: ProjectData, mode?: CreationMode) => {
    if (projectTransition.current) throw new Error('正在切换作品，请稍后重试。');
    const parsed = parseProjectBackup(JSON.stringify(next));
    projectTransition.current = true;
    setIsProjectChanging(true);
    saveRevision.current += 1;
    try {
      await storageService.activateProjectAsync(latestProject.current, parsed);
      latestProject.current = parsed;
      needsSave.current = false;
      setProject(parsed); setSaveState('saved'); setRestoreError('');
      setSelectedEventForChapter([]); setShowBookLibrary(false);
      setShowAISettings(false); setShowDocLibrary(false); setShowChaosModal(false); setShowAnalyticsModal(false);
      auditRun.current += 1; setIsAuditing(false); setShowAuditModal(false); setAuditIssues([]);
      if (mode === 'AUTO_NOVEL' || mode === 'SIMULATION') openWorkflow(mode);
      else { setCurrentTab('AUTHOR_DESK'); setPipelineMode('CO_WRITING'); }
      setNotice({ message: `已打开「${parsed.title}」，各作品独立保存。` });
    } catch (failure) {
      setSaveState('error');
      throw failure;
    } finally { projectTransition.current = false; setIsProjectChanging(false); }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const sourceId = latestProject.current.id;
    try {
      const parsed = parseProjectBackup(await file.text());
      if (latestProject.current.id !== sourceId) throw new Error('作品已切换，请重新选择需要还原的备份。');
      // Importing a different book must not overwrite another library record
      // merely because the file carries that book's original ID.
      const restored = parsed.id === sourceId ? parsed : { ...parsed, id: `proj_${crypto.randomUUID()}` };
      setRestoreError('');
      await handleActivateProject(restored);
      setSelectedEventForChapter([]);
      setNotice({ message: `已${parsed.id === sourceId ? '还原当前作品' : '导入独立副本'}「${parsed.title}」，共 ${parsed.chapters.length} 个章节。` });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : '无法读取备份文件。', error: true });
    }
  };

  const handleAddLorebookEntry = (lore: LorebookEntry) => {
    const updated = { ...project, lorebook: [...project.lorebook, lore] };
    handleUpdateProject(updated);
  };

  const activeProvider = project.aiConfig?.activeProvider || 'gemini';
  const activeModel = activeProvider === 'ollama' ? project.aiConfig?.ollama?.model : activeProvider === 'openai_compatible' ? project.aiConfig?.openaiCompatible?.model : project.aiConfig?.gemini?.model;
  const totalWords = project.chapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0);
  const navGroups = [
    {
      label: '创作空间',
      items: [
        { id: 'AUTHOR_DESK', label: '纯享写作', detail: '沉浸式码字', icon: Feather },
        { id: 'NOVEL', label: 'AI 创作流水线', detail: `${project.chapters.length} 个章节`, icon: BookOpen },
      ],
    },
    {
      label: '世界档案',
      items: [
        { id: 'SIMULATION', label: '世界模拟', detail: '自主演进控制台', icon: Globe },
        { id: 'LOREBOOK', label: '世界设定集', detail: 'Lorebook', icon: BookMarked },
        { id: 'CHARACTERS', label: '人物档案', detail: `${project.characters.length} 位角色`, icon: Users },
        { id: 'WORLD', label: '世界法则', detail: '地图 · 阵营 · 规则', icon: Compass },
      ],
    },
    {
      label: '阅读',
      items: [
        { id: 'READER', label: '沉浸阅读', detail: '预览作品', icon: Eye },
      ],
    },
  ] as const;
  const pageDetails: Record<typeof currentTab, { title: string; subtitle: string }> = {
    AUTHOR_DESK: { title: '纯享写作', subtitle: '留一点安静的时间，让故事自然生长。' },
    NOVEL: { title: 'AI 创作流水线', subtitle: '从世界事件出发，逐章搭建你的长篇叙事。' },
    SIMULATION: { title: '世界模拟', subtitle: '让人物与世界在时间中自主演进。' },
    LOREBOOK: { title: '世界设定集', subtitle: '整理设定、伏笔与故事中的重要事实。' },
    CHARACTERS: { title: '人物档案', subtitle: '追踪角色的关系、动机与命运。' },
    WORLD: { title: '世界法则', subtitle: '构筑地点、势力与维系世界的规则。' },
    READER: { title: '沉浸阅读', subtitle: '回到故事之中，检视章节与叙事节奏。' },
  };
  const writingProgress = Math.min(
    100,
    Math.round(((project.deskSettings?.currentSessionWords || 0) / Math.max(1, project.deskSettings?.targetDailyWords || 6000)) * 100)
  );

  return (
    <div className="chronicle-shell min-h-screen text-slate-100 font-sans selection:bg-amber-400/25 selection:text-amber-100">
      <a className="skip-link" href="#workspace-main">跳到创作内容</a>
      {mobileNavOpen && <button className="nav-backdrop" aria-label="关闭导航菜单" onClick={() => setMobileNavOpen(false)} />}
      <aside ref={navigationRef} id="workspace-navigation" inert={compactNavigation && !mobileNavOpen} role={compactNavigation && mobileNavOpen ? 'dialog' : undefined} aria-modal={compactNavigation && mobileNavOpen ? true : undefined} aria-label="导航和创作工具" className={`chronicle-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Compass className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-bold tracking-[0.16em] text-stone-100">CHRONICLE</h1>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.25em] text-amber-200/60">Engine · Story atelier</p>
          </div>
          <button className="mobile-nav-close" aria-label="关闭导航菜单" onClick={() => setMobileNavOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <div className="project-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-stone-500">当前作品</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
          </div>
          <p className="mt-2 truncate font-serif text-sm text-stone-100">{project.title}</p>
          <p className="mt-1 truncate text-[11px] text-stone-500">{project.worldName}</p>
          <div className="mt-3 flex gap-2"><button aria-label="新建作品" disabled={isRestoring || isProjectChanging || !!restoreError} onClick={() => { setShowBookLibrary(true); setMobileNavOpen(false); }} className="rounded-lg border border-amber-200/25 px-2 py-2 text-xs text-amber-100 disabled:opacity-40">＋ 新建作品</button><button aria-label="打开作品书架" disabled={isRestoring || isProjectChanging || !!restoreError} onClick={() => { setShowBookLibrary(true); setMobileNavOpen(false); }} className="rounded-lg border border-white/10 px-2 py-2 text-xs">作品书架</button></div>
        </div>

        <nav className="sidebar-navigation" aria-label="主导航">
          {navGroups.map(group => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentTab(item.id); setMobileNavOpen(false); }}
                    aria-current={active ? 'page' : undefined}
                    className={`nav-item ${active ? 'nav-item-active' : ''}`}
                  >
                    <span className="nav-icon"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-xs font-medium">{item.label}</span>
                      <span className="nav-detail">{item.detail}</span>
                    </span>
                    {active && <ChevronRight className="h-3.5 w-3.5 text-amber-200/70" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-tools">
          <p className="nav-group-label">灵感与工具</p>
          <button disabled={isRestoring || !!restoreError} onClick={() => { setShowAnalyticsModal(true); setMobileNavOpen(false); }} className="tool-link">
            <Activity className="h-4 w-4 text-emerald-300" />张力图谱
          </button>
          <button disabled={isRestoring || !!restoreError} onClick={() => { setShowChaosModal(true); setMobileNavOpen(false); }} className="tool-link">
            <Dices className="h-4 w-4 text-amber-300" />神谕骰子
          </button>
          <button disabled={isRestoring || !!restoreError} onClick={() => { setShowDocLibrary(true); setMobileNavOpen(false); }} className="tool-link">
            <FileText className="h-4 w-4 text-sky-300" />文献参考
          </button>
          <button onClick={handleRunAudit} disabled={isAuditing || isRestoring || !!restoreError} className="tool-link">
            <ShieldCheck className="h-4 w-4 text-violet-300" />因果审计
          </button>
          <button onClick={() => { setShowAboutModal(true); setMobileNavOpen(false); }} className="tool-link mobile-about-link"><CircleHelp className="h-4 w-4" />关于编年引擎</button>
        </div>

        <div className="sidebar-footer">
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="text-stone-500">今日写作</span>
            <span className="font-mono text-amber-100/80">{project.deskSettings?.currentSessionWords || 0} / {project.deskSettings?.targetDailyWords || 6000}</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${writingProgress}%` }} /></div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-500">
            <Clock3 className="h-3.5 w-3.5 text-amber-200/60" />
            <span className="truncate">{project.currentSimulationTime}</span>
          </div>
        </div>
      </aside>

      <div className="chronicle-main" inert={compactNavigation && mobileNavOpen}>
        <header className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={navigationTrigger} className="mobile-nav-toggle" aria-label="打开导航和工具" aria-expanded={mobileNavOpen} aria-controls="workspace-navigation" onClick={() => setMobileNavOpen(true)}><Menu className="h-5 w-5" /></button>
            <div className="topbar-ornament"><Book className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.19em] text-stone-500">Chronicle Engine <span className="px-1 text-stone-700">/</span> {pageDetails[currentTab].title}</p>
              <p className="mt-0.5 truncate font-serif text-sm text-stone-200">{project.title}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`save-indicator save-${saveState}`} role="status" title="创作内容保存在当前浏览器">
              {saveState === 'saving' ? <RefreshCw className="h-3 w-3 animate-spin" /> : saveState === 'error' ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              <span>{isRestoring ? '恢复存档中' : restoreError ? '等待恢复存档' : saveState === 'saving' ? '正在保存' : saveState === 'error' ? '存盘未完成' : '已在本地保存'}</span>
            </span>
            <button
              onClick={() => setShowAISettings(true)}
              className="provider-chip"
              title="点击切换与配置模型"
              disabled={isRestoring || !!restoreError}
              aria-label={`模型设置：${activeModel || activeProvider}`}
            >
              {activeProvider === 'gemini' ? <Sparkles className="h-3.5 w-3.5 text-amber-200" /> : activeProvider === 'ollama' ? <Cpu className="h-3.5 w-3.5 text-emerald-300" /> : <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />}
              <span className="provider-model">{activeModel || (activeProvider === 'gemini' ? 'Gemini' : activeProvider === 'ollama' ? 'Ollama 本地' : 'OpenAI 兼容')}</span>
              <Settings2 className="h-3 w-3 opacity-50" />
            </button>
            <button
              onClick={() => storageService.exportAsJson(project)}
              className="topbar-icon-button"
              title="导出项目完整数据"
              aria-label="导出项目备份"
              disabled={isRestoring || !!restoreError}
            >
              <Download className="h-4 w-4" /><span className="hidden sm:inline">备份</span>
            </button>
            <button className="topbar-icon-button cursor-pointer" title="从 JSON 备份还原" aria-label="还原项目备份" disabled={isRestoring} onClick={() => importRef.current?.click()}>
              <Upload className="h-4 w-4" /><span className="hidden sm:inline">还原</span>
            </button>
            <input ref={importRef} type="file" accept=".json,application/json" onChange={handleImportBackup} className="hidden" aria-label="选择项目备份" />
            <button
              onClick={() => setShowAboutModal(true)}
              className="topbar-icon-button topbar-help"
              title="关于系统 · 架构与部署"
              aria-label="关于编年引擎"
            >
              <CircleHelp className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main id="workspace-main" className="workspace-content" tabIndex={-1}>
          {!!project.recoveryWarnings?.length && <details className="mb-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-xs text-amber-200"><summary className="cursor-pointer">存档恢复提醒（{project.recoveryWarnings.length}）</summary><ul className="mt-3 list-disc space-y-2 pl-5">{project.recoveryWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul><p className="mt-3">原稿内容已保留。请检查待确认的关联并导出新的完整备份。</p><button onClick={() => handleUpdateProject({ ...latestProject.current, recoveryWarnings: [] })} className="mt-3 underline">已查看，关闭提醒</button></details>}
          <section className="page-heading">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="heading-kicker"><ScrollText className="h-3 w-3" /> STORY WORKSPACE</span>
                <span className="h-px w-8 bg-amber-200/25" />
                <span className="text-[10px] tracking-wide text-stone-600">{project.genre}</span>
              </div>
              <h2 className="font-serif text-2xl font-semibold tracking-wide text-stone-100 sm:text-[28px]">{pageDetails[currentTab].title}</h2>
              <p className="mt-1.5 text-xs text-stone-500">{pageDetails[currentTab].subtitle}</p>
            </div>
            <div className="heading-stats">
              <div className="stat-block"><span>总字数</span><strong>{totalWords.toLocaleString()}</strong></div>
              <span className="stat-divider" />
              <div className="stat-block"><span>角色</span><strong>{project.characters.length}</strong></div>
              <span className="stat-divider" />
              <div className="stat-block"><span>地点</span><strong>{project.locations.length}</strong></div>
            </div>
          </section>

        <div aria-label="创作方式" className="mb-4 flex flex-wrap gap-2 text-xs">{([['AUTO_NOVEL', '模式 A · 自动成书'], ['CO_WRITING', '模式 B · 人机共写'], ['SIMULATION', '模式 C · 世界模拟']] as const).map(([mode, label]) => <button key={mode} disabled={isRestoring || isProjectChanging || !!restoreError} onClick={() => openWorkflow(mode)} aria-pressed={mode === 'SIMULATION' ? currentTab === 'SIMULATION' : currentTab === 'NOVEL' && pipelineMode === mode} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-slate-200 aria-pressed:border-purple-500 aria-pressed:text-purple-200 disabled:opacity-40">{label}</button>)}</div>
        <div key={project.id} className={`workspace-module module-${currentTab.toLowerCase()}`}>
        {isRestoring || isProjectChanging ? <LoadingPanel /> : restoreError ? <div className="workspace-loading flex-col px-8 text-center" role="alert"><AlertCircle className="h-7 w-7" /><h3 className="font-serif text-lg text-slate-100">继续之前，先恢复完整作品</h3><p className="max-w-md text-xs leading-7 text-slate-400">{restoreError}</p><button className="rounded-lg border border-purple-700 bg-purple-600 px-5 py-2 text-xs text-white" onClick={() => setRestoreAttempt(attempt => attempt + 1)}>重新读取存档</button><button className="text-xs underline underline-offset-4" onClick={() => importRef.current?.click()}>从备份还原</button></div> : <Suspense fallback={<LoadingPanel />}>
        {currentTab === 'AUTHOR_DESK' && (
          <AuthorDeskEditor
            key={project.id}
            project={project}
            onUpdateProject={handleUpdateProject}
            onOpenDocumentLibrary={() => setShowDocLibrary(true)}
          />
        )}

        {currentTab === 'NOVEL' && (
          <NovelEditor
            key={`${project.id}:${pipelineMode}`}
            project={project}
            pipelineMode={pipelineMode}
            onPipelineModeChange={setPipelineMode}
            onUpdateProject={handleUpdateProject}
            selectedEventForChapter={selectedEventForChapter}
            onOpenAISettings={() => setShowAISettings(true)}
          />
        )}

        {currentTab === 'SIMULATION' && (
          <WorldSimConsole
            project={project}
            onUpdateProject={handleUpdateProject}
            onJumpToWriting={(events) => {
              setSelectedEventForChapter(events);
              setCurrentTab('NOVEL');
            }}
          />
        )}

        {currentTab === 'LOREBOOK' && (
          <LorebookEditor
            project={project}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {currentTab === 'CHARACTERS' && (
          <CharacterManager
            project={project}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {currentTab === 'WORLD' && (
          <WorldEditor
            project={project}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {currentTab === 'READER' && (
          <ReaderView project={project} />
        )}
        </Suspense>}
        </div>
        </main>
      </div>

      <Suspense fallback={<div className="dialog-loading" role="status"><RefreshCw className="h-5 w-5 animate-spin" />正在打开工具…</div>}>
      {showBookLibrary && <ProjectLibraryModal project={project} onActivate={handleActivateProject} onClose={() => setShowBookLibrary(false)} />}
      {/* Reference Material & Document Library Modal */}
      {showDocLibrary && (
        <DocumentLibraryModal
          project={project}
          onUpdateProject={handleUpdateProject}
          onClose={() => setShowDocLibrary(false)}
          onInsertReferenceSnippet={(snippet) => {
            if (project.chapters[0]) {
              const updated = project.chapters.map((ch, idx) =>
                idx === 0 ? { ...ch, content: ch.content + '\n\n' + snippet } : ch
              );
              handleUpdateProject({ ...project, chapters: updated });
              setNotice({ message: '已将引用摘录追加至第一章正文末尾。' });
            } else {
              setNotice({ message: '请先创建章节，再插入摘录。', error: true });
            }
          }}
          onConvertToLorebook={handleAddLorebookEntry}
        />
      )}

      {/* Narrative Analytics (StoryMetrics) Modal */}
      {showAnalyticsModal && (
        <NarrativeAnalyticsModal
          project={project}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}

      {/* Chaos Oracle (TaleCrafter) Modal */}
      {showChaosModal && (
        <ChaosOracleModal
          project={project}
          onClose={() => setShowChaosModal(false)}
          onApplyTwist={(twistText) => {
            if (project.chapters[0]) {
              const updated = project.chapters.map((ch, idx) =>
                idx === 0 ? { ...ch, outline: ch.outline ? `${ch.outline}\n${twistText}` : twistText } : ch
              );
              handleUpdateProject({ ...project, chapters: updated });
              setNotice({ message: '已将神谕变故加入第一章大纲。' });
            } else {
              setNotice({ message: '请先创建章节，再应用神谕。', error: true });
            }
          }}
        />
      )}

      {/* AI Settings Modal */}
      {showAISettings && (
        <AISettingsModal
          project={project}
          onUpdateProject={handleUpdateProject}
          onClose={() => setShowAISettings(false)}
        />
      )}

      {/* Consistency Audit Modal */}
      {showAuditModal && (
        <Dialog onClose={() => setShowAuditModal(false)} titleId="audit-title" className="fixed inset-0 flex items-center justify-center p-4" panelClassName="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 id="audit-title" className="text-sm font-bold text-white">世界因果审计</h3>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                关闭
              </button>
            </div>

            {isAuditing ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                <span>正在扫描地理移动连续性、死者状态与认知泄露...</span>
              </div>
            ) : auditError ? (
              <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-5 text-red-200" role="alert">{auditError}<button onClick={handleRunAudit} className="mt-3 block rounded-lg bg-slate-800 px-3 py-2 text-slate-100">重新审计</button></div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {auditIssues.length === 0 && <p className="py-8 text-center text-slate-400">未发现需要处理的因果问题。</p>}
                {auditIssues.map(issue => (
                  <div
                    key={issue.id}
                    className={`p-3.5 rounded-xl border ${
                      issue.severity === 'critical'
                        ? 'bg-red-950/40 border-red-800/80 text-red-200'
                        : issue.severity === 'warning'
                        ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                        : 'bg-green-950/30 border-green-800/60 text-green-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-xs mb-1">
                      <span>{issue.title}</span>
                      <span className="uppercase text-[10px] font-mono">{issue.severity}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{issue.description}</p>
                    <div className="mt-2 text-[11px] text-slate-400 font-medium">
                      建议修复：{issue.suggestedFix}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Dialog>
      )}

      {/* About & System Architecture / Deployment Modal */}
      {showAboutModal && (
        <AboutSystemModal onClose={() => setShowAboutModal(false)} />
      )}
      </Suspense>
      {notice && <div className={`workspace-toast ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>
        {notice.error ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}<span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="关闭提示"><X className="h-4 w-4" /></button>
      </div>}
    </div>
  );
}
