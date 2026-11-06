import React, { useState } from 'react';
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
  const [contextInput, setContextInput] = useState('当前听雨居客栈内各方对峙僵持，需要一个合乎世界法则的不可逆突发变故打破僵局');
  const [twists, setTwists] = useState<ChaosTwistPrompt[]>([]);
  const [isRolling, setIsRolling] = useState(false);

  const handleRollDice = async () => {
    setIsRolling(true);
    try {
      const results = await ChaosTwistService.rollChaosTwists(project, contextInput);
      setTwists(results);
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-200 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                混沌因果神谕骰子 (Plot Twist Oracle)
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                  TaleCrafter / Solo RPG 移植
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">当剧情平淡或卡文时，自动基于世界物理法则与人物隐秘动机摇出不可预测但严密合逻辑的变故</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-slate-300 font-medium block mb-1">当前剧情瓶颈 / 期望变故方向：</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={contextInput}
              onChange={e => setContextInput(e.target.value)}
              placeholder="例如：客栈内僵持不下，需要突发外部危机打破平静..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500 font-serif"
            />
            <button
              onClick={handleRollDice}
              disabled={isRolling}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition flex items-center gap-1.5 shadow shrink-0"
            >
              {isRolling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Dices className="w-3.5 h-3.5 text-yellow-300" />}
              <span>{isRolling ? '摇骰推演中...' : '掷出神谕变故'}</span>
            </button>
          </div>
        </div>

        {twists.length > 0 && (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 pt-2">
            <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              神谕因果提案（点击任意一项直接采纳为后续剧情指导）：
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
            点击上方按钮，基于全书物理法则摇出 3 个不落俗套的剧情变故提案
          </div>
        )}
      </div>
    </div>
  );
};
