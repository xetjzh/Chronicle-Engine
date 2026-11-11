import React, { useRef, useState } from 'react';
import { ProjectData, Character } from '../types';
import { CharacterCardGeneratorModal } from './CharacterCardGeneratorModal';
import { createBlankCharacter } from '../services/characterData';
import { relationshipState, relationshipLabel, shortestPath } from '../services/worldDynamics';
import {
  Users, UserCheck, Heart, Shield, Brain, Eye, Plus, Sparkles, AlertCircle, Wand2
} from 'lucide-react';

interface CharacterManagerProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
}

export const CharacterManager: React.FC<CharacterManagerProps> = ({
  project,
  onUpdateProject,
}) => {
  const [relationshipQuery, setRelationshipQuery] = useState('');
  const [selectedCharId, setSelectedCharId] = useState<string>(project.characters[0]?.id || '');
  const [showCardGenerator, setShowCardGenerator] = useState<boolean>(false);
  const latest = useRef(project);
  const callback = useRef(onUpdateProject);
  latest.current = project; callback.current = onUpdateProject;

  const currentChar = project.characters.find(c => c.id === selectedCharId) || project.characters[0];

  const handleUpdateCurrentChar = (partial: Partial<Character>) => {
    if (!currentChar) return;
    const updatedChars = project.characters.map(c =>
      c.id === currentChar.id ? { ...c, ...partial } : c
    );
    const updated = { ...project, characters: updatedChars };
    onUpdateProject(updated);
  };

  const handleAddNewCharacter = () => {
    const newChar = createBlankCharacter(latest.current);
    const updated = { ...project, characters: [...project.characters, newChar] };
    onUpdateProject(updated);
    setSelectedCharId(newChar.id);
  };

  const handleAddGeneratedCharacter = (char: Character) => {
    if (latest.current.id !== project.id) return;
    const current = latest.current;
    const updated = { ...current, characters: [...current.characters, {
      ...char, currentLocationId: current.locations.some(l => l.id === char.currentLocationId) ? char.currentLocationId : '',
      factionId: current.factions.some(f => f.id === char.factionId) ? char.factionId : '',
    }] };
    latest.current = updated;
    callback.current(updated);
    setSelectedCharId(char.id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Character List */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" />
              虚拟世界人物谱 ({project.characters.length})
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowCardGenerator(true)}
                className="px-2 py-1 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                title="AI 智能生成人物卡"
              >
                <Wand2 className="w-3 h-3 text-yellow-300" />
                <span>AI生成</span>
              </button>
              <button
                onClick={handleAddNewCharacter}
                className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
                title="手动添加新人物"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {project.characters.map(char => {
              const isSelected = char.id === currentChar?.id;
              const location = project.locations.find(l => l.id === char.currentLocationId);
              return (
                <button
                  type="button"
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  aria-pressed={isSelected}
                  className={`block w-full text-left p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500 shadow'
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-sm text-slate-100">{char.name}</span>
                    <span className="text-[11px] text-purple-400">{char.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>所处位置：{location?.name || '未知'}</span>
                    <span className="text-slate-300">心境：{char.currentMood}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    欲求: {char.coreDesire}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Character Dossier Inspector */}
      <div className="lg:col-span-8">
        {currentChar ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={currentChar.name}
                    aria-label="人物姓名"
                    onChange={e => handleUpdateCurrentChar({ name: e.target.value })}
                    className="text-xl font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 outline-none"
                  />
                  <input
                    type="text"
                    value={currentChar.title}
                    aria-label="人物称谓"
                    onChange={e => handleUpdateCurrentChar({ title: e.target.value })}
                    className="text-xs text-purple-400 bg-slate-800 px-2 py-1 rounded border border-slate-700 outline-none"
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {currentChar.age} 岁 · {currentChar.gender} · 职业: {currentChar.occupation} · 阵营: {currentChar.moralityAlignment}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">存活状态：</span>
                <button
                  onClick={() => handleUpdateCurrentChar({ isAlive: !currentChar.isAlive, diedAtTimeStep: currentChar.isAlive ? project.timeStepIndex : undefined })}
                  className={`px-3 py-1 rounded-full font-medium ${
                    currentChar.isAlive ? 'bg-green-950 text-green-300 border border-green-800' : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {currentChar.isAlive ? '生存中' : '已罹难'}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <label>所在地点<select aria-label="人物所在地点" value={project.locations.some(l => l.id === currentChar.currentLocationId) ? currentChar.currentLocationId : ''} onChange={e => handleUpdateCurrentChar({ currentLocationId: e.target.value, travel: undefined, travelDestinationId: undefined })} className="block w-full rounded bg-slate-800 p-2 mt-1"><option value="">尚未分配地点</option>{project.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              <label>所属势力<select aria-label="人物所属势力" value={project.factions.some(f => f.id === currentChar.factionId) ? currentChar.factionId : ''} onChange={e => handleUpdateCurrentChar({ factionId: e.target.value })} className="block w-full rounded bg-slate-800 p-2 mt-1"><option value="">无所属势力</option>{project.factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
              {!project.locations.some(l => l.id === currentChar.currentLocationId) && <p role="status" className="text-amber-300">请先创建地点并在这里分配，人物才能参与世界模拟。</p>}
            </div>
            <section className="rounded border border-slate-800 p-3 text-xs space-y-2">
              <label>旅行目的地<select aria-label="人物旅行目的地" disabled={!!currentChar.travel} value={currentChar.travelDestinationId || ''} onChange={e => handleUpdateCurrentChar({ travelDestinationId: e.target.value || undefined })} className="ml-2 rounded bg-slate-800 p-2"><option value="">无旅行计划</option>{project.locations.filter(l => l.id !== currentChar.currentLocationId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              {currentChar.travel && <p>正在途中，下一段剩余 {currentChar.travel.remainingHours} 小时。<button onClick={() => handleUpdateCurrentChar({ travel: undefined, travelDestinationId: undefined })} className="ml-2 underline">中止计划，停留在最后到达地点</button></p>}
              {!currentChar.travel && currentChar.travelDestinationId && !shortestPath(project.locations, currentChar.currentLocationId, currentChar.travelDestinationId).length && <p role="status" className="text-amber-300">目的地尚无连通路径，请先编辑地点连接。</p>}
            </section>
            <section className="rounded border border-slate-800 p-3 text-xs space-y-2"><h4>关系数值（此人物视角）</h4><input aria-label="搜索关系人物" value={relationshipQuery} onChange={e => setRelationshipQuery(e.target.value)} placeholder="搜索人物；每次最多显示 20 名" className="rounded bg-slate-800 p-2" />{project.characters.filter(c => c.id !== currentChar.id && c.name.includes(relationshipQuery.trim())).slice(0, 20).map(other => {
              const score = relationshipState(currentChar, other.id);
              const change = (key: 'trust' | 'affection', number: number) => {
                const value = { ...score, [key]: Math.min(100, Math.max(key === 'trust' ? 0 : -100, number)) };
                handleUpdateCurrentChar({ relationshipScores: { ...currentChar.relationshipScores, [other.id]: value }, relationships: { ...currentChar.relationships, [other.id]: relationshipLabel(value) } });
              };
              return <div key={other.id} className="flex flex-wrap items-center gap-2"><span>{other.name} · {currentChar.relationships[other.id] || '漠然'}</span><label>好感<input aria-label={'与' + other.name + '的好感'} type="number" min={-100} max={100} value={score.affection} onChange={e => change('affection', Number(e.target.value) || 0)} className="ml-1 w-16 bg-slate-800 p-1" /></label><label>信任<input aria-label={'与' + other.name + '的信任'} type="number" min={0} max={100} value={score.trust} onChange={e => change('trust', Number(e.target.value) || 0)} className="ml-1 w-16 bg-slate-800 p-1" /></label></div>;
            })}</section>
            {/* Psychological & Motives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-400" />
                  深层心理与价值观
                </h4>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">核心性格</label>
                  <input
                    type="text"
                    value={currentChar.personality}
                    onChange={e => handleUpdateCurrentChar({ personality: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">主导欲望 (动机效用根源)</label>
                  <input
                    type="text"
                    value={currentChar.coreDesire}
                    onChange={e => handleUpdateCurrentChar({ coreDesire: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">隐秘恐惧</label>
                  <input
                    type="text"
                    value={currentChar.greatestFear}
                    onChange={e => handleUpdateCurrentChar({ greatestFear: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-400" />
                  现实物理状态与行囊
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">健康指数 (0-100)</label>
                    <input
                      type="number"
                      value={currentChar.health}
                      onChange={e => handleUpdateCurrentChar({ health: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">随身银两财富</label>
                    <input
                      type="number"
                      value={currentChar.wealth}
                      onChange={e => handleUpdateCurrentChar({ wealth: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">随身物品道具 (逗号隔开)</label>
                  <input
                    type="text"
                    value={currentChar.inventory.join(', ')}
                    onChange={e => handleUpdateCurrentChar({ inventory: e.target.value.split(',').map(s => s.trim()) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">当前即时目标</label>
                  <input
                    type="text"
                    value={currentChar.currentGoal}
                    onChange={e => handleUpdateCurrentChar({ currentGoal: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Cognitive Facts Boundaries */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-purple-400" />
                  认知事实库 (严密防穿帮认知图谱)
                </h4>
                <span className="text-[11px] text-slate-400">只有亲历或口耳相传之事才记录在此</span>
              </div>

              {currentChar.knownFacts.length > 0 ? (
                <div className="space-y-2">
                  {currentChar.knownFacts.map(fact => (
                    <div key={fact.id} className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/60 flex items-start justify-between">
                      <div>
                        <div className="text-slate-200">{fact.fact}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">获知时间：{fact.learnedAtTime}</div>
                      </div>
                      <span className="text-[10px] bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded">
                        置信度: {(fact.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 py-3 text-center">
                  暂无特殊历史事实积累，角色仅凭常理和当下感知行动
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-slate-500 p-12 text-center">请选择一个人物档案</div>
        )}
      </div>

      {/* AI Card Generator Modal */}
      {showCardGenerator && (
        <CharacterCardGeneratorModal
          project={project}
          onAddCharacter={handleAddGeneratedCharacter}
          onClose={() => setShowCardGenerator(false)}
        />
      )}
    </div>
  );
};
