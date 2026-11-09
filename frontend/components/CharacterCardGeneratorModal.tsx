import { Dialog } from './Dialog';
import React, { useState, useRef, useEffect } from 'react';
import { ProjectData, Character } from '../types';
import { parseGeneratedCharacter } from '../services/characterData';
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
  const dialogTitleId = React.useId();
  const [briefPrompt, setBriefPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const latest = useRef({ project, onAddCharacter, onClose });
  latest.current = { project, onAddCharacter, onClose };
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => { request.current?.abort(); request.current = null; setIsGenerating(false); }, [project.id]);
  const close = () => { request.current?.abort(); request.current = null; setIsGenerating(false); onClose(); };
  const handleGenerateCharacter = async () => {
    if (!briefPrompt.trim() || request.current) return;
    const controller = new AbortController(); request.current = controller;
    const sourceId = project.id; setError('');
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
  "inventory": ["符合本书设定的物品"],
  "currentGoal": "当前行动目标"
}`;

    try {
      const resultText = await AIProviderService.generateText(project.aiConfig, {
        prompt,
        authorsNote: project.aiConfig.authorsNote.enabled ? project.aiConfig.authorsNote.content : undefined,
        signal: controller.signal,
      });

      if (!mounted.current || controller.signal.aborted || latest.current.project.id !== sourceId || request.current !== controller) return;
      const newChar = parseGeneratedCharacter(resultText, latest.current.project);
      latest.current.onAddCharacter(newChar);
      latest.current.onClose();
    } catch (err: any) {
      if (mounted.current && !controller.signal.aborted) setError(`人物生成失败：${err.message}`);
    } finally {
      if (request.current === controller) { request.current = null; if (mounted.current) setIsGenerating(false); }
    }
  };

  return (
    <Dialog onClose={close} titleId={dialogTitleId} className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4" panelClassName="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-400" />
            <h3 id={dialogTitleId} className="text-sm font-bold text-white">创建人物</h3>
          </div>
          <button onClick={close} aria-label="关闭对话框" className="shrink-0 p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 leading-relaxed">
          写下人物灵感，生成包含性格、动机、随身物品与当前目标的人物档案。
        </p>

        {error && <p role="alert" className="text-red-300">{error}</p>}
        <div>
          <label className="text-slate-300 font-medium block mb-1">人物灵感雏形：</label>
          <textarea
            rows={4}
            value={briefPrompt}
            onChange={e => setBriefPrompt(e.target.value)}
            placeholder="描述这个人物的身份、动机和与本书的关系…"
            aria-label="人物灵感"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-purple-500 leading-relaxed font-serif"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            onClick={close}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleGenerateCharacter}
            disabled={isGenerating || !briefPrompt.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition flex items-center gap-1.5 shadow"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-300" />}
            <span>{isGenerating ? '因果推演生成中...' : '生成完整人物档案'}</span>
          </button>
        </div>
    </Dialog>
  );
};
