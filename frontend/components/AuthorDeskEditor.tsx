import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, Chapter, WritingDeskSettings, ImportedDocument } from '../types';
import { storageService } from '../services/storageService';
import { soundEffects } from '../services/soundEffects';
import { AIProviderService } from '../services/aiProviderService';
import { 
  Maximize2, Minimize2, BookOpen, Target, 
  AlignLeft, SplitSquareVertical, 
  Check, Type, Palette, Volume2, VolumeX,
  Sparkles, Wand2, ArrowUpRight, Flame, Clock, RefreshCw
} from 'lucide-react';

interface AuthorDeskEditorProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  onOpenDocumentLibrary: () => void;
}

export const AuthorDeskEditor: React.FC<AuthorDeskEditorProps> = ({
  project,
  onUpdateProject,
  onOpenDocumentLibrary,
}) => {
  const [activeChapterId, setActiveChapterId] = useState<string>(project.chapters[0]?.id || '');
  const [deskSettings, setDeskSettings] = useState<WritingDeskSettings>(project.deskSettings || {
    targetDailyWords: 6000,
    currentSessionWords: 0,
    isZenMode: false,
    typewriterMode: true,
    indentParagraphs: true,
    theme: 'ink',
    fontSize: 18,
    lineHeight: 1.9,
    fontFamily: 'serif',
    soundEnabled: true,
  });

  const [initialSessionCount, setInitialSessionCount] = useState<number>(0);
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [splitDocPreview, setSplitDocPreview] = useState<ImportedDocument | null>(project.referenceDocs?.[0] || null);
  const [isSplitReferenceOpen, setIsSplitReferenceOpen] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('已自动存盘');
  const [isAIAssisting, setIsAIAssisting] = useState<boolean>(false);
  const [selectedSnippet, setSelectedSnippet] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChapter = project.chapters.find(c => c.id === activeChapterId) || project.chapters[0];

  useEffect(() => {
    if (currentChapter) {
      setInitialSessionCount(currentChapter.wordCount);
    }
  }, [activeChapterId]);

  // Handle typing & dynamic word counting
  const handleContentChange = (newContent: string) => {
    if (!currentChapter) return;
    
    if (deskSettings.soundEnabled) {
      soundEffects.playKeyClick();
    }

    const words = newContent.length;

    const updatedChapters = project.chapters.map(ch => 
      ch.id === currentChapter.id ? {
        ...ch,
        content: newContent,
        wordCount: words,
        updatedAt: new Date().toLocaleString(),
      } : ch
    );

    const updatedSettings = {
      ...deskSettings,
      currentSessionWords: deskSettings.currentSessionWords + (words > currentChapter.wordCount ? (words - currentChapter.wordCount) : 0),
    };

    setDeskSettings(updatedSettings);

    const updatedProject = {
      ...project,
      chapters: updatedChapters,
      deskSettings: updatedSettings,
    };

    onUpdateProject(updatedProject);
    storageService.saveProject(updatedProject);

    setSaveStatus('正在存盘...');
    setTimeout(() => setSaveStatus('已自动存盘'), 600);
  };

  // Color themes for the writing environment
  const themeClassMap: Record<string, { bg: string; text: string; card: string; border: string }> = {
    ink: {
      bg: 'bg-slate-950',
      text: 'text-slate-100',
      card: 'bg-slate-900/90',
      border: 'border-slate-800',
    },
    sepia: {
      bg: 'bg-[#f4ecd8]',
      text: 'text-[#3f2f21]',
      card: 'bg-[#e8dcbf]',
      border: 'border-[#d3c29e]',
    },
    dark_emerald: {
      bg: 'bg-[#061814]',
      text: 'text-[#c2e4d8]',
      card: 'bg-[#0b2821]',
      border: 'border-[#123e34]',
    },
    nord: {
      bg: 'bg-[#2e3440]',
      text: 'text-[#eceff4]',
      card: 'bg-[#3b4252]',
      border: 'border-[#4c566a]',
    },
  };

  const currentTheme = themeClassMap[deskSettings.theme] || themeClassMap.ink;

  // Format paragraphs with 2-em indentation
  const handleFormatIndent = () => {
    if (!currentChapter) return;
    const formatted = currentChapter.content
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (trimmed.length === 0) return '';
        if (trimmed.startsWith('　　')) return trimmed;
        return `　　${trimmed}`;
      })
      .join('\n\n');

    handleContentChange(formatted);
    soundEffects.playChime();
  };

  // AI Instant Polish/Expand for selected or recent text
  const handleAIPolishSnippet = async (type: 'polish' | 'expand') => {
    if (!currentChapter || isAIAssisting) return;
    setIsAIAssisting(true);

    const textarea = textareaRef.current;
    let targetText = '';
    let isSelection = false;

    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      targetText = currentChapter.content.substring(textarea.selectionStart, textarea.selectionEnd);
      isSelection = true;
    } else {
      // Take last 300 characters
      targetText = currentChapter.content.slice(-350);
    }

    if (!targetText.trim()) {
      setIsAIAssisting(false);
      return;
    }

    const instruction = type === 'polish'
      ? '请将以下小说段落进行古典文学性润色，增强环境音画、人物细微眼神与情绪暗涌，去除网络化白话：'
      : '请紧密接续以下剧情，顺畅扩写两段具有极强文学厚度的叙事正文（约300字）：';

    try {
      const generated = await AIProviderService.generateText(project.aiConfig, {
        prompt: `${instruction}\n\n“${targetText}”\n\n直接输出处理后的纯正文。`,
        overrideSampling: { temperature: 0.75 },
      });

      if (generated && generated.trim()) {
        soundEffects.playChime();
        if (isSelection && textarea) {
          const before = currentChapter.content.substring(0, textarea.selectionStart);
          const after = currentChapter.content.substring(textarea.selectionEnd);
          handleContentChange(before + generated.trim() + after);
        } else {
          handleContentChange(currentChapter.content + '\n\n' + generated.trim());
        }
      }
    } catch (e: any) {
      alert(`AI 灵感生成未完成: ${e.message}`);
    } finally {
      setIsAIAssisting(false);
    }
  };

  const currentWords = currentChapter?.wordCount || 0;
  const progressRatio = Math.min(100, Math.round((deskSettings.currentSessionWords / deskSettings.targetDailyWords) * 100));

  return (
    <div className={`transition-all duration-300 flex flex-col rounded-2xl border ${currentTheme.border} ${currentTheme.bg} ${currentTheme.text} overflow-hidden shadow-2xl relative ${
      deskSettings.isZenMode ? 'fixed inset-0 z-50 rounded-none border-none' : 'min-h-[85vh]'
    }`}>
      {/* Top Floating Glass Toolbar */}
      <div className={`px-4 sm:px-6 py-2.5 border-b ${currentTheme.border} ${currentTheme.card} backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs select-none sticky top-0 z-30`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold font-serif text-sm tracking-wide">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
            <span>作者码字台</span>
          </div>

          <span className="hidden sm:inline-block opacity-30">/</span>

          {/* Chapter Quick Switcher */}
          <select
            value={activeChapterId}
            onChange={e => setActiveChapterId(e.target.value)}
            className={`bg-black/20 border ${currentTheme.border} rounded-lg px-2.5 py-1 text-xs outline-none max-w-[220px] font-medium truncate`}
          >
            {project.chapters.map(ch => (
              <option key={ch.id} value={ch.id} className="bg-slate-900 text-slate-100">
                #{ch.chapterNumber} {ch.title} ({ch.wordCount}字)
              </option>
            ))}
          </select>

          <span className="text-[11px] opacity-70 font-mono hidden md:inline-flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" />
            {saveStatus}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* AI Instant Polish/Expand */}
          <button
            onClick={() => handleAIPolishSnippet('polish')}
            disabled={isAIAssisting}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 transition ${isAIAssisting ? 'opacity-50' : ''}`}
            title="对选中文本或最近段落进行文学润色"
          >
            {isAIAssisting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-purple-400" />}
            <span className="hidden sm:inline">文采润色</span>
          </button>

          <button
            onClick={() => handleAIPolishSnippet('expand')}
            disabled={isAIAssisting}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 transition ${isAIAssisting ? 'opacity-50' : ''}`}
            title="接续当前光标或段落智能续写展开"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span className="hidden sm:inline">顺滑续写</span>
          </button>

          {/* Format Paragraphs Indent */}
          <button
            onClick={handleFormatIndent}
            className={`px-2.5 py-1 bg-black/20 hover:bg-black/30 rounded-lg flex items-center gap-1 border ${currentTheme.border} transition`}
            title="一键首行全角缩进与空行规范"
          >
            <AlignLeft className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">段落排版</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setDeskSettings({ ...deskSettings, soundEnabled: !deskSettings.soundEnabled })}
            className={`p-1.5 bg-black/20 hover:bg-black/30 rounded-lg border ${currentTheme.border}`}
            title={deskSettings.soundEnabled ? '已开启打字音效' : '已静音打字音效'}
          >
            {deskSettings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-purple-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Split Reference Doc Toggle */}
          <button
            onClick={() => setIsSplitReferenceOpen(!isSplitReferenceOpen)}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 border transition ${
              isSplitReferenceOpen ? 'bg-purple-600 text-white border-purple-500' : `bg-black/20 border ${currentTheme.border}`
            }`}
            title="双屏对照：在右侧对照阅读 TXT/EPUB/PDF 参考书"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">双屏对照</span>
          </button>

          {/* Open Document Library */}
          <button
            onClick={onOpenDocumentLibrary}
            className={`px-2.5 py-1 bg-black/20 hover:bg-black/30 rounded-lg flex items-center gap-1 border ${currentTheme.border} transition`}
            title="打开文献参考书架"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">文献库</span>
          </button>

          {/* Theme Palette Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`p-1.5 bg-black/20 hover:bg-black/30 rounded-lg border ${currentTheme.border}`}
              title="切换纸张色彩"
            >
              <Palette className="w-3.5 h-3.5 text-purple-400" />
            </button>

            {showThemePicker && (
              <div className="absolute right-0 top-8 z-50 bg-slate-900 border border-slate-700 rounded-xl p-2.5 shadow-2xl flex flex-col gap-1 w-32 text-xs text-slate-200">
                <button 
                  onClick={() => { setDeskSettings({ ...deskSettings, theme: 'ink' }); setShowThemePicker(false); }} 
                  className="px-2 py-1.5 rounded hover:bg-slate-800 text-left flex items-center justify-between"
                >
                  <span>玄墨暗夜</span>
                  {deskSettings.theme === 'ink' && <Check className="w-3 h-3 text-purple-400" />}
                </button>
                <button 
                  onClick={() => { setDeskSettings({ ...deskSettings, theme: 'sepia' }); setShowThemePicker(false); }} 
                  className="px-2 py-1.5 rounded hover:bg-slate-800 text-left flex items-center justify-between"
                >
                  <span>古雅羊皮</span>
                  {deskSettings.theme === 'sepia' && <Check className="w-3 h-3 text-purple-400" />}
                </button>
                <button 
                  onClick={() => { setDeskSettings({ ...deskSettings, theme: 'dark_emerald' }); setShowThemePicker(false); }} 
                  className="px-2 py-1.5 rounded hover:bg-slate-800 text-left flex items-center justify-between"
                >
                  <span>竹墨护眼</span>
                  {deskSettings.theme === 'dark_emerald' && <Check className="w-3 h-3 text-purple-400" />}
                </button>
                <button 
                  onClick={() => { setDeskSettings({ ...deskSettings, theme: 'nord' }); setShowThemePicker(false); }} 
                  className="px-2 py-1.5 rounded hover:bg-slate-800 text-left flex items-center justify-between"
                >
                  <span>极地冰蓝</span>
                  {deskSettings.theme === 'nord' && <Check className="w-3 h-3 text-purple-400" />}
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen Zen Mode */}
          <button
            onClick={() => setDeskSettings({ ...deskSettings, isZenMode: !deskSettings.isZenMode })}
            className={`p-1.5 bg-black/20 hover:bg-black/30 rounded-lg border ${currentTheme.border}`}
            title={deskSettings.isZenMode ? '退出沉浸全屏' : '全屏纯净沉浸码字'}
          >
            {deskSettings.isZenMode ? <Minimize2 className="w-3.5 h-3.5 text-purple-400" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Typing Desk Canvas */}
        <div className="flex-1 flex flex-col p-4 sm:p-10 max-w-4xl mx-auto w-full overflow-y-auto">
          {currentChapter ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Chapter Title Edit */}
              <input
                type="text"
                value={currentChapter.title}
                onChange={e => {
                  const updatedChapters = project.chapters.map(ch => 
                    ch.id === currentChapter.id ? { ...ch, title: e.target.value } : ch
                  );
                  onUpdateProject({ ...project, chapters: updatedChapters });
                }}
                className="text-2xl sm:text-3xl font-serif font-bold bg-transparent border-b border-transparent hover:border-slate-700/50 focus:border-purple-500 outline-none w-full pb-2 tracking-wide"
                placeholder="在此输入章节名..."
              />

              {/* Main Typing Textarea */}
              <textarea
                ref={textareaRef}
                value={currentChapter.content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="静心凝神，开始您的创作... (支持打字机滚动模式)"
                className="flex-1 w-full bg-transparent outline-none resize-none font-serif leading-loose text-justify transition select-text pb-40"
                style={{
                  fontSize: `${deskSettings.fontSize}px`,
                  lineHeight: deskSettings.lineHeight,
                }}
              />
            </div>
          ) : (
            <div className="p-12 text-center opacity-60">请先在目录中选择章节</div>
          )}
        </div>

        {/* Right Split Reference Drawer */}
        {isSplitReferenceOpen && (
          <div className={`w-80 sm:w-96 border-l ${currentTheme.border} ${currentTheme.card} flex flex-col overflow-hidden text-xs shadow-xl animate-in slide-in-from-right`}>
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                对照素材视窗
              </span>
              <button 
                onClick={() => setIsSplitReferenceOpen(false)}
                className="p-1 hover:bg-black/20 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-2 border-b border-slate-800/80">
              <select
                value={splitDocPreview?.id || ''}
                onChange={e => {
                  const found = project.referenceDocs?.find(d => d.id === e.target.value);
                  if (found) setSplitDocPreview(found);
                }}
                className="w-full bg-black/20 border border-slate-800 rounded p-1.5 text-xs outline-none"
              >
                {(project.referenceDocs || []).map(doc => (
                  <option key={doc.id} value={doc.id} className="bg-slate-900 text-slate-100">
                    {doc.title} ({doc.format.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-serif leading-relaxed text-slate-300 select-text whitespace-pre-line text-[13px]">
              {splitDocPreview?.parsedChapters?.[0]?.content || '暂无可参考的文字内容，请在书架中导入 TXT 或 EPUB'}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Real-time Writer Statistics Bar */}
      <div className={`px-4 sm:px-6 py-2 border-t ${currentTheme.border} ${currentTheme.card} backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-mono select-none`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-purple-300">
              <Target className="w-3.5 h-3.5" />
              本日进度: {deskSettings.currentSessionWords} / {deskSettings.targetDailyWords} 字
            </span>
            <div className="w-16 h-1.5 bg-black/30 rounded-full overflow-hidden hidden sm:block">
              <div className="h-full bg-purple-500 rounded-full transition-all duration-300" style={{ width: `${progressRatio}%` }}></div>
            </div>
          </div>

          <span className="opacity-80">本章: <strong className="text-white">{currentWords}</strong> 字</span>
          <span className="hidden sm:inline opacity-80">全书: <strong className="text-white">{project.chapters.reduce((a,c) => a + c.wordCount, 0)}</strong> 字</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-black/20 rounded p-0.5">
            <button 
              onClick={() => setDeskSettings(s => ({ ...s, fontSize: Math.max(14, s.fontSize - 1) }))}
              className="px-1.5 py-0.5 hover:bg-black/30 rounded"
              title="缩小字号"
            >
              A-
            </button>
            <span className="px-1">{deskSettings.fontSize}px</span>
            <button 
              onClick={() => setDeskSettings(s => ({ ...s, fontSize: Math.min(28, s.fontSize + 1) }))}
              className="px-1.5 py-0.5 hover:bg-black/30 rounded"
              title="放大字号"
            >
              A+
            </button>
          </div>

          <span className="opacity-60 hidden md:inline">{project.currentSimulationTime}</span>
        </div>
      </div>
    </div>
  );
};
