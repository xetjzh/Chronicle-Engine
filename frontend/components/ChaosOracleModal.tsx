import { Dialog } from './Dialog';
import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, ChaosTwistPrompt } from '../types';
import { ChaosTwistService } from './../services/chaosTwistService';
import {
  X, Dices, Sparkles, RefreshCw, Check, ArrowRight, ShieldAlert, Zap, AlertTriangle
} from 'lucide-react';

interface ChaosOracleModalProps {
  project: ProjectData;
  onClose: () => void;
  onApplyTwist: (twistText: string) => void;
}

export const ChaosOracleModal: React.FC<ChaosOracleModalProps> = ({
  project,
  onClose,
  onApplyTwist,
}) => {
  const dialogTitleId = React.useId();
  const [contextInput, setContextInput] = useState('');
  const [twists, setTwists] = useState<ChaosTwistPrompt[]>([]);
  const [isRolling, setIsRolling] = useState(false);

  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const currentProject = useRef(project.id); currentProject.current = project.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => { active.current?.abort(); active.current = null; setIsRolling(false); setTwists([]); setError(''); }, [project.id]);
  const close = () => { active.current?.abort(); active.current = null; setIsRolling(false); onClose(); };
  const handleRollDice = async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setError(''); setTwists([]);
    setIsRolling(true);
    try {
      const results = await ChaosTwistService.rollChaosTwists(project, contextInput, controller.signal);
      if (mounted.current && !controller.signal.aborted && currentProject.current === project.id) setTwists(results);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : '剧情提案生成失败，请重试。');
    } finally {
      if (active.current === controller) { active.current = null; if (mounted.current) setIsRolling(false); }
    }
  };

  return (
    <Dialog onClose={close} titleId={dialogTitleId} className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200" panelClassName="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-200 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-purple-400" />
            <div>
              <h3 id={dialogTitleId} className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                剧情灵感
              </h3>
              <p className="text-[11px] text-slate-400">描述眼前的僵局，探索符合世界设定的下一步。</p>
            </div>
          </div>
          <button onClick={close} aria-label="关闭对话框" className="shrink-0 p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-slate-300 font-medium block mb-1">当前剧情瓶颈 / 期望变故方向：</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={contextInput}
              onChange={e => setContextInput(e.target.value)}
              placeholder="描述当前场景、人物困境和你期望的转折…"
              aria-label="当前剧情与期望变故"
              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500 font-serif"
            />
            <button
              onClick={handleRollDice}
              disabled={isRolling}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition flex items-center gap-1.5 shadow shrink-0"
            >
              {isRolling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Dices className="w-3.5 h-3.5 text-yellow-300" />}
              <span>{isRolling ? '正在寻找灵感…' : '生成剧情提案'}</span>
            </button>
          </div>
        </div>

        {error && <p role="alert" className="text-red-300">{error}</p>}
        {twists.length > 0 && (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 pt-2">
            <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              选择一项提案，作为后续章节的创作方向。
            </div>

            {twists.map(t => (
              <div
                key={t.id}
                className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-purple-500/80 rounded-xl space-y-2 transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    {t.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    影响: {t.affectedEntities.join('、')}
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed">{t.suggestedIncident}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-500">诱因：{t.triggerContext}</span>
                  <button
                    onClick={() => {
                      onApplyTwist(`【采纳混沌神谕变故·${t.title}】：\n${t.suggestedIncident}`);
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800 rounded flex items-center gap-1 font-medium transition"
                  >
                    <span>采纳此变故入章</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {twists.length === 0 && !isRolling && (
          <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
            写下当前剧情，再生成可供选择的变故提案。
          </div>
        )}
    </Dialog>
  );
};
