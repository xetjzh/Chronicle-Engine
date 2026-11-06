import React, { useState } from 'react';
import { ProjectData } from '../types';
import { BookOpen, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';

interface ReaderViewProps {
  project: ProjectData;
}

export const ReaderView: React.FC<ReaderViewProps> = ({ project }) => {
  const [currentChapIndex, setCurrentChapIndex] = useState(0);
  const [fontSize, setFontSize] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed' | 'loose'>('relaxed');
  const [theme, setTheme] = useState<'dark' | 'sepia' | 'light'>('dark');

  const chapter = project.chapters[currentChapIndex] || project.chapters[0];

  const themeClasses = {
    dark: 'bg-slate-950 text-slate-100',
    sepia: 'bg-[#fbf0d9] text-[#5f4b32]',
    light: 'bg-white text-slate-900',
  };

  if (!chapter) {
    return (
      <div className="p-12 text-center text-slate-500">
        作品中尚未编写章节，请前往小说编辑器起草章节。
      </div>
    );
  }

  return (
    <div className={`rounded-2xl transition duration-200 border border-slate-800/80 p-6 sm:p-12 max-w-4xl mx-auto shadow-2xl ${themeClasses[theme]}`}>
      {/* Reader Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/40 mb-8 text-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="font-serif font-semibold">{project.title}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg">
            <button 
              onClick={() => setTheme('dark')} 
              className={`px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
            >
              暗夜
            </button>
            <button 
              onClick={() => setTheme('sepia')} 
              className={`px-2 py-0.5 rounded ${theme === 'sepia' ? 'bg-amber-700 text-white' : 'text-slate-400'}`}
            >
              羊皮纸
            </button>
            <button 
              onClick={() => setTheme('light')} 
              className={`px-2 py-0.5 rounded ${theme === 'light' ? 'bg-slate-300 text-slate-900' : 'text-slate-400'}`}
            >
              明亮
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => setFontSize(s => Math.max(14, s - 2))}
              className="px-2 py-1 bg-black/20 hover:bg-black/30 rounded"
            >
              A-
            </button>
            <span className="px-1 font-mono">{fontSize}px</span>
            <button 
              onClick={() => setFontSize(s => Math.min(28, s + 2))}
              className="px-2 py-1 bg-black/20 hover:bg-black/30 rounded"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Chapter Text */}
      <div className="space-y-6">
        <div className="text-center space-y-2 mb-10">
          <span className="text-xs uppercase tracking-widest text-purple-400 font-mono">
            第 {chapter.volumeNumber} 卷 · 第 {chapter.chapterNumber} 章
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-wide">
            {chapter.title}
          </h1>
          <div className="text-xs opacity-60">
            全章约 {chapter.wordCount} 字
          </div>
        </div>

        <div 
          className="font-serif leading-loose whitespace-pre-line text-justify"
          style={{ 
            fontSize: `${fontSize}px`, 
            lineHeight: lineHeight === 'loose' ? 2.2 : lineHeight === 'relaxed' ? 1.9 : 1.6 
          }}
        >
          {chapter.content}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="mt-12 pt-8 border-t border-slate-800/40 flex items-center justify-between text-xs">
        <button
          onClick={() => setCurrentChapIndex(i => Math.max(0, i - 1))}
          disabled={currentChapIndex === 0}
          className="px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg flex items-center gap-1.5 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          上一章
        </button>

        <span className="opacity-60">
          {currentChapIndex + 1} / {project.chapters.length}
        </span>

        <button
          onClick={() => setCurrentChapIndex(i => Math.min(project.chapters.length - 1, i + 1))}
          disabled={currentChapIndex === project.chapters.length - 1}
          className="px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg flex items-center gap-1.5 disabled:opacity-30"
        >
          下一章
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
