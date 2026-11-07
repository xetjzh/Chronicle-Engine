import { Dialog } from './Dialog';
import React from 'react';
import { X, Server, Cpu, Database, Terminal, ShieldCheck, Check } from 'lucide-react';

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

        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-xl space-y-2">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              准备自己的运行环境
            </div>
            <p className="text-slate-300">
              可在自己的服务器上部署应用，并按需连接 Ollama 本地模型。以下为 ARM64 环境的配置示例，请按实际资源与网络条件调整。
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
              <Terminal className="w-4 h-4 text-purple-400" />
              1. 推荐目录结构与 Docker Compose 配置
            </h4>
            <div className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
{`version: '3.8'
services:
  chronicle-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.arm64
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://chronicle:secretpass@db:5432/chronicle_db
      - API_KEY=\${GEMINI_API_KEY}
      - OLLAMA_BASE_URL=http://ollama:11434
    volumes:
      - ./data/backups:/app/backups

  ollama:
    image: ollama/ollama:latest
    container_name: chronicle-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ./data/ollama:/root/.ollama

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=chronicle
      - POSTGRES_PASSWORD=secretpass
      - POSTGRES_DB=chronicle_db
    volumes:
      - ./data/postgres:/var/lib/postgresql/data`}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
              <Cpu className="w-4 h-4 text-purple-400" />
              2. Oracle ARM64 (Ubuntu 22.04 aarch64) 初始化命令
            </h4>
            <div className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-purple-300 overflow-x-auto space-y-1">
              <div># 安装 Docker 及必要环境</div>
              <div>curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh</div>
              <div>docker compose up -d</div>
              <div className="text-slate-400"># 拉取适合 24GB ARM 内存的极致量化文学模型</div>
              <div>docker exec -it chronicle-ollama ollama pull qwen2.5:7b-instruct-q4_K_M</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5 text-sm">
              <Database className="w-4 h-4 text-purple-400" />
              3. 数据备份与迁移方案
            </h4>
            <p className="text-slate-400">
              先导出项目 JSON 备份，在新环境中导入并检查设定、人物与章节。确认恢复完整后，再清理旧环境。
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition"
          >
            我已了解
          </button>
        </div>
    </Dialog>
  );
};
