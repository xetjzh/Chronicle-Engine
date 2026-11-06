import React from 'react';
import { X, Server, Cpu, Database, Terminal, ShieldCheck, Check } from 'lucide-react';

interface DeploymentGuideModalProps {
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Oracle Cloud ARM64 (4核/24G) 私人长期运行部署指南</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-xl space-y-2">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              架构承诺：赠金到期后零依赖，永久属于个人
            </div>
            <p className="text-slate-300">
              Chronicle Engine 采用模块化单体架构设计。本地优先运行，状态机与因果律数据库完全运行在本地容器中。支持在同一服务器中并行部署 Ollama (qwen2.5:7b-instruct-q4_K_M 或 deepseek-r1:7b) 无需外部网络。
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
              在当前 Web 控制台中点击“导出项目备份 JSON”，可一键将包含全部世界设定、人物认知、事件历史、章节正文及快照打包下载。迁移至新服务器只需在新系统网页中点击“导入备份”，即可零丢失完美恢复。
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
      </div>
    </div>
  );
};
