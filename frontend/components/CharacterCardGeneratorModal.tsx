import React, { useState } from 'react';
import { ProjectData, Character } from '../types';
import { AIProviderService } from '../services/aiProviderService';
import { X, Sparkles, UserPlus, RefreshCw, Check, Brain, Shield } from 'lucide-react';

interface CharacterCardGeneratorModalProps {
  project: ProjectData;
  onAddCharacter: (character: Character) => void;
  onClose: () => void;
}

export const CharacterCardGeneratorModal: React.FC<CharacterCardGeneratorModalProps> = ({
  project,
  onAddCharacter,
  onClose,
}) => {
  const [briefPrompt, setBriefPrompt] = useState('寒江关守城卫所的一名年迈仵作，暗中受九瓣青莲商号接济，精通边关百草毒物，性格孤僻胆小。');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateCharacter = async () => {
    if (!briefPrompt.trim() || isGenerating) return;
    setIsGenerating(true);

    const prompt = `你是一位专注于虚构群像世界的角色设计师。请根据作者给出的设定构思，为作品《${project.title}》（世界名:${project.worldName}）生成一位具有严密心理机制与社会关系的新角色。

作者简要构想：“${briefPrompt}”

请以纯 JSON 格式输出（不要添加任何 markdown 代码块外部文本）：
{
  "name": "姓名",
  "title": "头衔/江湖称号",
  "age": 45,
  "gender": "男",
  "occupation": "职业",
  "appearance": "外貌神态描写",
  "personality": "核心性格特征",
  "coreDesire": "深层欲望",
  "greatestFear": "最深隐秘恐惧",
  "currentMood": "警惕",
  "moralityAlignment": "中立善",
  "health": 85,
  "wealth": 30,
  "inventory": ["骨刀", "干粮", "雄黄粉"],
  "currentGoal": "当前行动目标"
}`;

    try {
      const resultText = await AIProviderService.generateText(project.aiConfig, {
        prompt,
        overrideSampling: { temperature: 0.8 },
      });

      // Parse JSON from text
      const cleanJson = resultText.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);

      const newChar: Character = {
        id: `char_${Date.now()}`,
        name: parsed.name || '新角色',
        title: parsed.title || '江湖旅客',
        age: parsed.age || 30,
        gender: parsed.gender || '男',
        factionId: project.factions[0]?.id || 'fac_common',
        currentLocationId: project.locations[0]?.id || 'loc_tavern',
        occupation: parsed.occupation || '浪人',
        appearance: parsed.appearance || '神色沉静，衣履带泥。',
        personality: parsed.personality || '深思熟虑',
        coreDesire: parsed.coreDesire || '谋求安稳度日',
        greatestFear: parsed.greatestFear || '卷入风波',
        currentMood: parsed.currentMood || '平静',
        moralityAlignment: parsed.moralityAlignment || '绝对中立',
        health: parsed.health || 90,
        wealth: parsed.wealth || 20,
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : ['随身药包'],
        currentGoal: parsed.currentGoal || '在客栈避雨',
        isAlive: true,
        relationships: {},
        knownFacts: [
          {
            id: `fact_init_${Date.now()}`,
            fact: `了解${project.worldName}的基本地理与风霜时令`,
            learnedAtTime: project.currentSimulationTime,
            confidence: 1.0,
          }
        ]
      };

      onAddCharacter(newChar);
      onClose();
    } catch (err: any) {
      alert(`角色生成解析失败，请精简描述后重试: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white">AI 智能人物卡速构仪</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 leading-relaxed">
          输入几句人物灵感，AI 将自动推演其价值观阵营、心理恐惧、随身行囊与即时目标，并无缝注入世界模拟因果网。
        </p>

        <div>
          <label className="text-slate-300 font-medium block mb-1">人物灵感雏形：</label>
          <textarea
            rows={4}
            value={briefPrompt}
            onChange={e => setBriefPrompt(e.target.value)}
            placeholder="例如：一位来自江南的落魄琴师，在黑石城以修琴为生，秘密受雇于都巡检司..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-purple-500 leading-relaxed font-serif"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleGenerateCharacter}
            disabled={isGenerating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition flex items-center gap-1.5 shadow"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-300" />}
            <span>{isGenerating ? '因果推演生成中...' : '生成完整人物档案'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
