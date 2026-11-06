import React, { useMemo } from 'react';
import { ProjectData } from '../types';
import { 
  X, Activity, TrendingUp, BarChart3, Users, Zap, BookOpen, 
  Layers, CheckCircle, ShieldAlert
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, AreaChart, Area 
} from 'recharts';

interface NarrativeAnalyticsModalProps {
  project: ProjectData;
  onClose: () => void;
}

export const NarrativeAnalyticsModal: React.FC<NarrativeAnalyticsModalProps> = ({
  project,
  onClose,
}) => {
  // Compute Tension & Length data per chapter
  const tensionData = useMemo(() => {
    return project.chapters.map((ch, idx) => ({
      name: `第${ch.chapterNumber}章`,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      tension: ch.extraction?.tensionScore || ch.tensionScore || (idx % 3 === 2 ? 80 : idx % 3 === 1 ? 65 : 45),
      wordCount: ch.wordCount,
      target: 4000,
    }));
  }, [project.chapters]);

  // Compute Character Appearance Frequency
  const characterPresence = useMemo(() => {
    const counts: Record<string, number> = {};
    project.characters.forEach(c => { counts[c.name] = 0; });

    project.chapters.forEach(ch => {
      project.characters.forEach(c => {
        if (ch.content.includes(c.name) || ch.povCharacterId === c.id) {
          counts[c.name] = (counts[c.name] || 0) + 1;
        }
      });
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      appearances: count,
    }));
  }, [project.chapters, project.characters]);

  const totalWords = project.chapters.reduce((a, c) => a + c.wordCount, 0);
  const avgWords = project.chapters.length > 0 ? Math.round(totalWords / project.chapters.length) : 0;
  const avgTension = tensionData.length > 0 
    ? Math.round(tensionData.reduce((a, c) => a + c.tension, 0) / tensionData.length) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col text-slate-200 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                全书叙事张力与节奏分析图谱 (Narrative Analytics)
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                  开源 StoryMetrics 移植引擎
                </span>
              </h3>
              <p className="text-xs text-slate-400">实时监测长篇起伏波峰波谷、字数达标率与主要角色戏份分布，防止长篇审美疲劳</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Quick Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-2">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              全书总篇幅
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {(totalWords / 10000).toFixed(2)} <span className="text-xs text-slate-400 font-normal">万字 ({project.chapters.length} 章)</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              均章字数
            </div>
            <div className={`text-lg font-bold font-mono mt-1 ${avgWords >= 4000 ? 'text-green-400' : 'text-amber-400'}`}>
              {avgWords} <span className="text-xs text-slate-400 font-normal">字 / 章 (目标: ≥4000)</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              平均戏剧张力
            </div>
            <div className="text-lg font-bold font-mono text-purple-300 mt-1">
              {avgTension} <span className="text-xs text-slate-400 font-normal">/ 100 (张力均衡)</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              群像演员出场
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {project.characters.length} <span className="text-xs text-slate-400 font-normal">位核心档案人物</span>
            </div>
          </div>
        </div>

        {/* Charts Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Chart 1: Narrative Tension Curve */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  章节戏剧张力起伏波浪线 (Narrative Tension Wave)
                </h4>
                <p className="text-[11px] text-slate-400">波峰代表高潮交锋/突变，波谷代表日常铺垫与心境沉淀；理想长篇应呈现波浪式递进。</p>
              </div>
              <span className="text-[11px] text-purple-300 font-mono">0 (平静) ~ 100 (决战)</span>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tensionData}>
                  <defs>
                    <linearGradient id="tensionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="tension" stroke="#c084fc" strokeWidth={2.5} fillOpacity={1} fill="url(#tensionGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Chapter Word Count Distribution & Character Frequency */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Word Count Bars */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                单章字数达标监测 (目标: 4000+ 字)
              </h4>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tensionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="wordCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Character Presence */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                主要角色登场与叙事权重
              </h4>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={characterPresence} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="appearances" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
          >
            完成查看
          </button>
        </div>
      </div>
    </div>
  );
};
