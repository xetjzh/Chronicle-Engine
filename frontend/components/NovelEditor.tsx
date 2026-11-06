import React, { useState, useMemo } from 'react';
import { ProjectData, Chapter, WorldEvent, BatchPipelineStatus } from '../types';
import { GeminiService } from '../services/geminiService';
import { SimulationEngine } from '../services/simulationEngine';
import { storageService } from '../services/storageService';
import { RecursiveSummaryEngine } from '../services/recursiveSummaryEngine';
import { ChaosOracleModal } from './ChaosOracleModal';
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

  const handleUpdateChapterContent = (content: string) => {
    if (!currentChapter) return;
    const updatedChapters = project.chapters.map(ch => 
      ch.id === currentChapter.id ? { ...ch, content, wordCount: content.length, updatedAt: new Date().toLocaleString() } : ch
    );
    const updated = { ...project, chapters: updatedChapters };
    onUpdateProject(updated);
    storageService.saveProject(updated);
  };

  const handleUpdateChapterOutline = (outline: string) => {
    if (!currentChapter) return;
    const updatedChapters = project.chapters.map(ch => 
      ch.id === currentChapter.id ? { ...ch, outline } : ch
    );
    const updated = { ...project, chapters: updatedChapters };
    onUpdateProject(updated);
    storageService.saveProject(updated);
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
    onUpdateProject(updated);
    storageService.saveProject(updated);
    setActiveChapterId(newCh.id);
    setSelectedVolumeFilter(Math.ceil(nextNum / 50));
  };

  // Run recursive memory extraction on current chapter (Auto-Story / recursive-novel mechanism)
  const handleCompressCurrentChapter = async () => {
    if (!currentChapter || isCompressingExtraction) return;
    setIsCompressingExtraction(true);
    try {
      const extraction = await RecursiveSummaryEngine.extractAndCompressChapter(project, currentChapter);
      const updatedChapters = project.chapters.map(ch => 
        ch.id === currentChapter.id ? { ...ch, extraction, tensionScore: extraction.tensionScore } : ch
      );
      const updated = { ...project, chapters: updatedChapters };
      onUpdateProject(updated);
      storageService.saveProject(updated);
      alert(`递归事实沉淀完成！\n本章提炼摘要: ${extraction.chapterSummary}\n评估张力: ${extraction.tensionScore}`);
    } finally {
      setIsCompressingExtraction(false);
    }
  };

  const handleTriggerAIGeneration = async () => {
    if (!currentChapter) return;
    setIsGenerating(true);
    setGenerationActStatus('正在构建因果与四幕大纲...');
    try {
      const targetEvents = selectedEventForChapter && selectedEventForChapter.length > 0 
        ? selectedEventForChapter 
        : project.events.slice(-3);

      const result = await GeminiService.generateChapter({
        project,
        volumeNumber: currentChapter.volumeNumber,
        chapterNumber: currentChapter.chapterNumber,
        povCharacterId: povCharId,
        events: targetEvents,
        userConstraint,
        onProgress: (actNum, actName, words, logMsg) => {
          setGenerationActStatus(`[${actName}] ${logMsg}`);
          setCurrentActWords(words);
        },
      });

      setLastActivatedLore(result.activatedLorebookKeys);

      const updatedChapters = project.chapters.map(ch => 
        ch.id === currentChapter.id ? {
          ...ch,
          title: result.title,
          outline: result.outline,
          content: result.content,
          wordCount: result.content.length,
          povCharacterId: povCharId,
          associatedEventIds: targetEvents.map(e => e.id),
          updatedAt: new Date().toLocaleString(),
          status: 'draft' as const
        } : ch
      );

      const updated = { ...project, chapters: updatedChapters };
      onUpdateProject(updated);
      storageService.saveProject(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
      setGenerationActStatus(null);
    }
  };

  // Continuous Auto-Runner Pipeline (Mode A)
  const handleStartBatchPipeline = async (batchCount: number) => {
    setBatchPipeline({
      isRunning: true,
      isPaused: false,
      targetChapterCount: batchCount,
      completedInBatch: 0,
      currentStepDescription: '启动持续创作批处理任务...',
      currentChapterWordCount: 0,
      errors: [],
      lastSavedAt: new Date().toLocaleTimeString(),
    });

    let currentProj = { ...project };

    for (let i = 0; i < batchCount; i++) {
      try {
        setBatchPipeline(prev => ({
          ...prev,
          currentStepDescription: `【第 ${i + 1}/${batchCount} 批】推进虚拟世界因果时间片...`,
        }));

        // Advance simulation time
        const { updatedProject: steppedProject, newEvents } = SimulationEngine.stepTime(currentProj, 8);
        currentProj = steppedProject;

        const nextNum = currentProj.chapters.length + 1;
        const nextVol = Math.ceil(nextNum / 100);

        setBatchPipeline(prev => ({
          ...prev,
          currentStepDescription: `【第 ${i + 1}/${batchCount} 批】四幕接力执笔第 ${nextNum} 章 (保底4000字)...`,
        }));

        const result = await GeminiService.generateChapter({
          project: currentProj,
          volumeNumber: nextVol,
          chapterNumber: nextNum,
          povCharacterId: currentProj.characters[i % currentProj.characters.length]?.id,
          events: newEvents.length > 0 ? newEvents : currentProj.events.slice(-3),
          userConstraint: '严格执行四幕展开，环境与因果交融，单章不少于4000字。',
          onProgress: (actNum, actName, words, logMsg) => {
            setBatchPipeline(prev => ({
              ...prev,
              currentChapterWordCount: words,
              currentStepDescription: `第 ${nextNum} 章 [${actName}] - 已达 ${words} 字`,
            }));
          }
        });

        const newChapter: Chapter = {
          id: `chap_${Date.now()}_${nextNum}`,
          volumeNumber: nextVol,
          chapterNumber: nextNum,
          title: result.title,
          outline: result.outline,
          content: result.content,
          wordCount: result.content.length,
          povCharacterId: currentProj.characters[i % currentProj.characters.length]?.id,
          associatedEventIds: newEvents.map(e => e.id),
          createdAt: new Date().toLocaleString(),
          updatedAt: new Date().toLocaleString(),
          status: 'draft',
        };

        currentProj = {
          ...currentProj,
          chapters: [...currentProj.chapters, newChapter],
        };

        // Persist to IndexedDB after every chapter
        onUpdateProject(currentProj);
        storageService.saveProject(currentProj);

        setActiveChapterId(newChapter.id);
        setSelectedVolumeFilter(Math.ceil(nextNum / 50));

        setBatchPipeline(prev => ({
          ...prev,
          completedInBatch: i + 1,
          lastSavedAt: new Date().toLocaleTimeString(),
        }));
      } catch (err: any) {
        console.error('Batch error on index', i, err);
        setBatchPipeline(prev => ({
          ...prev,
          errors: [...prev.errors, `第 ${i + 1} 章执行异常: ${err.message}`],
        }));
      }
    }

    setBatchPipeline(prev => ({
      ...prev,
      isRunning: false,
      currentStepDescription: `批处理任务已顺利完成，本轮共新增 ${batchCount} 章！`,
    }));
  };

  const handleGetSuggestions = async () => {
    setIsAskingSuggestion(true);
    try {
      const suggestions = await GeminiService.coWriteSuggestions(project, userConstraint || '请给出符合当前人物心境的发展推演');
      setAiSuggestions(suggestions);
    } finally {
      setIsAskingSuggestion(false);
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
                超长篇持续续航保障引擎 (IndexedDB 工业级存储)
              </span>
              <span className="text-xs text-slate-400">单章保底目标: <strong>≥ 4,000 字</strong></span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm mt-1">
              <div>已撰写: <span className="text-xl font-bold font-mono text-white">{project.chapters.length}</span> <span className="text-slate-400 text-xs">/ 3000+ 章</span></div>
              <div>累计产出: <span className="text-xl font-bold font-mono text-purple-300">{(totalWords / 10000).toFixed(2)}</span> <span className="text-slate-400 text-xs">万字</span></div>
              <div>均章篇幅: <span className={`text-sm font-bold font-mono ${avgWords >= 4000 ? 'text-green-400' : 'text-amber-400'}`}>{avgWords}</span> <span className="text-slate-400 text-xs">字/章</span></div>
            </div>
          </div>

          {/* Batch Continuous Runner Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowChaosOracle(true)}
              className="px-3 py-2 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 text-xs font-semibold rounded-lg border border-purple-800 transition flex items-center gap-1.5"
              title="掷出剧情因果神谕（开源 TaleCrafter 机制）"
            >
              <Dices className="w-3.5 h-3.5 text-yellow-400" />
              混沌神谕骰子
            </button>
            <button
              onClick={() => handleStartBatchPipeline(3)}
              disabled={batchPipeline.isRunning}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
              title="自动模拟时间并连续创作 3 篇 4000+ 字完整大章"
            >
              <FastForward className="w-3.5 h-3.5 text-purple-400" />
              连跑 3 章 (约1.2万字)
            </button>
            <button
              onClick={() => handleStartBatchPipeline(10)}
              disabled={batchPipeline.isRunning}
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
        {batchPipeline.isRunning && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-purple-300 bg-purple-950/30 p-3 rounded-lg border border-purple-800/50 animate-pulse">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400 animate-spin" />
              <span>{batchPipeline.currentStepDescription}</span>
            </div>
            <span className="font-mono">
              进度: {batchPipeline.completedInBatch} / {batchPipeline.targetChapterCount} 章
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chapter Sidebar with Pagination for 3000 Chapters */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-400" />
                超长篇目录管理
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
                  <div
                    key={ch.id}
                    onClick={() => setActiveChapterId(ch.id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
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
                  </div>
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
                disabled={isGenerating}
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
                      onUpdateProject({ ...project, chapters: updatedChapters });
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
                    disabled={isCompressingExtraction}
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
                      onUpdateProject(updated);
                      storageService.saveProject(updated);
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
