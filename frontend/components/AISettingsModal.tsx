import { Dialog } from './Dialog';
import React, { useState } from 'react';
import { ProjectData, AIProviderConfig, AIProviderType, AIPresetType } from '../types';
import { AIProviderService, ProviderHealthResult } from '../services/aiProviderService';
import { compatibleRequestPolicy } from '../services/compatibleRequestPolicy.ts';
import {
  X, Cpu, Server, Sparkles, CheckCircle2, AlertCircle, RefreshCw,
  Settings2, Shield, Check, Sliders, FileText, Zap, BookOpen
} from 'lucide-react';

interface AISettingsModalProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  onClose: () => void;
}

const presetLabels: Record<AIPresetType, string> = {
  sillytavern_literary: '古典文学',
  ollama_arm_efficient: 'Ollama 本地写作',
  deepseek_causality: 'DeepSeek 逻辑推演',
  gemini_epic: 'Gemini 长篇起草',
};

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  project,
  onUpdateProject,
  onClose,
}) => {
  const dialogTitleId = React.useId();
  const [config, setConfig] = useState<AIProviderConfig>(project.aiConfig);
  const [activeTab, setActiveTab] = useState<'PROVIDER' | 'SAMPLING' | 'AUTHORS_NOTE' | 'PRESETS'>('PROVIDER');
  const [testingProvider, setTestingProvider] = useState<AIProviderType | null>(null);
  const [testResult, setTestResult] = useState<ProviderHealthResult | null>(null);
  const testController = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => {
    testController.current?.abort();
    testController.current = null;
  }, []);

  const cancelConnectionTest = () => {
    testController.current?.abort();
    testController.current = null;
    setTestingProvider(null);
  };

  const updateConfig = (update: (current: AIProviderConfig) => AIProviderConfig) => {
    cancelConnectionTest();
    setTestResult(null);
    setConfig(update);
  };

  const handleClose = () => {
    cancelConnectionTest();
    onClose();
  };

  const handleSave = () => {
    const updated = { ...project, aiConfig: config };
    onUpdateProject(updated);
    handleClose();
  };

  const handleApplyPreset = (preset: AIPresetType) => {
    if (preset === 'sillytavern_literary') {
      updateConfig(config => ({
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
      }));
    } else if (preset === 'ollama_arm_efficient') {
      updateConfig(config => ({
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
      }));
    } else if (preset === 'deepseek_causality') {
      updateConfig(config => ({
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
        authorsNote: {
          enabled: true,
          content: '[因果逻辑优先：严密推敲人物每一步行动的直接诱因与心理动机，避免机械巧合]',
          insertionDepth: 1,
        }
      }));
    } else if (preset === 'gemini_epic') {
      updateConfig(config => ({
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
      }));
    }
  };

  const handleTestConnection = async (provider: AIProviderType) => {
    cancelConnectionTest();
    const controller = new AbortController();
    testController.current = controller;
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await AIProviderService.testProviderHealth(provider, config, controller.signal);
      if (testController.current === controller && !controller.signal.aborted) setTestResult(res);
    } catch (error) {
      if (testController.current === controller && !controller.signal.aborted) {
        setTestResult({ provider, ok: false, message: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (testController.current === controller) {
        testController.current = null;
        setTestingProvider(null);
      }
    }
  };

  return (
    <Dialog onClose={handleClose} titleId={dialogTitleId} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" panelClassName="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-purple-400" />
            <div>
              <h3 id={dialogTitleId} className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                AI 写作设置
              </h3>
              <p className="text-xs text-slate-400">连接模型，调整生成风格，保存常用写作偏好。</p>
            </div>
          </div>
          <button onClick={handleClose} aria-label="关闭对话框" className="shrink-0 p-1 hover:bg-slate-800 rounded-lg transition">
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
            生成参数
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
        {testingProvider && (
          <div role="status" className="p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-xs flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />正在测试连接…</span>
            <button type="button" onClick={cancelConnectionTest} className="text-slate-300 hover:text-white underline underline-offset-4">取消测试</button>
          </div>
        )}
        {testResult && (
          <div role="status" className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
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
                  onClick={() => updateConfig(config => ({ ...config, activePreset: 'custom', activeProvider: 'gemini' }))}
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
                  <p className="text-[11px] text-slate-400">连接 Gemini，用于起草、续写与润色</p>
                </button>

                <button
                  onClick={() => updateConfig(config => ({ ...config, activePreset: 'custom', activeProvider: 'ollama' }))}
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
                  <p className="text-[11px] text-slate-400">连接本地运行的 Ollama 模型</p>
                </button>

                <button
                  onClick={() => updateConfig(config => ({ ...config, activePreset: 'custom', activeProvider: 'openai_compatible' }))}
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

            <p className="text-[11px] text-slate-400">连接测试可随时取消。Gemini 和兼容接口会发送一条简短生成请求，可能产生费用；Ollama 仅检查服务及所选模型是否已安装。</p>
            {/* Provider Details */}
            {config.activeProvider === 'gemini' && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">Gemini / Vertex AI 连接</div>
                  <button
                    onClick={() => handleTestConnection('gemini')}
                    disabled={testingProvider === 'gemini'}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded border border-slate-700 flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingProvider === 'gemini' ? 'animate-spin' : ''}`} />
                    {testingProvider === 'gemini' ? '测试中…' : '测试连通性'}
                  </button>
                </div>
                <p className="text-slate-400 text-[11px]">
                  使用当前部署环境配置的 Gemini / Vertex AI 认证；Vertex AI 的 ADC 凭据由代理服务读取。连接测试会验证所填模型能否生成内容。
                </p>
                <p className="text-slate-400 text-[11px]">Gemini 2.5 Pro 不支持关闭思考；原有关闭设置会按最低 128 个思考 token 运行。</p>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">模型名称</label>
                  <input aria-label="Gemini 模型名称"
                    type="text"
                    value={config.gemini.model}
                    onChange={e => updateConfig(config => ({ ...config, gemini: { ...config.gemini, model: e.target.value } }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                  />
                </div>
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
                    {testingProvider === 'ollama' ? '测试中…' : '测试连通性'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Base URL</label>
                    <input aria-label="Ollama 服务地址"
                      type="text"
                      value={config.ollama.baseUrl}
                      onChange={e => updateConfig(config => ({ ...config, ollama: { ...config.ollama, baseUrl: e.target.value } }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">模型名称</label>
                    <input aria-label="Ollama 模型名称"
                      type="text"
                      value={config.ollama.model}
                      onChange={e => updateConfig(config => ({ ...config, ollama: { ...config.ollama, model: e.target.value } }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Context Length (num_ctx 显存窗口): {config.ollama.contextLength}</label>
                  <input aria-label="Ollama 上下文窗口"
                    type="range"
                    min="2048"
                    max="32768"
                    step="2048"
                    value={config.ollama.contextLength}
                    onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', ollama: { ...config.ollama, contextLength: parseInt(e.target.value) || 8192 } }))}
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
                    {testingProvider === 'openai_compatible' ? '测试中…' : '测试连通性'}
                  </button>
                </div>
                <label className="flex items-start gap-2 text-slate-300"><input aria-label="通过本服务转发兼容接口" type="checkbox" checked={!!config.openaiCompatible.useServerProxy} onChange={e => updateConfig(c => ({ ...c, openaiCompatible: { ...c.openaiCompatible, useServerProxy: e.target.checked } }))} />通过本服务转发（用于接口不允许浏览器跨域的情况）</label>
                <p className="text-[11px] text-slate-400">{config.openaiCompatible.useServerProxy ? '请求与密钥将经过当前部署服务器；管理员须配置匹配的上游地址及允许的网页来源。服务器逐请求使用密钥，不保存。' : '浏览器直接连接所填服务，接口须允许当前网页跨域访问。部署服务器能连接成功，不代表浏览器可以直连。'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-slate-400">客户端每次生成等待上限（秒）<input aria-label="兼容接口等待上限（秒）" type="number" min={30} max={600} step={1} value={compatibleRequestPolicy(config.openaiCompatible).timeoutSeconds} onChange={e => updateConfig(c => ({ ...c, openaiCompatible: { ...c.openaiCompatible, requestTimeoutSeconds: Math.min(600, Math.max(30, Math.round(Number(e.target.value) || 30))) } }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-white" /></label>
                  {compatibleRequestPolicy(config.openaiCompatible).glm53 && <label className="block text-slate-400">GLM-5.3 思考强度<select aria-label="GLM-5.3 思考强度" value={compatibleRequestPolicy(config.openaiCompatible).reasoningEffort} onChange={e => updateConfig(c => ({ ...c, activePreset: 'custom', openaiCompatible: { ...c.openaiCompatible, reasoningEffort: e.target.value as 'low' | 'high' | 'max' } }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-white"><option value="low">low · 更快响应</option><option value="high">high · 增强推理</option><option value="max">max · 深度推理，可能较慢</option></select></label>}
                </div>
                <p className="text-[11px] text-slate-400">等待上限针对每一次生成请求，不是全章总时长。使用服务端转发时，管理员还需将 API_TIMEOUT_MS 设置为不少于此时长；外部网关也需允许相应的等待时间。超时不会自动重试。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">API Base URL</label>
                    <input aria-label="兼容接口服务地址"
                      type="text"
                      value={config.openaiCompatible.baseUrl}
                      onChange={e => updateConfig(config => ({ ...config, openaiCompatible: { ...config.openaiCompatible, baseUrl: e.target.value } }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">模型名称</label>
                    <input aria-label="兼容接口模型名称"
                      type="text"
                      value={config.openaiCompatible.model}
                      onChange={e => updateConfig(config => ({ ...config, openaiCompatible: { ...config.openaiCompatible, model: e.target.value } }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">API Key（保存在当前浏览器，用于连接所选服务）</label>
                  <input aria-label="兼容接口 API Key"
                    type="password"
                    value={config.openaiCompatible.apiKey}
                    onChange={e => updateConfig(config => ({ ...config, openaiCompatible: { ...config.openaiCompatible, apiKey: e.target.value } }))}
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
                调整生成风格
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
                <input aria-label="采样温度"
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                    value={config.sampling.temperature}
                  onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', sampling: { ...config.sampling, temperature: parseFloat(e.target.value) } }))}
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
                <input aria-label="重复惩罚"
                  type="range"
                  min="1.0"
                  max="1.4"
                  step="0.02"
                    value={config.sampling.repetitionPenalty}
                  onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', sampling: { ...config.sampling, repetitionPenalty: parseFloat(e.target.value) } }))}
                  className="w-full accent-purple-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  可从 1.15～1.20 开始尝试，再根据重复程度与文句自然度调整。
                </span>
              </div>

              {/* Top P */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Top-P (核采样): {config.sampling.topP}</span>
                  <span className="text-slate-500 font-mono">0.5 ~ 1.0</span>
                </div>
                <input aria-label="Top-P 核采样"
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.02"
                    value={config.sampling.topP}
                  onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', sampling: { ...config.sampling, topP: parseFloat(e.target.value) } }))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Top K */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Top-K: {config.sampling.topK}</span>
                  <span className="text-slate-500 font-mono">10 ~ 100</span>
                </div>
                <input aria-label="Top-K 采样"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                    value={config.sampling.topK}
                  onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', sampling: { ...config.sampling, topK: parseInt(e.target.value) || 40 } }))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Presence / Frequency Penalty */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">频率惩罚 (Frequency Penalty): {config.sampling.frequencyPenalty}</span>
                  <span className="text-slate-500 font-mono">0.0 ~ 1.0</span>
                </div>
                <input aria-label="频率惩罚"
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                    value={config.sampling.frequencyPenalty}
                  onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', sampling: { ...config.sampling, frequencyPenalty: parseFloat(e.target.value) } }))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Max Tokens */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">单章最大生成 Token: {config.sampling.maxTokens}</span>
                  <span className="text-slate-500 font-mono">1000 ~ 6000</span>
                </div>
                <input aria-label="单章最大生成 Token"
                  type="range"
                  min="1000"
                  max="6000"
                  step="250"
                    value={config.sampling.maxTokens}
                  onChange={e => updateConfig(config => ({ ...config, activePreset: 'custom', sampling: { ...config.sampling, maxTokens: parseInt(e.target.value) || 2500 } }))}
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
                  作者附注
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  为每次生成补充写作要求，例如语气、视角与人物认知边界。
                </p>
              </div>
              <button
                onClick={() => updateConfig(config => ({
                  ...config,
                  activePreset: 'custom',
                  authorsNote: { ...config.authorsNote, enabled: !config.authorsNote.enabled }
                }))}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  config.authorsNote.enabled ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {config.authorsNote.enabled ? '附注已启用' : '附注已关闭'}
              </button>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">附注强制约束指令文本：</label>
              <textarea aria-label="作者附注内容"
                rows={4}
                    value={config.authorsNote.content}
                onChange={e => updateConfig(config => ({
                  ...config,
                  activePreset: 'custom',
                  authorsNote: { ...config.authorsNote, content: e.target.value }
                }))}
                placeholder="例如：[作者附注：行文沉郁冷峻；重点展现寒夜微弱炉火与雨声；绝对禁止角色产生超越其自身认知的言行]"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:border-purple-500 leading-relaxed font-serif"
              />
            </div>

            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg text-slate-300 text-[11px] space-y-1">
              <div className="font-semibold text-purple-300">使用提示：</div>
              <div>• 附注会自动包裹在所有世界事件之后、最终要求正文输出之前。</div>
              <div>• 写下明确、简短的约束，生成后仍需检查内容是否符合要求。</div>
            </div>
          </div>
        )}

        {/* Tab 4: Presets */}
        {activeTab === 'PRESETS' && (
          <div className="space-y-3 text-xs">
            <div className="text-slate-400 mb-2">
              一键应用生成参数与作者附注，再点击“保存设置”。Ollama、DeepSeek、Gemini 方案会切换对应后端，保留已配置的端点、密钥和模型名称。
            </div>
            <p role="status" className="text-slate-300">
              当前方案：{config.activePreset === 'custom' ? '自定义' : presetLabels[config.activePreset]}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button"
                onClick={() => handleApplyPreset('sillytavern_literary')}
                aria-pressed={config.activePreset === 'sillytavern_literary'}
                className={`text-left p-4 border rounded-xl cursor-pointer transition space-y-2 group ${config.activePreset === 'sillytavern_literary' ? 'bg-purple-950/60 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-950/60 border-slate-800 hover:border-purple-500'}`}
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <BookOpen className="w-4 h-4" />
                    古典文学
                  </span>
                  <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                    {config.activePreset === 'sillytavern_literary' ? '✓ 已选择' : '风格预设'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Temp 0.85，Top-P 0.92，重复惩罚 1.18。侧重动作、心理与细节描写。
                </p>
              </button>

              <button type="button"
                onClick={() => handleApplyPreset('ollama_arm_efficient')}
                aria-pressed={config.activePreset === 'ollama_arm_efficient'}
                className={`text-left p-4 border rounded-xl cursor-pointer transition space-y-2 group ${config.activePreset === 'ollama_arm_efficient' ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-950/60 border-slate-800 hover:border-emerald-500'}`}
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Cpu className="w-4 h-4" />
                    Ollama 本地写作
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    {config.activePreset === 'ollama_arm_efficient' ? '✓ 已选择' : '本地推理'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Temp 0.68，重复惩罚 1.22，窗口 8192。适合先以较低随机性尝试本地模型。
                </p>
              </button>

              <button type="button"
                onClick={() => handleApplyPreset('deepseek_causality')}
                aria-pressed={config.activePreset === 'deepseek_causality'}
                className={`text-left p-4 border rounded-xl cursor-pointer transition space-y-2 group ${config.activePreset === 'deepseek_causality' ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-950/60 border-slate-800 hover:border-blue-500'}`}
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-blue-300">
                    <Server className="w-4 h-4" />
                    DeepSeek 逻辑推演
                  </span>
                  <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                    {config.activePreset === 'deepseek_causality' ? '✓ 已选择' : '悬疑硬核'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Temp 0.60，Top-P 0.95。侧重线索之间的因果关系与情节一致性。
                </p>
              </button>

              <button type="button"
                onClick={() => handleApplyPreset('gemini_epic')}
                aria-pressed={config.activePreset === 'gemini_epic'}
                className={`text-left p-4 border rounded-xl cursor-pointer transition space-y-2 group ${config.activePreset === 'gemini_epic' ? 'bg-purple-950/60 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-950/60 border-slate-800 hover:border-purple-500'}`}
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    Gemini 长篇起草
                  </span>
                  <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                    {config.activePreset === 'gemini_epic' ? '✓ 已选择' : '大画幅'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  侧重长篇上下文中的场景、人物与事件衔接。
                </p>
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>点击保存，将设置保存在当前浏览器中</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
            >
              保存设置
            </button>
          </div>
        </div>
    </Dialog>
  );
};
