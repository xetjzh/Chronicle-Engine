import React from 'react';
import type { AIProviderConfig } from '../types';

const labels = { custom: '自定义', sillytavern_literary: '古典文学', ollama_arm_efficient: 'Ollama 本地写作', deepseek_causality: 'DeepSeek 逻辑推演', gemini_epic: 'Gemini 长篇起草' };
export function AIConfigSummary({ config, running, onEdit }: { config: AIProviderConfig; running: boolean; onEdit: () => void }) {
  const model = config.activeProvider === 'gemini' ? config.gemini.model : config.activeProvider === 'ollama' ? config.ollama.model : config.openaiCompatible.model;
  return <section aria-label="当前生效的 AI 配置" className="rounded-xl border border-purple-800/50 bg-slate-900 p-4 text-xs text-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">当前生效预设：{labels[config.activePreset] || '自定义'}</h3><button onClick={onEdit} className="rounded-lg border border-purple-700 px-3 py-1.5 text-purple-200">修改 AI 配置</button></div>
    <p className="mt-2">{config.activeProvider === 'gemini' ? 'Gemini / Vertex' : config.activeProvider === 'ollama' ? 'Ollama' : 'OpenAI 兼容'} · {model || '尚未填写模型'}</p>
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2"><div><dt className="inline text-slate-400">温度 </dt><dd className="inline">{config.sampling.temperature}</dd></div><div><dt className="inline text-slate-400">Top-P </dt><dd className="inline">{config.sampling.topP}</dd></div>{config.activeProvider !== 'openai_compatible' && <div><dt className="inline text-slate-400">Top-K </dt><dd className="inline">{config.sampling.topK}</dd></div>}<div><dt className="inline text-slate-400">每次输出上限 </dt><dd className="inline">{config.sampling.maxTokens} tokens</dd></div>{config.activeProvider === 'ollama' && <div><dt className="inline text-slate-400">重复惩罚 </dt><dd className="inline">{config.sampling.repetitionPenalty}</dd></div>}{config.activeProvider !== 'gemini' && <div><dt className="inline text-slate-400">频率 / 存在惩罚 </dt><dd className="inline">{config.sampling.frequencyPenalty} / {config.sampling.presencePenalty}</dd></div>}</dl>
    <p className="mt-3 break-words leading-6 text-slate-300">作者附注：{config.authorsNote.enabled ? config.authorsNote.content || '已开启，内容为空' : '未启用'}</p>
    <p role="status" className="mt-2 leading-6 text-slate-400">{running ? '当前任务使用启动时配置；新保存的设置用于下次生成。' : '已保存的设置用于下一次生成；已有正文不会自动改写。'} 不同模型支持的参数可能不同。</p>
  </section>;
}
