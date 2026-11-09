import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { DeploymentGuideContent } from './DeploymentGuideModal';

export const AboutSystemModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const titleId = React.useId();
  const [tab, setTab] = useState('开始创作');
  return <Dialog onClose={onClose} titleId={titleId} className="fixed inset-0 flex items-center justify-center bg-black/80 p-4" panelClassName="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 text-slate-200">
    <header className="flex items-center justify-between border-b border-slate-800 p-5"><h2 id={titleId}>关于编年引擎</h2><button onClick={onClose} aria-label="关闭对话框">关闭</button></header>
    <nav aria-label="系统帮助" className="flex flex-wrap gap-2 border-b border-slate-800 p-4">{['开始创作', '部署与运维', '保存与迁移', '模型连接'].map(name => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)} className="rounded border border-slate-700 px-3 py-2 text-xs aria-pressed:bg-purple-800">{name}</button>)}</nav>
    <div className="overflow-y-auto p-5 text-xs leading-7 space-y-4">
      {tab === '开始创作' && <><p>在作品书架创建独立空白作品，填写题材和简介。每本书分别保存，已有原稿不会成为新书正文。</p><p>模式 A：点击启动后批量生成四幕草稿。模式 B：手写、修改或按需起草单章。模式 C：按本地规则推进人物和事件，不调用大模型；离开模拟页会暂停。</p><p>先创建地点，再给人物分配位置；人物先于地点创建时，也可在人物档案重新分配。世界法则中可以管理势力和伏笔。</p><p>在作品书架编辑世界名、文风、叙述视角和章节目标字数。字数是生成目标，实际篇幅仍需审阅。前文记忆和认知边界作为提示提供给模型，不保证生成内容完全无矛盾。</p></>}
      {tab === '部署与运维' && <DeploymentGuideContent />}
      {tab === '保存与迁移' && <><p>作品使用当前浏览器的 IndexedDB 保存。服务器和容器不包含浏览器里的原稿，不提供跨设备同步、组织账号或角色权限。</p><p>请定期导出完整 JSON，并在更换域名、协议、端口、浏览器或设备前验证恢复。备份包括连接设置和密钥，分享前应自行移除敏感连接信息。</p><p>新导入的 PDF 文件内容包含在 JSON 中；旧版本只有临时地址的 PDF 需要重新关联原文件。PDF 和文本导入上限各为 20 MB；EPUB 支持 ZIP 的存储/DEFLATE，需浏览器支持原生解压。</p><p>新世界快照包含人物、地点、势力、法则、伏笔和事件。恢复时保留章节正文，并清理不再有效的事件/视点关联。旧快照不包含完整世界设定，恢复后应检查人物位置。</p></>}
      {tab === '模型连接' && <><p>模型设置中选择 Gemini/Vertex、Ollama 或 OpenAI 兼容接口，保存后用于下一次调用。正在执行的任务使用启动时配置，已有正文不会自动重写。</p><p>模型连接测试会发送一个小请求，可能消耗所选服务的额度。Ollama 和兼容接口由浏览器直接访问，请确保 URL、模型名、授权和 CORS 配置有效。</p><p>创作、人物、剧情灵感与文献考据沿用保存的采样和启用的作者附注。健康检测使用短输出等专用参数。不同服务支持的参数不同，保存配置并不保证模型支持每一个参数。</p><p>停止任务会取消客户端请求并阻止晚到结果写回。服务商是否立即停止计费取决于其服务；连接测试和本地部署健康检查都不能代替真实创作验收。</p></>}
    </div>
  </Dialog>;
};
