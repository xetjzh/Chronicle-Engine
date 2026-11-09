import { Dialog } from './Dialog';
import React from 'react';
import { X, Server, Database, Terminal, ShieldCheck, Activity } from 'lucide-react';

interface DeploymentGuideModalProps {
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ onClose }) => {
  const dialogTitleId = React.useId();
  return (
    <Dialog onClose={onClose} titleId={dialogTitleId} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" panelClassName="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-400" />
          <h3 id={dialogTitleId} className="text-lg font-bold text-white">部署指南</h3>
        </div>
        <button onClick={onClose} aria-label="关闭对话框" className="shrink-0 p-1 hover:bg-slate-800 rounded-lg transition">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <DeploymentGuideContent />
      <div className="pt-4 border-t border-slate-800 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition">
          我已了解
        </button>
      </div>
    </Dialog>
  );
};

export function DeploymentGuideContent() {
  return (
      <div className="space-y-4 text-xs leading-relaxed">
        <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-xl space-y-2">
          <div className="font-semibold text-purple-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            在自己的环境中运行
          </div>
          <p className="text-slate-300">
            仓库提供一个 Node 容器，同时运行前端与可选的 Vertex 代理。默认关闭云代理，无需云凭证即可写作。服务器只提供应用入口，作品仍保存在各自浏览器中。
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
            <Terminal className="w-4 h-4 text-purple-400" />
            1. 从仓库根目录启动
          </h4>
          <p className="text-slate-400">安装 Docker 与 Compose 后，使用仓库自带的 Dockerfile 和 compose.yaml：</p>
          <pre className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-purple-300 overflow-x-auto"><code>{`docker compose up --build -d
docker compose ps
docker compose logs --tail=100 -f chronicle`}</code></pre>
          <p className="text-slate-400">
            打开 http://127.0.0.1:8080。默认仅监听宿主机回环地址。可从根目录 .env.example 创建 .env，设置端口和镜像标签。
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            2. 配置 AI 与访问入口
          </h4>
          <p className="text-slate-400">
            Vertex 代理需显式开启并配置项目、区域、允许来源和运行时 Google 凭证。Ollama 与兼容接口由用户浏览器直接访问，请填写用户设备可达的地址，并配置跨域访问。
          </p>
          <p className="text-slate-400">
            对外提供服务前，用 TLS 与组织身份认证网关同时保护应用、HTTP 代理和 WebSocket。公开的代理标记不提供认证。当前应用没有组织账号、角色权限或中心审计功能。
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
            <Activity className="w-4 h-4 text-purple-400" />
            3. 检查运行与保留回滚版本
          </h4>
          <pre className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-purple-300 overflow-x-auto"><code>{`npm ci
npm run check
npm run smoke -- http://127.0.0.1:8080`}</code></pre>
          <p className="text-slate-400">
            本地检查需要 Node.js 22.18+。/healthz 检查进程，/readyz 检查配置与排空状态；两者及 smoke 均不验证真实模型授权。升级使用独立镜像标签，保留上一版镜像及配置；完整步骤见仓库 docs/operations.md。
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
            <Database className="w-4 h-4 text-purple-400" />
            4. 迁移前导出作品备份
          </h4>
          <p className="text-slate-400">
            容器备份不包含浏览器里的作品。更换域名、协议、端口、浏览器或设备前，请导出完整项目 JSON，在新入口还原并检查章节、人物与设定。还原会替换当前项目，应先备份目标浏览器中的作品。
          </p>
          <p className="text-slate-400">
            项目 JSON 包含 AI 设置，可能带有 API 密钥和认证头，请作为敏感文件保存，分享前先脱敏。镜像回滚不会恢复浏览器作品。
          </p>
        </div>
      </div>


  );
}
