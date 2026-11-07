import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ProjectData, Chapter, WorldEvent, BatchPipelineStatus } from '../types';
import { GeminiService } from '../services/geminiService';
import { SimulationEngine } from '../services/simulationEngine';
import { storageService } from '../services/storageService';
import { RecursiveSummaryEngine } from '../services/recursiveSummaryEngine';
import { ChaosOracleModal } from './ChaosOracleModal';
import { applyNovelChapterPatch, captureNovelChapter, runNovelBatch } from './novelAsync';
import { 
  BookOpen, Feather, Sparkles, CheckCircle2, RotateCcw, 
  Download, Plus, Edit3, MessageSquare, AlertTriangle, Layers,
  Cpu, Server, RefreshCw, BookMarked, Sliders, Check, FastForward,
  Play, Pause, Award, Activity, ChevronLeft, ChevronRight, Hash,
  Dices, Brain, Wand2
} from 'lucide-react';

interface NovelEditorProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  selectedEventForChapter?: WorldEvent[];
  onOpenAISettings: () => void;
}

export const NovelEditor: React.FC<NovelEditorProps> = ({
  project,
  onUpdateProject,
  selectedEventForChapter,
  onOpenAISettings,
}) => {
  const [activeChapterId, setActiveChapterId] = useState<string>(project.chapters[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationActStatus, setGenerationActStatus] = useState<string | null>(null);
  const [currentActWords, setCurrentActWords] = useState<number>(0);
  const [isCompressingExtraction, setIsCompressingExtraction] = useState(false);
  const [showChaosOracle, setShowChaosOracle] = useState(false);

  // Pagination for managing 3000+ chapters (pages of 50 chapters)
  const [selectedVolumeFilter, setSelectedVolumeFilter] = useState<number>(1);
  const [chapterSearchQuery, setChapterSearchQuery] = useState<string>('');

  // Continuous batch pipeline states (Mode A)
  const [batchPipeline, setBatchPipeline] = useState<BatchPipelineStatus>({
    isRunning: false,
    isPaused: false,
    targetChapterCount: 5,
    completedInBatch: 0,
    currentStepDescription: '准备就绪',
    currentChapterWordCount: 0,
    errors: [],
    lastSavedAt: '无',
  });

  const [userConstraint, setUserConstraint] = useState(
    selectedEventForChapter && selectedEventForChapter.length > 0 
      ? `围绕事件【${selectedEventForChapter[0].title}】深入展开，要求环境描写与心理博弈兼备，字数坚决不少于4000字。` 
      : ''
  );
  const [povCharId, setPovCharId] = useState<string>(project.characters[0]?.id || '');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAskingSuggestion, setIsAskingSuggestion] = useState(false);
  const [lastActivatedLore, setLastActivatedLore] = useState<string[]>([]);
  const [operationNotice, setOperationNotice] = useState<{ message: string; details?: string; error?: boolean } | null>(null);
  const latestProjectRef = useRef(project);
  const latestCallbackRef = useRef(onUpdateProject);
  const mountedRef = useRef(true);
  const activeAIRef = useRef({ generation: false, extraction: false, suggestions: false });
  const batchRunRef = useRef<{ cancelled: boolean; projectId: string } | null>(null);
  latestProjectRef.current = project;
  latestCallbackRef.current = onUpdateProject;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (batchRunRef.current) batchRunRef.current.cancelled = true;
    };
  }, []);

  const commitProject = (updated: ProjectData) => {
    if (!mountedRef.current) return;
    latestProjectRef.current = updated;
    latestCallbackRef.current(updated);
  };

  // Filtered chapters for current volume
  const filteredChapters = useMemo(() => {
    return project.chapters.filter(ch => {
      const matchVol = Math.ceil(ch.chapterNumber / 50) === selectedVolumeFilter;
      if (chapterSearchQuery.trim()) {
        return ch.title.includes(chapterSearchQuery) || ch.chapterNumber.toString() === chapterSearchQuery;
      }
      return matchVol;
    });
  }, [project.chapters, selectedVolumeFilter, chapterSearchQuery]);

  const maxVolume = Math.max(1, Math.ceil(project.chapters.length / 50));
  const currentChapter = project.chapters.find(c => c.id === activeChapterId) || project.chapters[project.chapters.length - 1];
  const currentChapterIdRef = useRef(currentChapter?.id);
  currentChapterIdRef.current = currentChapter?.id;

  const handleUpdateChapterContent = (content: string) => {
    if (!currentChapter) return;
    const updatedChapters = project.chapters.map(ch => 
      ch.id === currentChapter.id ? { ...ch, content, wordCount: content.length, updatedAt: new Date().toLocaleString() } : ch
    );
    const updated = { ...project, chapters: updatedChapters };
    commitProject(updated);
  };

  const handleUpdateChapterOutline = (outline: string) => {
    if (!currentChapter) return;
    const updatedChapters = project.chapters.map(ch => 
      ch.id === currentChapter.id ? { ...ch, outline } : ch
    );
    const updated = { ...project, chapters: updatedChapters };
    commitProject(updated);
  };

  const handleCreateNewChapter = () => {
    const nextNum = project.chapters.length + 1;
    const nextVol = Math.ceil(nextNum / 100);
    const newCh: Chapter = {
      id: `chap_${Date.now()}`,
      volumeNumber: nextVol,
      chapterNumber: nextNum,
      title: `第${nextNum}章 (四幕大章草稿待拟)`,
      povCharacterId: povCharId,
      outline: '等待四幕流水线接力扩写...',
      content: '【请点击上方“起草 4000+ 字大章”自动扩写生成完整大章】',
      wordCount: 0,
      associatedEventIds: selectedEventForChapter?.map(e => e.id) || [],
      createdAt: new Date().toLocaleString(),
      updatedAt: new Date().toLocaleString(),
      status: 'draft'
    };
    const updated = { ...project, chapters: [...project.chapters, newCh] };
    commitProject(updated);
    setActiveChapterId(newCh.id);
    setSelectedVolumeFilter(Math.ceil(nextNum / 50));
  };

  // Run recursive memory extraction on current chapter (Auto-Story / recursive-novel mechanism)
  const handleCompressCurrentChapter = async () => {
    const source = latestProjectRef.current;
    const chapter = source.chapters.find(item => item.id === currentChapterIdRef.current);
    if (!chapter || activeAIRef.current.extraction || activeAIRef.current.generation || batchRunRef.current) return;
    const snapshot = captureNovelChapter(source, chapter.id);
    activeAIRef.current.extraction = true;
    setIsCompressingExtraction(true);
    setOperationNotice(null);
    try {
      const extraction = await RecursiveSummaryEngine.extractAndCompressChapter(source, chapter);
      if (!mountedRef.current) return;
      const updated = applyNovelChapterPatch(latestProjectRef.current, snapshot, { extraction, tensionScore: extraction.tensionScore });
      const details = JSON.stringify(extraction, null, 2);
      if (!updated || currentChapterIdRef.current !== chapter.id) {
        setOperationNotice({ message: '章节已变化，摘要已保留供你参考。', details });
        return;
      }
      commitProject(updated);
      setOperationNotice({ message: `事实摘要已提取，叙事张力 ${extraction.tensionScore}。`, details });
    } catch (error) {
      if (mountedRef.current) setOperationNotice({ message: `摘要提取失败：${error instanceof Error ? error.message : '请稍后重试'}`, error: true });
    } finally {
      activeAIRef.current.extraction = false;
      if (mountedRef.current) setIsCompressingExtraction(false);
    }
  };

  const handleTriggerAIGeneration = async () => {
    const source = latestProjectRef.current;
    const chapter = source.chapters.find(item => item.id === currentChapterIdRef.current);
    if (!chapter || activeAIRef.current.generation || activeAIRef.current.extraction || batchRunRef.current) return;
    const snapshot = captureNovelChapter(source, chapter.id);
    activeAIRef.current.generation = true;
    setIsGenerating(true);
    setOperationNotice(null);
    setCurrentActWords(0);
    setGenerationActStatus('正在构建因果与四幕大纲...');
    try {
      const targetEvents = selectedEventForChapter && selectedEventForChapter.length > 0 
        ? selectedEventForChapter 
        : source.events.slice(-3);

      const result = await GeminiService.generateChapter({
        project: source,
        volumeNumber: chapter.volumeNumber,
        chapterNumber: chapter.chapterNumber,
        povCharacterId: povCharId,
        events: targetEvents,
        userConstraint,
        onProgress: (actNum, actName, words, logMsg) => {
          if (!mountedRef.current || latestProjectRef.current.id !== source.id) throw new Error('创作已离开当前作品');
          setGenerationActStatus(`[${actName}] ${logMsg}`);
          setCurrentActWords(words);
        },
      });

      if (!mountedRef.current) return;
      const updated = applyNovelChapterPatch(latestProjectRef.current, snapshot, {
          title: result.title,
          outline: result.outline,
          content: result.content,
          wordCount: result.content.length,
          povCharacterId: povCharId,
          associatedEventIds: targetEvents.map(e => e.id),
          updatedAt: new Date().toLocaleString(),
          status: 'draft' as const,
      });
      if (!updated || currentChapterIdRef.current !== chapter.id) {
        setOperationNotice({ message: '章节已变化，生成草稿已保留供你参考。', details: `${result.title}\n\n【大纲】\n${result.outline}\n\n${result.content}` });
        return;
      }
      setLastActivatedLore(result.activatedLorebookKeys);
      commitProject(updated);
      setOperationNotice({ message: '本章草稿已生成，可以继续修改。' });
    } catch (error) {
      if (mountedRef.current) setOperationNotice({ message: `章节生成失败：${error instanceof Error ? error.message : '请检查模型设置后重试'}`, error: true });
    } finally {
      activeAIRef.current.generation = false;
      if (mountedRef.current) {
        setIsGenerating(false);
        setGenerationActStatus(null);
      }
    }
  };

  // Each completed chapter is committed only while its source project is current.
  const handleStartBatchPipeline = async (batchCount: number) => {
    if (batchRunRef.current || activeAIRef.current.generation || activeAIRef.current.extraction) return;
    const run = { cancelled: false, projectId: latestProjectRef.current.id };
    batchRunRef.current = run;
    const isCancelled = () => run.cancelled || !mountedRef.current || latestProjectRef.current.id !== run.projectId;
    setOperationNotice(null);
    setBatchPipeline({
      isRunning: true, isPaused: false, targetChapterCount: batchCount, completedInBatch: 0,
      currentStepDescription: '正在启动批量创作…', currentChapterWordCount: 0, errors: [], lastSavedAt: '尚未提交',
    });
    const outcome = await runNovelBatch({
      targetCount: batchCount,
      readProject: () => latestProjectRef.current,
      isCancelled,
      generate: async (source, index) => {
        const { updatedProject: steppedProject, newEvents } = SimulationEngine.stepTime(source, 8);
        const nextNum = Math.max(0, ...source.chapters.map(chapter => chapter.chapterNumber)) + 1;
        const nextVol = Math.ceil(nextNum / 100);
        const characterId = source.characters.length > 0 ? source.characters[index % source.characters.length].id : undefined;
        const result = await GeminiService.generateChapter({
          project: steppedProject, volumeNumber: nextVol, chapterNumber: nextNum, povCharacterId: characterId,
          events: newEvents.length > 0 ? newEvents : steppedProject.events.slice(-3),
          userConstraint: '严格执行四幕展开，环境与因果交融，单章不少于4000字。',
          onProgress: (_actNum, actName, words) => {
            if (isCancelled()) throw new Error('批量创作已停止');
            setBatchPipeline(previous => ({
              ...previous, currentChapterWordCount: words,
              currentStepDescription: `第 ${nextNum} 章 [${actName}] · 已生成 ${words} 字`,
            }));
          },
        });
        const now = new Date().toISOString();
        const chapter: Chapter = {
          id: `chap_${crypto.randomUUID()}`, volumeNumber: nextVol, chapterNumber: nextNum,
          title: result.title, outline: result.outline, content: result.content, wordCount: result.content.length,
          povCharacterId: characterId, associatedEventIds: newEvents.map(event => event.id),
          createdAt: now, updatedAt: now, status: 'draft',
        };
        return { ...steppedProject, chapters: [...steppedProject.chapters, chapter] };
      },
      commit: (updated, completed) => {
        if (isCancelled()) return;
        commitProject(updated);
        const chapter = updated.chapters[updated.chapters.length - 1];
        setActiveChapterId(chapter.id);
        setSelectedVolumeFilter(Math.ceil(chapter.chapterNumber / 50));
        setBatchPipeline(previous => ({
          ...previous, completedInBatch: completed, lastSavedAt: new Date().toLocaleTimeString(),
        }));
      },
      onConflict: output => {
        const chapter = output.chapters[output.chapters.length - 1];
        setOperationNotice({
          message: '作品在生成期间发生变化，批处理已停止。当前生成草稿已保留供你参考。',
          details: `${chapter.title}\n\n【大纲】\n${chapter.outline}\n\n${chapter.content}`,
        });
      },
      onError: message => {
        if (mountedRef.current) setBatchPipeline(previous => ({ ...previous, errors: [...previous.errors, message] }));
      },
    });
    if (batchRunRef.current === run) batchRunRef.current = null;
    if (!mountedRef.current) return;
    setBatchPipeline(previous => ({
      ...previous, isRunning: false, isPaused: false,
      completedInBatch: outcome.completed, errors: outcome.errors,
      currentStepDescription: `${outcome.stopped ? '任务已停止' : '本轮创作结束'}：成功 ${outcome.completed} / ${batchCount} 章，${outcome.errors.length} 项异常。`,
    }));
  };

  const handleStopBatchPipeline = () => {
    if (!batchRunRef.current) return;
    batchRunRef.current.cancelled = true;
    setBatchPipeline(previous => ({
      ...previous, isPaused: true, currentStepDescription: '正在停止，当前请求结束后将丢弃结果。',
    }));
  };
  const handleGetSuggestions = async () => {
    if (activeAIRef.current.suggestions) return;
    const source = latestProjectRef.current;
    activeAIRef.current.suggestions = true;
    setIsAskingSuggestion(true);
    try {
      const suggestions = await GeminiService.coWriteSuggestions(source, userConstraint || '请给出符合当前人物心境的发展推演');
      if (mountedRef.current && latestProjectRef.current.id === source.id) setAiSuggestions(suggestions);
    } catch (error) {
      if (mountedRef.current) setOperationNotice({ message: `构思请求失败：${error instanceof Error ? error.message : '请稍后重试'}`, error: true });
    } finally {
      activeAIRef.current.suggestions = false;
      if (mountedRef.current) setIsAskingSuggestion(false);
    }
  };

  const totalWords = project.chapters.reduce((acc, c) => acc + c.wordCount, 0);
  const avgWords = project.chapters.length > 0 ? Math.round(totalWords / project.chapters.length) : 0;

  return (
    <div className="space-y-6">
      {/* 3000 Chapters & Word Count Production Dashboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/60 text-purple-300 border border-purple-700/50">
                长篇创作计划
              </span>
              <span className="text-xs text-slate-400">单章保底目标: <strong>≥ 4,000 字</strong></span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm mt-1">
                <div>已撰写: <span className="text-xl font-bold font-mono text-white">{project.chapters.length}</span> <span className="text-slate-400 text-xs">章</span></div>
              <div>累计产出: <span className="text-xl font-bold font-mono text-purple-300">{(totalWords / 10000).toFixed(2)}</span> <span className="text-slate-400 text-xs">万字</span></div>
              <div>均章篇幅: <span className={`text-sm font-bold font-mono ${avgWords >= 4000 ? 'text-green-400' : 'text-amber-400'}`}>{avgWords}</span> <span className="text-slate-400 text-xs">字/章</span></div>
            </div>
          </div>

          {/* Batch Continuous Runner Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowChaosOracle(true)}
              className="px-3 py-2 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 text-xs font-semibold rounded-lg border border-purple-800 transition flex items-center gap-1.5"
              title="为故事寻找一个新的转折"
            >
              <Dices className="w-3.5 h-3.5 text-yellow-400" />
              混沌神谕骰子
            </button>
            <button
              onClick={() => handleStartBatchPipeline(3)}
              disabled={batchPipeline.isRunning || isGenerating || isCompressingExtraction}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
              title="自动模拟时间并连续创作 3 篇 4000+ 字完整大章"
            >
              <FastForward className="w-3.5 h-3.5 text-purple-400" />
              连跑 3 章 (约1.2万字)
            </button>
            <button
              onClick={() => handleStartBatchPipeline(10)}
              disabled={batchPipeline.isRunning || isGenerating || isCompressingExtraction}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
              title="自动模拟演进并连续创作 10 篇大章"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              批量连跑 10 章 (4万+字)
            </button>
            <button
              onClick={() => storageService.exportChaptersAsMarkdown(project)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              导出全本 (.md)
            </button>
          </div>
        </div>

        {/* Batch Status Bar */}
        {(batchPipeline.isRunning || batchPipeline.currentStepDescription !== '准备就绪') && (
          <div className="mt-4 space-y-3 rounded-lg border border-purple-800/50 bg-purple-950/30 p-3 text-xs text-purple-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2" role="status">
                <Activity className={`h-4 w-4 shrink-0 text-purple-400 ${batchPipeline.isRunning && !batchPipeline.isPaused ? 'animate-spin' : ''}`} />
                <span>{batchPipeline.currentStepDescription}</span>
              </div>
              {batchPipeline.isRunning && <button onClick={handleStopBatchPipeline} disabled={batchPipeline.isPaused} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-purple-800 px-3 py-1 disabled:opacity-50"><Pause className="h-3.5 w-3.5" />{batchPipeline.isPaused ? '正在停止…' : '停止任务'}</button>}
            </div>
            <p className="text-[11px] text-slate-400">已提交 {batchPipeline.completedInBatch} / {batchPipeline.targetChapterCount} 章{batchPipeline.isRunning ? ' · 离开本页会停止后续创作' : ''}</p>
            {batchPipeline.errors.length > 0 && <details className="text-[11px] text-amber-200"><summary className="cursor-pointer">查看 {batchPipeline.errors.length} 项异常</summary><ul className="mt-2 list-inside list-disc space-y-1">{batchPipeline.errors.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}
          </div>
        )}
      </div>

      {operationNotice && <div className={`rounded-xl border p-4 text-xs ${operationNotice.error ? 'border-red-800/60 bg-red-950/20 text-red-200' : 'border-purple-800/50 bg-slate-900 text-slate-200'}`}>
        <div className="flex items-start justify-between gap-4"><p role={operationNotice.error ? 'alert' : 'status'} className="leading-relaxed">{operationNotice.message}</p><button onClick={() => setOperationNotice(null)} aria-label="关闭创作提示" className="shrink-0 rounded px-2 py-1 text-[11px] text-slate-400">关闭</button></div>
        {operationNotice.details && <details className="mt-3"><summary className="cursor-pointer text-purple-300">查看生成内容（可选取复制）</summary><textarea readOnly aria-label="保留的创作结果" value={operationNotice.details} className="mt-3 min-h-48 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-serif leading-relaxed text-slate-200" /></details>}
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chapter Sidebar with Pagination for 3000 Chapters */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-400" />
                章节目录
              </h3>
              <button
                onClick={handleCreateNewChapter}
                className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
                title="新建章节"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Volume Filter */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>分册页签 (每组50章)：</span>
                <span className="font-mono">{selectedVolumeFilter} / {maxVolume}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedVolumeFilter(v => Math.max(1, v - 1))}
                  disabled={selectedVolumeFilter === 1}
                  className="p-1 bg-slate-800 rounded disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <select
                  value={selectedVolumeFilter}
                  onChange={e => setSelectedVolumeFilter(parseInt(e.target.value) || 1)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-xs text-white rounded p-1 outline-none font-mono"
                >
                  {Array.from({ length: maxVolume }, (_, i) => i + 1).map(vol => (
                    <option key={vol} value={vol}>
                      第 {(vol - 1) * 50 + 1} ~ {vol * 50} 章
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedVolumeFilter(v => Math.min(maxVolume, v + 1))}
                  disabled={selectedVolumeFilter === maxVolume}
                  className="p-1 bg-slate-800 rounded disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                value={chapterSearchQuery}
                onChange={e => setChapterSearchQuery(e.target.value)}
                placeholder="直搜章号或标题..."
                className="w-full bg-slate-950/60 border border-slate-800 rounded p-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredChapters.map(ch => {
                const isSelected = ch.id === currentChapter?.id;
                const meetsStandard = ch.wordCount >= 4000;
                return (
                  <button
                    type="button"
                    key={ch.id}
                    onClick={() => setActiveChapterId(ch.id)}
                    aria-pressed={isSelected}
                    className={`block w-full text-left p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected 
                        ? 'bg-purple-950/40 border-purple-500 text-white' 
                        : 'bg-slate-800/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="truncate pr-1">#{ch.chapterNumber} {ch.title}</span>
                      <span className={`text-[10px] font-mono px-1 rounded ${
                        meetsStandard ? 'bg-green-950 text-green-300' : 'bg-amber-950 text-amber-300'
                      }`}>
                        {ch.wordCount}字
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Narrative Engine Controls Drawer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Feather className="w-4 h-4 text-purple-400" />
                四幕接力扩写 (保底4000+字)
              </h4>
              <button
                onClick={onOpenAISettings}
                className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
                title="切换/配置模型"
              >
                <Sliders className="w-3 h-3" />
                调优
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">主视点 (POV) 担当人物</label>
              <select
                value={povCharId}
                onChange={e => setPovCharId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-purple-500"
              >
                {project.characters.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.title} ({c.currentMood})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">作者指令 / 禁忌约束</label>
              <textarea
                rows={3}
                value={userConstraint}
                onChange={e => setUserConstraint(e.target.value)}
                placeholder="例如：本章重点描写雨夜冷意与主角的心事，严格分四幕展开，不要透露鬼市密探的秘密..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleGetSuggestions}
                disabled={isAskingSuggestion}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 transition flex items-center justify-center gap-1"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                {isAskingSuggestion ? '构思中...' : '征求建议'}
              </button>
              <button
                onClick={handleTriggerAIGeneration}
                disabled={isGenerating || isCompressingExtraction || batchPipeline.isRunning || !currentChapter}
                className="py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition flex items-center justify-center gap-1 shadow"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                {isGenerating ? '四幕执笔中...' : '起草 4000+ 字大章'}
              </button>
            </div>

            {/* Live 4-Act Relay Progress Meter */}
            {generationActStatus && (
              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-lg text-slate-200 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>{generationActStatus}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  当前累计字数: <strong className="text-white font-mono">{currentActWords}</strong> 字
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Text Editing Area */}
        <div className="lg:col-span-9 space-y-4">
          {currentChapter ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={currentChapter.title}
                    onChange={e => {
                      const updatedChapters = project.chapters.map(ch => 
                        ch.id === currentChapter.id ? { ...ch, title: e.target.value } : ch
                      );
                      commitProject({ ...project, chapters: updatedChapters });
                    }}
                    className="text-xl font-serif font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 outline-none w-full"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className={`font-mono font-semibold ${
                      currentChapter.wordCount >= 4000 ? 'text-green-400' : 'text-amber-400'
                    }`}>
                      本章字数：{currentChapter.wordCount} 字 {currentChapter.wordCount >= 4000 ? '(已达标 4000+)' : '(未达4000字标称)'}
                    </span>
                    <span>所属卷：第 {currentChapter.volumeNumber} 卷</span>
                    <span>更新时间：{currentChapter.updatedAt}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCompressCurrentChapter}
                    disabled={isCompressingExtraction || isGenerating || batchPipeline.isRunning}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
                    title="自动提炼本章事实沉淀为超长篇递归记忆"
                  >
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isCompressingExtraction ? '提炼中...' : '递归事实沉淀'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const updatedChapters = project.chapters.map(ch => 
                        ch.id === currentChapter.id ? { ...ch, status: 'final' as const } : ch
                      );
                      const updated = { ...project, chapters: updatedChapters };
                      commitProject(updated);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    确认定稿
                  </button>
                </div>
              </div>

              {/* Chapter Outline Section */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  本章四幕大纲规划
                </label>
                <input
                  type="text"
                  value={currentChapter.outline}
                  onChange={e => handleUpdateChapterOutline(e.target.value)}
                  placeholder="简述本章发生的关键情节转折..."
                  className="w-full bg-transparent text-xs text-slate-300 outline-none"
                />
              </div>

              {/* Main Literary Textarea */}
              <div>
                <textarea
                  rows={24}
                  value={currentChapter.content}
                  onChange={e => handleUpdateChapterContent(e.target.value)}
                  placeholder="在此处输入小说章节正文 (单章建议 >= 4000 字)..."
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl p-5 text-slate-100 font-serif leading-loose text-base outline-none focus:border-purple-500/60 transition resize-y"
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              暂无章节，请在左侧点击“+”创建新章
            </div>
          )}
        </div>
      </div>

      {/* Chaos Oracle Modal */}
      {showChaosOracle && (
        <ChaosOracleModal
          project={project}
          onClose={() => setShowChaosOracle(false)}
          onApplyTwist={(twistText) => {
            setUserConstraint(prev => prev ? `${prev}\n\n${twistText}` : twistText);
          }}
        />
      )}
    </div>
  );
};
