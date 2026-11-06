import React, { useState } from 'react';
import { ProjectData, WorldRule, LocationNode, Faction, ForeshadowingClue } from '../types';
import { storageService } from '../services/storageService';
import { 
  Compass, MapPin, Flag, HelpCircle, Plus, Trash2, Edit3, 
  Sparkles, CheckCircle, Shield, AlertCircle
} from 'lucide-react';

interface WorldEditorProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
}

export const WorldEditor: React.FC<WorldEditorProps> = ({
  project,
  onUpdateProject,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'RULES' | 'LOCATIONS' | 'FACTIONS' | 'FORESHADOWING'>('RULES');

  // Rule creation states
  const [newRuleCategory, setNewRuleCategory] = useState<'natural' | 'magic' | 'social' | 'taboo'>('natural');
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleConsequence, setNewRuleConsequence] = useState('');

  // Location creation states
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<LocationNode['type']>('city');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocClimate, setNewLocClimate] = useState('');

  // Foreshadowing states
  const [newClueTitle, setNewClueTitle] = useState('');
  const [newClueResolution, setNewClueResolution] = useState('');
  const [newClueNotes, setNewClueNotes] = useState('');

  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    const rule: WorldRule = {
      id: `rule_${Date.now()}`,
      category: newRuleCategory,
      rule: newRuleText,
      consequenceOfViolation: newRuleConsequence || '触犯世界法则，承受物理或社会秩序制裁',
    };
    const updated = { ...project, rules: [...project.rules, rule] };
    onUpdateProject(updated);
    storageService.saveProject(updated);
    setNewRuleText('');
    setNewRuleConsequence('');
  };

  const handleDeleteRule = (id: string) => {
    const updated = { ...project, rules: project.rules.filter(r => r.id !== id) };
    onUpdateProject(updated);
    storageService.saveProject(updated);
  };

  const handleAddLocation = () => {
    if (!newLocName.trim()) return;
    const loc: LocationNode = {
      id: `loc_${Date.now()}`,
      name: newLocName,
      type: newLocType,
      description: newLocDesc || '北关未知据点',
      connectedLocationIds: project.locations[0] ? [project.locations[0].id] : [],
      climateOrDanger: newLocClimate || '风雪严寒',
    };
    const updated = { ...project, locations: [...project.locations, loc] };
    onUpdateProject(updated);
    storageService.saveProject(updated);
    setNewLocName('');
    setNewLocDesc('');
    setNewLocClimate('');
  };

  const handleDeleteLocation = (id: string) => {
    const updated = { ...project, locations: project.locations.filter(l => l.id !== id) };
    onUpdateProject(updated);
    storageService.saveProject(updated);
  };

  const handleAddForeshadowing = () => {
    if (!newClueTitle.trim()) return;
    const clue: ForeshadowingClue = {
      id: `fore_${Date.now()}`,
      title: newClueTitle,
      plantedTime: project.currentSimulationTime,
      relatedCharacterIds: project.characters.slice(0, 2).map(c => c.id),
      expectedResolution: newClueResolution || '待主线剧情发展推进',
      isResolved: false,
      notes: newClueNotes,
    };
    const updated = { ...project, foreshadowing: [...project.foreshadowing, clue] };
    onUpdateProject(updated);
    storageService.saveProject(updated);
    setNewClueTitle('');
    setNewClueResolution('');
    setNewClueNotes('');
  };

  const handleToggleClueResolved = (id: string) => {
    const updatedClues = project.foreshadowing.map(c => 
      c.id === id ? { ...c, isResolved: !c.isResolved } : c
    );
    const updated = { ...project, foreshadowing: updatedClues };
    onUpdateProject(updated);
    storageService.saveProject(updated);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-serif font-bold text-white">世界规则与地缘宏观编辑器</h2>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('RULES')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'RULES' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            世界硬性法则 ({project.rules.length})
          </button>
          <button
            onClick={() => setActiveSubTab('LOCATIONS')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'LOCATIONS' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            地理与地点 ({project.locations.length})
          </button>
          <button
            onClick={() => setActiveSubTab('FACTIONS')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'FACTIONS' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            势力与阵营 ({project.factions.length})
          </button>
          <button
            onClick={() => setActiveSubTab('FORESHADOWING')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'FORESHADOWING' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            伏笔追踪数据库 ({project.foreshadowing.length})
          </button>
        </div>
      </div>

      {/* Rules SubTab */}
      {activeSubTab === 'RULES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-400" />
              新增世界法则与禁忌
            </h3>
            <div>
              <label className="text-slate-400 block mb-1">法则门类</label>
              <select
                value={newRuleCategory}
                onChange={e => setNewRuleCategory(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              >
                <option value="natural">自然物理规律</option>
                <option value="magic">特殊异力 / 魔法规则</option>
                <option value="social">法律社会制度</option>
                <option value="taboo">历史宗教禁忌</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">法则表述内容</label>
              <textarea
                rows={3}
                value={newRuleText}
                onChange={e => setNewRuleText(e.target.value)}
                placeholder="例如：凡吸入青溟石清气者，三个时辰内若无雄黄油解冻，肺腑必结晶粉碎..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">触犯 / 违背后果</label>
              <input
                type="text"
                value={newRuleConsequence}
                onChange={e => setNewRuleConsequence(e.target.value)}
                placeholder="例如：冻绝身亡 / 遭都巡检司水牢问罪..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <button
              onClick={handleAddRule}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
            >
              录入世界法则
            </button>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {project.rules.map(rule => (
              <div key={rule.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                    {rule.category === 'natural' ? '物理法则' : rule.category === 'magic' ? '异能法则' : rule.category === 'social' ? '社会规章' : '绝对禁忌'}
                  </span>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-sm font-medium text-slate-200">{rule.rule}</div>
                <div className="text-slate-400 flex items-start gap-1">
                  <span className="text-red-400 font-semibold">违背因果：</span>
                  <span>{rule.consequenceOfViolation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations SubTab */}
      {activeSubTab === 'LOCATIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-purple-400" />
              创建新地理节点
            </h3>
            <div>
              <label className="text-slate-400 block mb-1">地点名称</label>
              <input
                type="text"
                value={newLocName}
                onChange={e => setNewLocName(e.target.value)}
                placeholder="例如：望雪崖古哨所"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">地点类型</label>
              <select
                value={newLocType}
                onChange={e => setNewLocType(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              >
                <option value="city">城关城市</option>
                <option value="tavern">客栈酒家</option>
                <option value="market">黑市市井</option>
                <option value="wilderness">旷野荒原</option>
                <option value="dungeon">地窖废墟</option>
                <option value="palace">官署府邸</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">地表风貌环境与潜藏危机</label>
              <input
                type="text"
                value={newLocClimate}
                onChange={e => setNewLocClimate(e.target.value)}
                placeholder="例如：冷风呼啸，暗哨藏匿于乱石之间"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">地点详述</label>
              <textarea
                rows={3}
                value={newLocDesc}
                onChange={e => setNewLocDesc(e.target.value)}
                placeholder="地点历史沿革与视觉氛围描写..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <button
              onClick={handleAddLocation}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
            >
              保存至地理网络
            </button>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {project.locations.map(loc => (
              <div key={loc.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-sm text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    {loc.name}
                  </span>
                  <button
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-slate-400 line-clamp-2">{loc.description}</div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-purple-400">
                  环境：{loc.climateOrDanger}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Foreshadowing SubTab */}
      {activeSubTab === 'FORESHADOWING' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              伏笔与暗线埋设追踪
            </h3>
            <div>
              <label className="text-slate-400 block mb-1">伏笔暗线标题</label>
              <input
                type="text"
                value={newClueTitle}
                onChange={e => setNewClueTitle(e.target.value)}
                placeholder="例如：更夫冻尸袖口中的商号暗记"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">预估揭示阶段 / 解决走向</label>
              <input
                type="text"
                value={newClueResolution}
                onChange={e => setNewClueResolution(e.target.value)}
                placeholder="例如：在鬼市旧密库暗门破译时揭晓"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">备忘与涉及人物笔记</label>
              <textarea
                rows={3}
                value={newClueNotes}
                onChange={e => setNewClueNotes(e.target.value)}
                placeholder="记录此伏笔的真实谜底与防穿帮指引..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
              />
            </div>
            <button
              onClick={handleAddForeshadowing}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
            >
              录入伏笔库
            </button>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {project.foreshadowing.map(clue => (
              <div key={clue.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${clue.isResolved ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                    {clue.title}
                  </span>
                  <button
                    onClick={() => handleToggleClueResolved(clue.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                      clue.isResolved ? 'bg-green-950 text-green-300 border border-green-800' : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}
                  >
                    {clue.isResolved ? '已圆满回收' : '埋设潜伏中'}
                  </button>
                </div>
                <div className="text-slate-400">预估揭示：{clue.expectedResolution}</div>
                {clue.notes && <div className="text-slate-500 bg-slate-950/40 p-2 rounded">{clue.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factions SubTab */}
      {activeSubTab === 'FACTIONS' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {project.factions.map(fac => (
            <div key={fac.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                  <Flag className="w-4 h-4 text-purple-400" />
                  {fac.name}
                </span>
                <span className="text-purple-400 font-mono">势力值: {fac.powerLevel}</span>
              </div>
              <p className="text-slate-400 leading-relaxed">{fac.ideology}</p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                敌对势力：{fac.enemies.length > 0 ? fac.enemies.join(', ') : '无直接仇敌'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
