import React, { useState } from 'react';
import { ProjectData, ImportedDocument, DocumentExcerpt, LorebookEntry } from '../types';
import { DocumentParserService } from '../services/documentParserService';
import { AIProviderService } from '../services/aiProviderService';
import { storageService } from '../services/storageService';
import { 
  X, FileText, Upload, BookOpen, Trash2, Copy, Check, 
  Search, ExternalLink, Eye, ChevronRight, FileCode, Layers,
  BookmarkPlus, Sparkles, Wand2, Tag, BookMarked, MessageSquareText,
  Highlighter, RefreshCw, ArrowRight, CornerDownRight, Quote
} from 'lucide-react';

interface DocumentLibraryModalProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  onClose: () => void;
  onInsertReferenceSnippet?: (snippet: string) => void;
  onConvertToLorebook?: (loreEntry: LorebookEntry) => void;
}

export const DocumentLibraryModal: React.FC<DocumentLibraryModalProps> = ({
  project,
  onUpdateProject,
  onClose,
  onInsertReferenceSnippet,
  onConvertToLorebook,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(project.referenceDocs?.[0]?.id || '');
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'READER' | 'EXCERPTS' | 'AI_PROBE'>('READER');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Reader Themes (Foliate / Calibre ported)
  const [readerTheme, setReaderTheme] = useState<'ink' | 'sepia' | 'emerald' | 'paper'>('ink');
  const [fontSize, setFontSize] = useState<number>(16);

  // Selection & Excerpt Card Creator
  const [highlightSelection, setHighlightSelection] = useState<string>('');
  const [newCardNote, setNewCardNote] = useState<string>('');
  const [newCardTags, setNewCardTags] = useState<string>('考据备忘');

  // AI Document Probe (RAG Extraction / Smart Connections ported)
  const [probeQuestion, setProbeQuestion] = useState<string>('从本章节中提炼所有关于地貌、服饰器皿或奇特风俗的描写细节：');
  const [probeAnswer, setProbeAnswer] = useState<string>('');
  const [isProbing, setIsProbing] = useState<boolean>(false);

  const docs = project.referenceDocs || [];
  const currentDoc = docs.find(d => d.id === selectedDocId) || docs[0];
  const currentChapter = currentDoc?.parsedChapters?.[selectedChapterIdx] || currentDoc?.parsedChapters?.[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newDocs: ImportedDocument[] = [...docs];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();

        let parsed: ImportedDocument;
        if (ext === 'txt' || ext === 'md') {
          parsed = await DocumentParserService.parseTxtFile(file);
        } else if (ext === 'epub') {
          parsed = await DocumentParserService.parseEpubFile(file);
        } else if (ext === 'pdf') {
          parsed = await DocumentParserService.parsePdfFile(file);
        } else {
          parsed = await DocumentParserService.parseTxtFile(file);
        }

        parsed.category = 'worldbuilding';
        parsed.tags = ['外部导入', ext?.toUpperCase() || 'TXT'];
        parsed.excerpts = [];
        newDocs.unshift(parsed);
      }

      const updated = { ...project, referenceDocs: newDocs };
      onUpdateProject(updated);
      storageService.saveProject(updated);
      if (newDocs[0]) {
        setSelectedDocId(newDocs[0].id);
        setSelectedChapterIdx(0);
      }
    } catch (err: any) {
      alert(`导入文件失败: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = (id: string) => {
    if (!confirm('确定要从参考书架中移除此文件吗？')) return;
    const filtered = docs.filter(d => d.id !== id);
    const updated = { ...project, referenceDocs: filtered };
    onUpdateProject(updated);
    storageService.saveProject(updated);
    if (selectedDocId === id) {
      setSelectedDocId(filtered[0]?.id || '');
      setSelectedChapterIdx(0);
    }
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(text.slice(0, 30));
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  // Text selection listener for reader pane
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setHighlightSelection(selection.toString().trim());
    }
  };

  // Create Zettelkasten Excerpt Card (Logseq / Zotero ported)
  const handleSaveExcerptCard = () => {
    if (!highlightSelection.trim() || !currentDoc) return;
    const card: DocumentExcerpt = {
      id: `exc_${Date.now()}`,
      docId: currentDoc.id,
      docTitle: currentDoc.title,
      chapterTitle: currentChapter?.title || '未命名章节',
      selectedText: highlightSelection,
      userNote: newCardNote.trim() || '摘录自文献正文，作为创作考据细节。',
      tags: newCardTags.split(/[,，\s]+/).filter(Boolean),
      createdAt: new Date().toLocaleString(),
    };

    const docExcerpts = currentDoc.excerpts || [];
    const updatedDocs = docs.map(d => 
      d.id === currentDoc.id ? { ...d, excerpts: [card, ...docExcerpts] } : d
    );

    const updated = { ...project, referenceDocs: updatedDocs };
    onUpdateProject(updated);
    storageService.saveProject(updated);

    setHighlightSelection('');
    setNewCardNote('');
    alert('已成功归档至【考据卡片盒】！可随时引用或一键转为世界书条目。');
  };

  // Convert an Excerpt directly into a Lorebook World Info Entry (NovelCrafter ported)
  const handleConvertCardToLore = (excerpt: DocumentExcerpt) => {
    const keys = [...excerpt.tags, excerpt.chapterTitle.slice(0, 8)].filter(Boolean);
    const newLore: LorebookEntry = {
      id: `lore_${Date.now()}`,
      name: `考据·${excerpt.chapterTitle}`,
      keys: keys.length > 0 ? keys : ['参考设定'],
      content: `【文献摘录依据·《${excerpt.docTitle}》】：\n${excerpt.selectedText}\n\n【创作者备忘】：${excerpt.userNote}`,
      isConstant: false,
      enabled: true,
      insertionOrder: 30,
      scanDepth: 1000,
      comment: `由考据文献自动转化生成 (${excerpt.docTitle})`,
    };

    if (onConvertToLorebook) {
      onConvertToLorebook(newLore);
    } else {
      const updatedLore = [...project.lorebook, newLore];
      const updated = { ...project, lorebook: updatedLore };
      onUpdateProject(updated);
      storageService.saveProject(updated);
    }
    alert(`成功！已将卡片转录为世界书词条【${newLore.name}】，触发词: [${newLore.keys.join(', ')}]`);
  };

  // AI RAG Deep Probe (Obsidian Smart Connections / TaleCrafter ported)
  const handleRunAIProbe = async (customInstruction?: string) => {
    if (!currentChapter || isProbing) return;
    setIsProbing(true);
    setProbeAnswer('');

    const query = customInstruction || probeQuestion;
    const prompt = `你是一位严谨的虚构文学考据助手。请阅读以下文献节选（来自《${currentDoc.title}》· ${currentChapter.title}）：

【文献正文】：
${currentChapter.content.slice(0, 4000)}

【考据目标】：
${query}

请提取出可以直接融入小说创作的高质量具象细节（包括专有名词、生活器物、言语口吻、气候气味），并分条列出：`;

    try {
      const res = await AIProviderService.generateText(project.aiConfig, {
        prompt,
        systemInstruction: '你是一位精通古代生活史、器物学与民间风俗的专业文学考据学者。',
        overrideSampling: { temperature: 0.6 },
      });
      setProbeAnswer(res);
    } catch (err: any) {
      setProbeAnswer(`AI 考据解析出错: ${err.message}`);
    } finally {
      setIsProbing(false);
    }
  };

  // Filter docs by category
  const filteredDocs = docs.filter(d => 
    selectedCategory === 'all' || d.category === selectedCategory
  );

  const filteredChapters = currentDoc?.parsedChapters?.filter(c => 
    !searchQuery.trim() || c.title.includes(searchQuery) || c.content.includes(searchQuery)
  ) || [];

  const allExcerpts = (currentDoc?.excerpts || []);

  const readerThemeClasses = {
    ink: 'bg-slate-950 text-slate-100 selection:bg-purple-500/30 selection:text-purple-200',
    sepia: 'bg-[#f4ecd8] text-[#3f2f21] selection:bg-amber-300 selection:text-amber-900',
    emerald: 'bg-[#081b16] text-[#c7e8dc] selection:bg-emerald-500/30 selection:text-emerald-200',
    paper: 'bg-[#faf8f5] text-[#2c2b29] selection:bg-slate-200 selection:text-slate-900',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full h-[92vh] flex flex-col text-slate-200 overflow-hidden shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3.5 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                作者多源参考书架与文献查阅台
                <span className="text-xs font-normal text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 font-mono">
                  开源 Foliate + Zotero 移植
                </span>
              </h3>
              <p className="text-xs text-slate-400">TXT/EPUB/PDF 兼容 · 闪念考据卡片盒 · AI文献探针 · 一键转录世界书</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? '解析中...' : '导入本地书籍 / 资料'}</span>
              <input 
                type="file" 
                multiple 
                accept=".txt,.md,.epub,.pdf" 
                onChange={handleFileUpload} 
                className="hidden" 
                disabled={isUploading}
              />
            </label>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Workspace */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Document List & Category Shelf */}
          <div className="md:col-span-3 border-r border-slate-800 bg-slate-950/40 p-3 flex flex-col gap-3 overflow-hidden">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-1 rounded-md transition whitespace-nowrap ${
                  selectedCategory === 'all' ? 'bg-purple-600 text-white font-medium' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                全部 ({docs.length})
              </button>
              <button
                onClick={() => setSelectedCategory('history')}
                className={`px-2 py-1 rounded-md transition whitespace-nowrap ${
                  selectedCategory === 'history' ? 'bg-purple-600 text-white font-medium' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                史地考据
              </button>
              <button
                onClick={() => setSelectedCategory('worldbuilding')}
                className={`px-2 py-1 rounded-md transition whitespace-nowrap ${
                  selectedCategory === 'worldbuilding' ? 'bg-purple-600 text-white font-medium' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                设定设定
              </button>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredDocs.map(doc => {
                const isSelected = doc.id === currentDoc?.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setSelectedChapterIdx(0);
                    }}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-start justify-between gap-2 group ${
                      isSelected 
                        ? 'bg-purple-950/40 border-purple-500 text-white shadow' 
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2 overflow-hidden">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold shrink-0 mt-0.5 ${
                        doc.format === 'pdf' ? 'bg-red-950 text-red-300 border border-red-800' :
                        doc.format === 'epub' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {doc.format}
                      </span>
                      <div className="overflow-hidden">
                        <div className="font-medium truncate">{doc.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{doc.parsedChapters?.length || 1} 章节</span>
                          {doc.excerpts && doc.excerpts.length > 0 && (
                            <span className="text-purple-300">· {doc.excerpts.length} 卡片</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDoc(doc.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition"
                      title="移除书籍"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {filteredDocs.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  暂无匹配的书籍，请导入 TXT、EPUB 或 PDF。
                </div>
              )}
            </div>
          </div>

          {/* Center: Document Table of Contents */}
          <div className="md:col-span-3 border-r border-slate-800 bg-slate-900/30 p-3 flex flex-col gap-2 overflow-hidden">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索章节或文本..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 placeholder:text-slate-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-xs">
              {filteredChapters.map((ch, idx) => {
                const isSelected = idx === selectedChapterIdx;
                return (
                  <div
                    key={ch.id}
                    onClick={() => setSelectedChapterIdx(idx)}
                    className={`p-2 rounded-lg cursor-pointer transition truncate flex items-center justify-between ${
                      isSelected 
                        ? 'bg-purple-600 text-white font-medium' 
                        : 'text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="truncate">{ch.title}</span>
                    <span className="text-[10px] opacity-70 shrink-0 ml-1 font-mono">{ch.content.length}字</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Research & Reader Workbench */}
          <div className="md:col-span-6 bg-slate-950/60 p-5 flex flex-col overflow-hidden">
            {currentDoc ? (
              currentDoc.format === 'pdf' && currentDoc.fileBlobUrl ? (
                // PDF Native Split Viewer
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                    <span className="font-semibold text-slate-200">{currentDoc.title}</span>
                    <a
                      href={currentDoc.fileBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      在新标签页独立全屏打开
                    </a>
                  </div>
                  <iframe
                    src={currentDoc.fileBlobUrl}
                    className="flex-1 w-full rounded-xl border border-slate-800 mt-3 bg-slate-900"
                    title={currentDoc.title}
                  />
                </div>
              ) : (
                // TXT / EPUB Reading & Zettelkasten Station
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Mode Tabs: Reader / Excerpt Cards / AI Probe */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setActiveTab('READER')}
                        className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                          activeTab === 'READER' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <BookOpen className="w-3 h-3" />
                        文献沉浸阅读
                      </button>
                      <button
                        onClick={() => setActiveTab('EXCERPTS')}
                        className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                          activeTab === 'EXCERPTS' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Quote className="w-3 h-3" />
                        考据卡片盒 ({allExcerpts.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('AI_PROBE')}
                        className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                          activeTab === 'AI_PROBE' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Wand2 className="w-3 h-3 text-yellow-300" />
                        AI 文献探针
                      </button>
                    </div>

                    {/* Quick Tools */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => currentChapter && handleCopySnippet(currentChapter.content)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 transition"
                      >
                        {copiedSnippet ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet ? '已复制' : '复制全章'}</span>
                      </button>

                      {onInsertReferenceSnippet && (
                        <button
                          onClick={() => currentChapter && onInsertReferenceSnippet(`【引自《${currentDoc.title}》】：\n${currentChapter.content.slice(0, 500)}...\n`)}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center gap-1 transition font-medium"
                        >
                          引用摘录入码字区
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SUB-VIEW 1: Immersive Reader */}
                  {activeTab === 'READER' && (
                    <div className="flex-1 flex flex-col overflow-hidden pt-3">
                      {/* Reader Settings & Theme Switcher Bar */}
                      <div className="flex items-center justify-between pb-2 text-[11px] text-slate-400 border-b border-slate-800/60 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span>纸张：</span>
                          <button 
                            onClick={() => setReaderTheme('ink')}
                            className={`px-2 py-0.5 rounded ${readerTheme === 'ink' ? 'bg-purple-600 text-white' : 'bg-slate-800'}`}
                          >
                            玄墨
                          </button>
                          <button 
                            onClick={() => setReaderTheme('sepia')}
                            className={`px-2 py-0.5 rounded ${readerTheme === 'sepia' ? 'bg-amber-800 text-amber-100' : 'bg-slate-800'}`}
                          >
                            古卷
                          </button>
                          <button 
                            onClick={() => setReaderTheme('emerald')}
                            className={`px-2 py-0.5 rounded ${readerTheme === 'emerald' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800'}`}
                          >
                            竹青
                          </button>
                          <button 
                            onClick={() => setReaderTheme('paper')}
                            className={`px-2 py-0.5 rounded ${readerTheme === 'paper' ? 'bg-slate-300 text-slate-900' : 'bg-slate-800'}`}
                          >
                            素白
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setFontSize(s => Math.max(13, s - 1))}
                            className="px-1.5 py-0.5 bg-slate-800 rounded"
                          >
                            A-
                          </button>
                          <span className="font-mono">{fontSize}px</span>
                          <button 
                            onClick={() => setFontSize(s => Math.min(24, s + 1))}
                            className="px-1.5 py-0.5 bg-slate-800 rounded"
                          >
                            A+
                          </button>
                        </div>
                      </div>

                      {/* Main Literary Text Canvas with onMouseUp selection capture */}
                      <div 
                        onMouseUp={handleTextSelect}
                        className={`flex-1 overflow-y-auto p-4 rounded-xl border border-slate-800/80 font-serif leading-loose whitespace-pre-line text-justify select-text ${readerThemeClasses[readerTheme]}`}
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {currentChapter?.content || '本章节无正文内容'}
                      </div>

                      {/* Floating Selection Drawer when text is highlighted */}
                      {highlightSelection && (
                        <div className="mt-3 p-3 bg-slate-900 border border-purple-500/80 rounded-xl space-y-2 text-xs shadow-xl animate-in slide-in-from-bottom">
                          <div className="flex items-center justify-between text-purple-300 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Highlighter className="w-3.5 h-3.5" />
                              已划取文本 ({highlightSelection.length} 字符)
                            </span>
                            <button onClick={() => setHighlightSelection('')} className="text-slate-400 hover:text-white">✕</button>
                          </div>
                          <div className="text-[11px] text-slate-300 line-clamp-2 italic border-l-2 border-purple-400 pl-2">
                            “{highlightSelection}”
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <input
                              type="text"
                              value={newCardNote}
                              onChange={e => setNewCardNote(e.target.value)}
                              placeholder="添加创作者考据备忘 / 用途标注..."
                              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-purple-500"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newCardTags}
                                onChange={e => setNewCardTags(e.target.value)}
                                placeholder="标签 (如: 兵器, 风俗)"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white outline-none focus:border-purple-500"
                              />
                              <button
                                onClick={handleSaveExcerptCard}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium transition shrink-0"
                              >
                                存入卡片盒
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW 2: Zettelkasten Excerpt Cards Shelf */}
                  {activeTab === 'EXCERPTS' && (
                    <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
                      <div className="text-[11px] text-slate-400">
                        在文献阅读中划词即可生成卡片。卡片支持一键转为世界书词条或插入正文：
                      </div>

                      {allExcerpts.map(card => (
                        <div key={card.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">
                              出自《{card.docTitle}》· {card.chapterTitle}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">{card.createdAt}</span>
                          </div>

                          <div className="p-2.5 bg-slate-950/60 rounded border-l-2 border-purple-500 font-serif text-slate-300 leading-relaxed text-[12px]">
                            “{card.selectedText}”
                          </div>

                          <div className="text-[11px] text-purple-300">
                            <strong>考据备忘：</strong>{card.userNote}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px]">
                            <div className="flex gap-1.5">
                              {card.tags.map((t, i) => (
                                <span key={i} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                                  #{t}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              {onInsertReferenceSnippet && (
                                <button
                                  onClick={() => onInsertReferenceSnippet(`【文献引用·${card.chapterTitle}】：\n${card.selectedText}\n`)}
                                  className="text-purple-400 hover:underline flex items-center gap-1"
                                >
                                  插入正文
                                </button>
                              )}
                              <button
                                onClick={() => handleConvertCardToLore(card)}
                                className="px-2 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 rounded flex items-center gap-1 transition"
                              >
                                <BookMarked className="w-3 h-3 text-purple-400" />
                                <span>转为世界书词条</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {allExcerpts.length === 0 && (
                        <div className="text-center py-16 text-slate-500 text-xs">
                          暂无摘录卡片。切换到“文献沉浸阅读”并在正文中用鼠标划词，即可快速归档！
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW 3: AI Document Probe (RAG QA) */}
                  {activeTab === 'AI_PROBE' && (
                    <div className="flex-1 flex flex-col overflow-hidden pt-3 space-y-3">
                      <div className="space-y-2">
                        <label className="text-[11px] text-slate-400 block font-medium">针对本章节的 AI 考据探针指令：</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={probeQuestion}
                            onChange={e => setProbeQuestion(e.target.value)}
                            placeholder="例如：提取所有关于草药配比、黑市行话或宵禁制度的描写..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-serif"
                          />
                          <button
                            onClick={() => handleRunAIProbe()}
                            disabled={isProbing}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow shrink-0"
                          >
                            {isProbing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-yellow-300" />}
                            <span>{isProbing ? '考据中...' : '开始探针提炼'}</span>
                          </button>
                        </div>

                        {/* Quick Prompts */}
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <button
                            onClick={() => handleRunAIProbe('提炼本章节所有的独特地理风貌与气候音效描写：')}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                          >
                            提炼风貌声色
                          </button>
                          <button
                            onClick={() => handleRunAIProbe('提取本章节所有的人物衣着服饰、配饰与兵甲细节：')}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                          >
                            提取服饰兵刃
                          </button>
                          <button
                            onClick={() => handleRunAIProbe('提炼本章节所体现的社会等级、货币度量与官署律法：')}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                          >
                            提取律法世俗
                          </button>
                        </div>
                      </div>

                      {/* Probe Result Box */}
                      <div className="flex-1 overflow-y-auto p-4 bg-slate-950 border border-slate-800 rounded-xl font-serif text-slate-200 leading-relaxed text-xs whitespace-pre-line select-text">
                        {probeAnswer || (
                          <div className="text-slate-500 text-center py-16">
                            点击上方按钮，AI 将瞬间穿透本章文本，结构化提炼可直接融入小说的绝妙风物细节！
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                请在左侧选择一本书籍进行查阅
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
