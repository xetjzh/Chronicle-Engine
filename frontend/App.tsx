import React, { useState, useEffect } from 'react';
import { ProjectData, WorldEvent, ConsistencyIssue, LorebookEntry } from './types';
import { storageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { WorldSimConsole } from './components/WorldSimConsole';
import { NovelEditor } from './components/NovelEditor';
import { AuthorDeskEditor } from './components/AuthorDeskEditor';
import { DocumentLibraryModal } from './components/DocumentLibraryModal';
import { CharacterManager } from './components/CharacterManager';
import { WorldEditor } from './components/WorldEditor';
import { LorebookEditor } from './components/LorebookEditor';
import { ReaderView } from './components/ReaderView';
import { AISettingsModal } from './components/AISettingsModal';
import { AboutSystemModal } from './components/AboutSystemModal';
import { NarrativeAnalyticsModal } from './components/NarrativeAnalyticsModal';
import { ChaosOracleModal } from './components/ChaosOracleModal';
import { 
  Globe, BookOpen, Users, Compass, Eye, ShieldCheck, 
  Download, Upload, Sparkles, Settings2, RefreshCw, Cpu, 
  BookMarked, Database, Feather, FileText, Info, Activity, Dices
} from 'lucide-react';

export default function App() {
  const [project, setProject] = useState<ProjectData>(() => storageService.loadProject());
  const [currentTab, setCurrentTab] = useState<'SIMULATION' | 'NOVEL' | 'AUTHOR_DESK' | 'CHARACTERS' | 'WORLD' | 'LOREBOOK' | 'READER'>('AUTHOR_DESK');
  const [selectedEventForChapter, setSelectedEventForChapter] = useState<WorldEvent[]>([]);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showDocLibrary, setShowDocLibrary] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showChaosModal, setShowChaosModal] = useState(false);
  const [auditIssues, setAuditIssues] = useState<ConsistencyIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Asynchronous full IndexedDB hydration on app start
  useEffect(() => {
    storageService.loadProjectAsync().then(loaded => {
      if (loaded && loaded.chapters && loaded.chapters.length > project.chapters.length) {
        setProject(loaded);
      }
    });
  }, []);

  const handleUpdateProject = (p: ProjectData) => {
    setProject(p);
    storageService.saveProject(p);
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setShowAuditModal(true);
    try {
      const issues = await GeminiService.auditConsistency(project);
      setAuditIssues(issues);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.id && parsed.worldName) {
          handleUpdateProject(parsed);
          alert('项目备份已成功还原！');
        }
      } catch (err) {
        alert('无效的备份文件格式！');
      }
    };
    reader.readAsText(file);
  };

  const handleAddLorebookEntry = (lore: LorebookEntry) => {
    const updated = { ...project, lorebook: [...project.lorebook, lore] };
    handleUpdateProject(updated);
  };

  const activeProvider = project.aiConfig?.activeProvider || 'gemini';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {/* Top Glass Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-8 py-2.5 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 ring-1 ring-white/20">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base tracking-wider text-white">Chronicle Engine</h1>
                <span className="text-[10px] font-mono bg-purple-950/90 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800/80">
                  超长篇工作站
                </span>
                <button
                  onClick={() => setShowAISettings(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-mono bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 transition"
                  title="点击切换与配置模型"
                >
                  {activeProvider === 'gemini' ? (
                    <>
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      Gemini 2.5
                    </>
                  ) : activeProvider === 'ollama' ? (
                    <>
                      <Cpu className="w-3 h-3 text-emerald-400" />
                      Ollama 本地
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      OpenAI兼容
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">自主世界模拟 · 码字软件台 · TXT/EPUB/PDF 参考书</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 text-xs overflow-x-auto shadow-inner">
            <button
              onClick={() => setCurrentTab('AUTHOR_DESK')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'AUTHOR_DESK' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Feather className="w-3.5 h-3.5 text-yellow-300" />
              码字台 (纯享书写)
            </button>
            <button
              onClick={() => setCurrentTab('NOVEL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'NOVEL' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              AI流水线 ({project.chapters.length}章)
            </button>
            <button
              onClick={() => setCurrentTab('SIMULATION')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'SIMULATION' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              世界模拟控制台
            </button>
            <button
              onClick={() => setCurrentTab('LOREBOOK')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'LOREBOOK' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5 text-purple-300" />
              世界书 (Lorebook)
            </button>
            <button
              onClick={() => setCurrentTab('CHARACTERS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'CHARACTERS' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              人物档案
            </button>
            <button
              onClick={() => setCurrentTab('WORLD')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'WORLD' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              世界法则
            </button>
            <button
              onClick={() => setCurrentTab('READER')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'READER' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              沉浸阅读
            </button>
          </div>

          {/* Quick Tools */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="张力起伏与全书节奏图表分析（开源 StoryMetrics 移植）"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              张力图谱
            </button>
            <button
              onClick={() => setShowChaosModal(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-yellow-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="掷出剧情变故神谕骰子（开源 TaleCrafter 机制）"
            >
              <Dices className="w-3.5 h-3.5 text-yellow-400" />
              神谕骰子
            </button>
            <button
              onClick={() => setShowDocLibrary(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-purple-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="打开多格式参考书架"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              文献参考
            </button>
            <button
              onClick={() => setShowAISettings(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="配置 AI 工具端点与参数"
            >
              <Settings2 className="w-3.5 h-3.5 text-purple-400" />
              AI调优
            </button>
            <button
              onClick={handleRunAudit}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="运行一致性与时空穿帮审计"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              因果审计
            </button>
            <button
              onClick={() => storageService.exportAsJson(project)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="导出项目完整数据"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              备份
            </button>
            <label className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition cursor-pointer shadow-sm">
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              还原
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
            <button
              onClick={() => setShowAboutModal(true)}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition shadow-sm"
              title="关于系统 · 架构与部署"
            >
              <Info className="w-3.5 h-3.5 text-purple-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-6 lg:p-8">
        {currentTab === 'AUTHOR_DESK' && (
          <AuthorDeskEditor
            project={project}
            onUpdateProject={handleUpdateProject}
            onOpenDocumentLibrary={() => setShowDocLibrary(true)}
          />
        )}

        {currentTab === 'NOVEL' && (
          <NovelEditor
            project={project}
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
      </main>

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
              alert('已将引用摘录追加至正文末尾！');
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
              alert('已成功将神谕变故注录入大纲计划中！');
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">世界因果律与时空穿帮审计报告</h3>
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
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
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
          </div>
        </div>
      )}

      {/* About & System Architecture / Deployment Modal */}
      {showAboutModal && (
        <AboutSystemModal onClose={() => setShowAboutModal(false)} />
      )}
    </div>
  );
}
