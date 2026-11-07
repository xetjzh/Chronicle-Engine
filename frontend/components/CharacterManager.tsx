import React, { useState } from 'react';
import { ProjectData, Character } from '../types';
import { CharacterCardGeneratorModal } from './CharacterCardGeneratorModal';
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
  const [selectedCharId, setSelectedCharId] = useState<string>(project.characters[0]?.id || '');
  const [showCardGenerator, setShowCardGenerator] = useState<boolean>(false);

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
    const newChar: Character = {
      id: `char_${Date.now()}`,
      name: '新登场人物',
      title: '流浪刀客',
      age: 26,
      gender: '男',
      factionId: project.factions[0]?.id || 'fac_common',
      currentLocationId: project.locations[0]?.id || 'loc_tavern',
      occupation: '走镖游侠',
      appearance: '身穿黑布风氅，面颊清冷，习惯将刀柄握于左手。',
      personality: '寡言坚毅，信守诺言',
      coreDesire: '筹措路费寻找失踪的同胞兄长',
      greatestFear: '再度遭遇同门师友的背叛',
      currentMood: '警惕',
      moralityAlignment: '守序中立',
      health: 90,
      wealth: 15,
      inventory: ['生锈长刀', '干粮两副', '半筒碎银'],
      currentGoal: '在寒江关打听兄长消息',
      isAlive: true,
      relationships: {},
      knownFacts: []
    };
    const updated = { ...project, characters: [...project.characters, newChar] };
    onUpdateProject(updated);
    setSelectedCharId(newChar.id);
  };

  const handleAddGeneratedCharacter = (char: Character) => {
    const updated = { ...project, characters: [...project.characters, char] };
    onUpdateProject(updated);
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
                  onClick={() => handleUpdateCurrentChar({ isAlive: !currentChar.isAlive })}
                  className={`px-3 py-1 rounded-full font-medium ${
                    currentChar.isAlive ? 'bg-green-950 text-green-300 border border-green-800' : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {currentChar.isAlive ? '生存中' : '已罹难'}
                </button>
              </div>
            </div>

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
                      onChange={e => handleUpdateCurrentChar({ health: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">随身银两财富</label>
                    <input
                      type="number"
                      value={currentChar.wealth}
                      onChange={e => handleUpdateCurrentChar({ wealth: parseInt(e.target.value) || 0 })}
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
