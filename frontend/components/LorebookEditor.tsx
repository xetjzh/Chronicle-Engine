import React, { useState } from 'react';
import { ProjectData, LorebookEntry } from '../types';
import { LorebookService } from '../services/lorebookService';
import { 
  BookMarked, Plus, Trash2, Edit3, Key, Sparkles, Check, 
  Search, Eye, HelpCircle, Layers, ShieldCheck
} from 'lucide-react';

interface LorebookEditorProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
}

export const LorebookEditor: React.FC<LorebookEditorProps> = ({
  project,
  onUpdateProject,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string>(project.lorebook[0]?.id || '');
  const [testText, setTestText] = useState('裴子期深夜手握青溟石走入听雨居客栈，警惕着宵禁巡夜铁卫的铁蹄声。');
  const [testResultKeys, setTestResultKeys] = useState<string[]>([]);

  const currentEntry = project.lorebook.find(e => e.id === selectedEntryId) || project.lorebook[0];

  const handleUpdateEntry = (partial: Partial<LorebookEntry>) => {
    if (!currentEntry) return;
    const updated = project.lorebook.map(e => e.id === currentEntry.id ? { ...e, ...partial } : e);
    const updatedProject = { ...project, lorebook: updated };
    onUpdateProject(updatedProject);
  };

  const handleAddNewEntry = () => {
    const newEntry: LorebookEntry = {
      id: `lore_${Date.now()}`,
      name: '新词条（如某秘宝/旧案/禁忌）',
      keys: ['关键词1', '关键词2'],
      secondaryKeys: [],
      content: '详细描写该事物的因果背景、物理特征及对当前世界的影响...',
      isConstant: false,
      enabled: true,
      insertionOrder: 50,
      scanDepth: 1000,
      comment: '创作者提示'
    };
    const updatedProject = { ...project, lorebook: [...project.lorebook, newEntry] };
    onUpdateProject(updatedProject);
    setSelectedEntryId(newEntry.id);
  };

  const handleDeleteEntry = (id: string) => {
    const updated = project.lorebook.filter(e => e.id !== id);
    const updatedProject = { ...project, lorebook: updated };
    onUpdateProject(updatedProject);
    if (selectedEntryId === id) {
      setSelectedEntryId(updated[0]?.id || '');
    }
  };

  const handleRunTest = () => {
    const { activatedKeys } = LorebookService.scanAndActivate(project.lorebook, [testText]);
    setTestResultKeys(activatedKeys);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
              故事资料
            </span>
            <span className="text-xs text-slate-400">在需要时唤起设定</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white mt-1 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-purple-400" />
            让故事的每个细节有据可循
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            收藏人物背景、地理传说与重要事实；关键词出现时，相关设定会供 AI 创作参考。
          </p>
        </div>

        <button
          onClick={handleAddNewEntry}
          className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          创建世界书词条
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Lorebook Entry List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-200">词条清单 ({project.lorebook.length})</span>
              <span className="text-slate-500">点击进入细项配置</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {project.lorebook.map(entry => {
                const isSelected = entry.id === currentEntry?.id;
                return (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setSelectedEntryId(entry.id)}
                    aria-pressed={isSelected}
                    className={`block w-full text-left p-3 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected 
                        ? 'bg-purple-950/40 border-purple-500 text-white shadow' 
                        : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="truncate">{entry.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        entry.isConstant ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {entry.isConstant ? '常驻激活' : `触发词: ${entry.keys.length}`}
                      </span>
                    </div>

                    <div className="text-[11px] text-purple-300/80 mt-1 line-clamp-1 flex items-center gap-1">
                      <Key className="w-2.5 h-2.5" />
                      <span>{entry.keys.join(', ') || '暂无关键词'}</span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{entry.content}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keyword Scan Simulator (SillyTavern style) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-purple-400" />
                词条关键词命中模拟器
              </span>
              <button
                onClick={handleRunTest}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded transition border border-slate-700"
              >
                测试扫描
              </button>
            </div>

            <textarea
              rows={3}
              value={testText}
              onChange={e => setTestText(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded p-2 text-slate-300 outline-none"
            />

            {testResultKeys.length > 0 && (
              <div className="p-2.5 bg-slate-800/80 rounded border border-purple-900/60 space-y-1">
                <div className="text-[10px] text-purple-300 font-semibold">成功命中的世界书条目：</div>
                {testResultKeys.map((k, idx) => (
                  <div key={idx} className="text-slate-200 text-[11px] flex items-center gap-1">
                    <Check className="w-3 h-3 text-green-400" />
                    <span>{k}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Lorebook Entry Editor */}
        <div className="lg:col-span-8">
          {currentEntry ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={currentEntry.name}
                    onChange={e => handleUpdateEntry({ name: e.target.value })}
                    className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 outline-none w-full"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">词条唯一标识名</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateEntry({ isConstant: !currentEntry.isConstant })}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition ${
                      currentEntry.isConstant 
                        ? 'bg-amber-950 text-amber-300 border-amber-800' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {currentEntry.isConstant ? '常驻注入 (无视关键词)' : '按关键词扫描激活'}
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(currentEntry.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                    title="删除词条"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Keys & Secondary Keys */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">
                    主要触发关键词 (逗号隔开，OR 逻辑)
                  </label>
                  <input
                    type="text"
                    value={currentEntry.keys.join(', ')}
                    onChange={e => handleUpdateEntry({
                      keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="例如：青溟石, 寒气, 异晶"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    当此章事件或作者指令出现任一词汇时触发。
                  </span>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">
                    次级协同触发词 (选填，AND 逻辑)
                  </label>
                  <input
                    type="text"
                    value={(currentEntry.secondaryKeys || []).join(', ')}
                    onChange={e => handleUpdateEntry({
                      secondaryKeys: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="例如：鬼市, 暗道"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    需同时命中主词与此列表词汇才激活。
                  </span>
                </div>
              </div>

              {/* Insertion Order & Scan Depth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">
                    插入顺序权重 (Insertion Order: {currentEntry.insertionOrder})
                  </label>
                  <input
                    type="number"
                    value={currentEntry.insertionOrder}
                    onChange={e => handleUpdateEntry({ insertionOrder: parseInt(e.target.value) || 10 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    数值越小越靠前（0为绝对先导设定）。
                  </span>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">词条备忘</label>
                  <input
                    type="text"
                    value={currentEntry.comment || ''}
                    onChange={e => handleUpdateEntry({ comment: e.target.value })}
                    placeholder="仅自己可见的便签"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Entry Content Payload */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5 flex items-center justify-between">
                  <span>注入 AI 的词条设定正文 (SillyTavern Content)</span>
                  <span className="text-[10px] text-purple-400">字数：{currentEntry.content.length}</span>
                </label>
                <textarea
                  rows={8}
                  value={currentEntry.content}
                  onChange={e => handleUpdateEntry({ content: e.target.value })}
                  placeholder="详细书写在当前世界中该事物的真实法则、禁忌、弱点或历史秘密..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-purple-500 font-serif leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              请在左侧选择或创建世界书词条
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
