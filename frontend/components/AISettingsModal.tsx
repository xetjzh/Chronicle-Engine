import React, { useState } from 'react';
import { ProjectData, AIProviderConfig, AIProviderType, AIPresetType } from '../types';
import { AIProviderService, ProviderHealthResult } from '../services/aiProviderService';
import { storageService } from '../services/storageService';
import { 
  X, Cpu, Server, Sparkles, CheckCircle2, AlertCircle, RefreshCw, 
  Settings2, Shield, Check, Sliders, FileText, Zap, BookOpen
} from 'lucide-react';

interface AISettingsModalProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  onClose: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  project,
  onUpdateProject,
  onClose,
}) => {
  const [config, setConfig] = useState<AIProviderConfig>(project.aiConfig);
  const [activeTab, setActiveTab] = useState<'PROVIDER' | 'SAMPLING' | 'AUTHORS_NOTE' | 'PRESETS'>('PROVIDER');
  const [testingProvider, setTestingProvider] = useState<AIProviderType | null>(null);
  const [testResult, setTestResult] = useState<ProviderHealthResult | null>(null);

  const handleSave = () => {
    const updated = { ...project, aiConfig: config };
    onUpdateProject(updated);
    storageService.saveProject(updated);
    onClose();
  };

  const handleApplyPreset = (preset: AIPresetType) => {
    if (preset === 'sillytavern_literary') {
      setConfig({
        ...config,
        activePreset: preset,
        sampling: {
          ...config.sampling,
          temperature: 0.85,
          topP: 0.92,
          topK: 40,
          repetitionPenalty: 1.18,
          frequencyPenalty: 0.25,
          presencePenalty: 0.2,
          maxTokens: 3500,
        },
        authorsNote: {
          enabled: true,
          content: '[SillyTavern风格附注：严格禁止网络现代词；重点描写视线迟疑、衣物雨水与环境冷暖；人物必须严格基于自己已知信息行事]',
          insertionDepth: 1,
        }
      });
    } else if (preset === 'ollama_arm_efficient') {
      setConfig({
        ...config,
        activePreset: preset,
        activeProvider: 'ollama',
        sampling: {
          ...config.sampling,
          temperature: 0.68,
          topP: 0.88,
          topK: 35,
          repetitionPenalty: 1.22, // 强重复惩罚，避免 Qwen/Llama 在短上下文下反复输出相同句式
          frequencyPenalty: 0.35,
          presencePenalty: 0.3,
          maxTokens: 2000,
        },
        ollama: {
          ...config.ollama,
          contextLength: 8192,
        },
        authorsNote: {
          enabled: true,
          content: '[防复读强化：文字凝练，一气呵成，禁止机械重复先前的描写]',
          insertionDepth: 1,
        }
      });
    } else if (preset === 'deepseek_causality') {
      setConfig({
        ...config,
        activePreset: preset,
        activeProvider: 'openai_compatible',
        sampling: {
          ...config.sampling,
          temperature: 0.6,
          topP: 0.95,
          topK: 50,
          repetitionPenalty: 1.1,
          frequencyPenalty: 0.1,
          presencePenalty: 0.1,
          maxTokens: 4000,
        },
        openaiCompatible: {
          ...config.openaiCompatible,
          model: 'deepseek-chat',
        },
        authorsNote: {
          enabled: true,
          content: '[因果逻辑优先：严密推敲人物每一步行动的直接诱因与心理动机，避免机械巧合]',
          insertionDepth: 1,
        }
      });
    } else if (preset === 'gemini_epic') {
      setConfig({
        ...config,
        activePreset: preset,
        activeProvider: 'gemini',
        sampling: {
          ...config.sampling,
          temperature: 0.8,
          topP: 0.95,
          topK: 40,
          repetitionPenalty: 1.05,
          frequencyPenalty: 0.15,
          presencePenalty: 0.15,
          maxTokens: 4000,
        },
        gemini: {
          ...config.gemini,
          thinkingBudget: 0,
        },
        authorsNote: {
          enabled: true,
          content: '[史诗画卷：长镜头景深描写，多方势力对峙张力蓄而不发]',
          insertionDepth: 1,
        }
      });
    }
  };

  const handleTestConnection = async (provider: AIProviderType) => {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await AIProviderService.testProviderHealth(provider, config);
      setTestResult(res);
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                AI 推理引擎与 SillyTavern 高级调优控制台
              </h3>
              <p className="text-xs text-slate-400">参考酒馆架构：支持重复惩罚、动态采样温度、作者附注 (Author's Note) 与预设一键切换</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3 text-xs">
          <button
            onClick={() => setActiveTab('PROVIDER')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'PROVIDER' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            模型与端点 (Provider)
          </button>
          <button
            onClick={() => setActiveTab('SAMPLING')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'SAMPLING' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            酒馆级采样器 (Sampling)
          </button>
          <button
            onClick={() => setActiveTab('AUTHORS_NOTE')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'AUTHORS_NOTE' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            作者附注 (Author's Note)
          </button>
          <button
            onClick={() => setActiveTab('PRESETS')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'PRESETS' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            调优预设方案 (Presets)
          </button>
        </div>

        {/* Test Result Banner */}
        {testResult && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            testResult.ok ? 'bg-green-950/40 border-green-800/80 text-green-200' : 'bg-red-950/40 border-red-800/80 text-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span>{testResult.message}</span>
            </div>
            {testResult.latencyMs && (
              <span className="text-[10px] opacity-70 font-mono">延迟: {testResult.latencyMs}ms</span>
            )}
          </div>
        )}

        {/* Tab 1: Providers */}
        {activeTab === 'PROVIDER' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">选择当前主推理后端：</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => setConfig({ ...config, activeProvider: 'gemini' })}
                  className={`p-3 rounded-xl border text-left transition text-xs flex flex-col justify-between gap-2 ${
                    config.activeProvider === 'gemini'
                      ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Google Gemini API
                    </span>
                    {config.activeProvider === 'gemini' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">原生 SDK 驱动，超长上下文与深层文学理解</p>
                </button>

                <button
                  onClick={() => setConfig({ ...config, activeProvider: 'ollama' })}
                  className={`p-3 rounded-xl border text-left transition text-xs flex flex-col justify-between gap-2 ${
                    config.activeProvider === 'ollama'
                      ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      Ollama 本地模型
                    </span>
                    {config.activeProvider === 'ollama' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">Oracle ARM 4核/24G 私人离线推理 (Qwen/Llama)</p>
                </button>

                <button
                  onClick={() => setConfig({ ...config, activeProvider: 'openai_compatible' })}
                  className={`p-3 rounded-xl border text-left transition text-xs flex flex-col justify-between gap-2 ${
                    config.activeProvider === 'openai_compatible'
                      ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-blue-400" />
                      OpenAI 兼容接口
                    </span>
                    {config.activeProvider === 'openai_compatible' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">DeepSeek / 通义千问 / 硅基流动自定义端点</p>
                </button>
              </div>
            </div>

            {/* Provider Details */}
            {config.activeProvider === 'gemini' && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">Gemini 2.5 Flash 原生引擎</div>
                  <button
                    onClick={() => handleTestConnection('gemini')}
                    disabled={testingProvider === 'gemini'}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded border border-slate-700 flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingProvider === 'gemini' ? 'animate-spin' : ''}`} />
                    测试连通性
                  </button>
                </div>
                <p className="text-slate-400 text-[11px]">
                  预置使用最新 `gemini-2.5-flash` 模型，自动加载平台密钥。无需手动配置 API Key。
                </p>
              </div>
            )}

            {config.activeProvider === 'ollama' && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">Ollama ARM 本地服务连接</div>
                  <button
                    onClick={() => handleTestConnection('ollama')}
                    disabled={testingProvider === 'ollama'}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingProvider === 'ollama' ? 'animate-spin' : ''}`} />
                    测试连通性
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Base URL</label>
                    <input
                      type="text"
                      value={config.ollama.baseUrl}
                      onChange={e => setConfig({ ...config, ollama: { ...config.ollama, baseUrl: e.target.value } })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">模型名称</label>
                    <input
                      type="text"
                      value={config.ollama.model}
                      onChange={e => setConfig({ ...config, ollama: { ...config.ollama, model: e.target.value } })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Context Length (num_ctx 显存窗口): {config.ollama.contextLength}</label>
                  <input
                    type="range"
                    min="2048"
                    max="32768"
                    step="2048"
                    value={config.ollama.contextLength}
                    onChange={e => setConfig({ ...config, ollama: { ...config.ollama, contextLength: parseInt(e.target.value) || 8192 } })}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>省内存 (4096)</span>
                    <span>推荐平衡 (8192)</span>
                    <span>长篇全景 (16384)</span>
                  </div>
                </div>
              </div>
            )}

            {config.activeProvider === 'openai_compatible' && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">OpenAI 规范第三方端点</div>
                  <button
                    onClick={() => handleTestConnection('openai_compatible')}
                    disabled={testingProvider === 'openai_compatible'}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded border border-slate-700 flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingProvider === 'openai_compatible' ? 'animate-spin' : ''}`} />
                    测试连通性
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">API Base URL</label>
                    <input
                      type="text"
                      value={config.openaiCompatible.baseUrl}
                      onChange={e => setConfig({ ...config, openaiCompatible: { ...config.openaiCompatible, baseUrl: e.target.value } })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">模型名称</label>
                    <input
                      type="text"
                      value={config.openaiCompatible.model}
                      onChange={e => setConfig({ ...config, openaiCompatible: { ...config.openaiCompatible, model: e.target.value } })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">API Key (保存在本地浏览器，不外传)</label>
                  <input
                    type="password"
                    value={config.openaiCompatible.apiKey}
                    onChange={e => setConfig({ ...config, openaiCompatible: { ...config.openaiCompatible, apiKey: e.target.value } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: SillyTavern Sampling Params */}
        {activeTab === 'SAMPLING' && (
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 text-xs">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-400" />
                SillyTavern 经典采样控制矩阵
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">针对中文长篇叙事的专用采样调节，有效抑制 AI “车轱辘话复读”与“逻辑出戏”</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Temperature */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">采样温度 (Temperature): {config.sampling.temperature}</span>
                  <span className="text-slate-500 font-mono">0.1 ~ 1.5</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={config.sampling.temperature}
                  onChange={e => setConfig({ ...config, sampling: { ...config.sampling, temperature: parseFloat(e.target.value) } })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Repetition Penalty */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 font-semibold text-purple-300">
                    重复惩罚 (Repetition Penalty): {config.sampling.repetitionPenalty}
                  </span>
                  <span className="text-slate-500 font-mono">1.0 ~ 1.4</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.4"
                  step="0.02"
                  value={config.sampling.repetitionPenalty}
                  onChange={e => setConfig({ ...config, sampling: { ...config.sampling, repetitionPenalty: parseFloat(e.target.value) } })}
                  className="w-full accent-purple-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  SillyTavern 核心：推荐 1.15~1.20，能彻底防止本地开源小模型（如 Qwen）不断重复前文句式。
                </span>
              </div>

              {/* Top P */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Top-P (核采样): {config.sampling.topP}</span>
                  <span className="text-slate-500 font-mono">0.5 ~ 1.0</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.02"
                  value={config.sampling.topP}
                  onChange={e => setConfig({ ...config, sampling: { ...config.sampling, topP: parseFloat(e.target.value) } })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Top K */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Top-K: {config.sampling.topK}</span>
                  <span className="text-slate-500 font-mono">10 ~ 100</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={config.sampling.topK}
                  onChange={e => setConfig({ ...config, sampling: { ...config.sampling, topK: parseInt(e.target.value) || 40 } })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Presence / Frequency Penalty */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">频率惩罚 (Frequency Penalty): {config.sampling.frequencyPenalty}</span>
                  <span className="text-slate-500 font-mono">0.0 ~ 1.0</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={config.sampling.frequencyPenalty}
                  onChange={e => setConfig({ ...config, sampling: { ...config.sampling, frequencyPenalty: parseFloat(e.target.value) } })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Max Tokens */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">单章最大生成 Token: {config.sampling.maxTokens}</span>
                  <span className="text-slate-500 font-mono">1000 ~ 6000</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="6000"
                  step="250"
                  value={config.sampling.maxTokens}
                  onChange={e => setConfig({ ...config, sampling: { ...config.sampling, maxTokens: parseInt(e.target.value) || 2500 } })}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Author's Note */}
        {activeTab === 'AUTHORS_NOTE' && (
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h4 className="font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  作者附注深度注入 (SillyTavern Author's Note)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  在靠近输出最底端插入最高优先级的写作提示，具有极强的提示词贴合度（Recency Effect）。
                </p>
              </div>
              <button
                onClick={() => setConfig({
                  ...config,
                  authorsNote: { ...config.authorsNote, enabled: !config.authorsNote.enabled }
                })}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  config.authorsNote.enabled ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {config.authorsNote.enabled ? '附注已启用' : '附注已关闭'}
              </button>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">附注强制约束指令文本：</label>
              <textarea
                rows={4}
                value={config.authorsNote.content}
                onChange={e => setConfig({
                  ...config,
                  authorsNote: { ...config.authorsNote, content: e.target.value }
                })}
                placeholder="例如：[作者附注：行文沉郁冷峻；重点展现寒夜微弱炉火与雨声；绝对禁止角色产生超越其自身认知的言行]"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:border-purple-500 leading-relaxed font-serif"
              />
            </div>

            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg text-slate-300 text-[11px] space-y-1">
              <div className="font-semibold text-purple-300">酒馆机制说明：</div>
              <div>• 附注会自动包裹在所有世界事件之后、最终要求正文输出之前。</div>
              <div>• 能够直接纠正模型“跑题”、“滥用修辞”、“强行大团圆”或“剧透伏笔”的行为。</div>
            </div>
          </div>
        )}

        {/* Tab 4: Presets */}
        {activeTab === 'PRESETS' && (
          <div className="space-y-3 text-xs">
            <div className="text-slate-400 mb-2">
              针对不同模型与硬件特点，一键调校最适宜的采样器矩阵与附注：
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => handleApplyPreset('sillytavern_literary')}
                className="p-4 bg-slate-950/60 border border-slate-800 hover:border-purple-500 rounded-xl cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <BookOpen className="w-4 h-4" />
                    SillyTavern 纯正古典文学预设
                  </span>
                  <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                    推荐首选
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Temp 0.85, Top-P 0.92, 重复惩罚 1.18。注重动作细节、心理隐秘与微小表情描写，极具小说张力。
                </p>
              </div>

              <div
                onClick={() => handleApplyPreset('ollama_arm_efficient')}
                className="p-4 bg-slate-950/60 border border-slate-800 hover:border-emerald-500 rounded-xl cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Cpu className="w-4 h-4" />
                    Ollama ARM 本地防复读预设
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    Oracle 专属
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Temp 0.68, 重复惩罚 1.22, 窗口 8192。针对 4核 ARM 优化，彻底消除 Qwen 7B 本地模型的反复唠叨。
                </p>
              </div>

              <div
                onClick={() => handleApplyPreset('deepseek_causality')}
                className="p-4 bg-slate-950/60 border border-slate-800 hover:border-blue-500 rounded-xl cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-blue-300">
                    <Server className="w-4 h-4" />
                    DeepSeek 因果严密逻辑预设
                  </span>
                  <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                    悬疑硬核
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Temp 0.60, Top-P 0.95。强调每一个悬疑线索的逻辑链条，绝不出戏，拒绝机械降神。
                </p>
              </div>

              <div
                onClick={() => handleApplyPreset('gemini_epic')}
                className="p-4 bg-slate-950/60 border border-slate-800 hover:border-purple-500 rounded-xl cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    Gemini 2.5 全景史诗大长篇预设
                  </span>
                  <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                    大画幅
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  充分调动超长上下文理解能力，将全城地形、所有参与者因果自然融入数千字正文中。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>配置变动即时同步至本地持久化数据库</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
            >
              保存并应用全套设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
