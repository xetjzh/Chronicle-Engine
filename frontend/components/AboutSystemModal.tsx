import { Dialog } from './Dialog';
import React, { useState } from 'react';
import {
  X, Compass, Server, Cpu, Database, ShieldCheck, Terminal,
  Copy, Check, BookOpen, HardDrive, Layers, ArrowRight, ExternalLink, Info
} from 'lucide-react';

interface AboutSystemModalProps {
  onClose: () => void;
}

export const AboutSystemModal: React.FC<AboutSystemModalProps> = ({ onClose }) => {
  const dialogTitleId = React.useId();
  const [activeTab, setActiveTab] = useState<'ABOUT' | 'DEPLOY' | 'MIGRATION' | 'STORAGE' | 'MODELS'>('ABOUT');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const dockerComposeCode = `version: '3.8'
services:
  # Chronicle Engine 后端服务
  chronicle-backend:
    image: python:3.12-slim
    container_name: chronicle-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://chronicle:secret_pass@db:5432/chronicle_db
      - API_KEY=\${GEMINI_API_KEY}
      - OLLAMA_BASE_URL=http://ollama:11434
    volumes:
      - ./data/backups:/app/backups
      - ./data/storage:/app/storage
    depends_on:
      - db

  # 本地 Ollama 离线推理容器 (ARM64 aarch64 原生优化)
  ollama:
    image: ollama/ollama:latest
    container_name: chronicle-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ./data/ollama:/root/.ollama

  # 本地 PostgreSQL 核心关系与因果数据库
  db:
    image: postgres:16-alpine
    container_name: chronicle-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=chronicle
      - POSTGRES_PASSWORD=secret_pass
      - POSTGRES_DB=chronicle_db
    volumes:
      - ./data/postgres:/var/lib/postgresql/data`;

  const armInitCommands = `# 1. 更新系统并安装 Docker 环境 (Ubuntu 22.04 LTS ARM64)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
sudo usermod -aG docker $USER

# 2. 启动 Docker Compose 服务栈
mkdir -p chronicle-engine/data/{backups,storage,ollama,postgres}
cd chronicle-engine
docker compose up -d

# 3. 拉取最适 24GB ARM 内存的极致量化文学模型
docker exec -it chronicle-ollama ollama pull qwen2.5:7b-instruct-q4_K_M`;

  return (
    <Dialog onClose={onClose} titleId={dialogTitleId} className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200" panelClassName="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col text-slate-200 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20 ring-1 ring-white/10">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 id={dialogTitleId} className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                关于 Chronicle Engine (编年引擎)
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-800/80">
                  创作工作台
                </span>
              </h3>
              <p className="text-xs text-slate-400">创作方式、项目备份与运行环境说明。</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="关闭对话框" className="shrink-0 p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('ABOUT')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ABOUT' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            开始创作
          </button>
          <button
            onClick={() => setActiveTab('DEPLOY')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'DEPLOY' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            ARM 服务器与 Docker 部署
          </button>
          <button
            onClick={() => setActiveTab('MIGRATION')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'MIGRATION' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            从临时环境平滑迁移
          </button>
          <button
            onClick={() => setActiveTab('STORAGE')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'STORAGE' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            保存与备份
          </button>
          <button
            onClick={() => setActiveTab('MODELS')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'MODELS' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            模型选择
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed">
          {/* Tab 1: About */}
          {activeTab === 'ABOUT' && (
            <div className="space-y-5 max-w-3xl">
              <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-xl space-y-2">
                <div className="font-semibold text-purple-300 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  从世界设定走向章节正文
                </div>
                <p className="text-slate-300 leading-relaxed">
                  整理世界规则、人物与事件，再选择自动推演或亲自写作。你可以随时修改生成内容，并用世界书与参考文献补充创作依据。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    选择适合此刻的创作方式
                  </div>
                  <p className="text-slate-400">
                    <strong>模式 A (全自动演化)</strong>：多卷大纲与章节自动推演；<br />
                    <strong>模式 B (人机协同创作)</strong>：作者握有最高决策权，AI 负责文学润色与分歧探索；<br />
                    <strong>模式 C (自主世界模拟)</strong>：核心自驱系统，静观人物生活。
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    保存你的创作资料
                  </div>
                  <p className="text-slate-400">
                    项目保存在当前浏览器中。请定期导出 JSON 备份；切换设备或浏览器前，先确认备份文件能够恢复。使用 AI 时，相关上下文会发送给选定的模型服务。
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2 text-slate-400">
                <div className="text-white font-semibold">让设定参与故事推进</div>
                <p>
                  在世界模拟中观察人物行动与事件变化，挑选值得展开的冲突，再进入写作。生成结果仍需要作者检查与取舍。
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Deployment */}
          {activeTab === 'DEPLOY' && (
            <div className="space-y-5 max-w-3xl">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Oracle Cloud Always Free (ARM64 · 4核 · 24GB 内存) 部署规格</span>
                </div>
                <p className="text-slate-400">
                  采用 Docker Compose 进行单机模块化部署。利用 24GB 充裕内存，可以在一台机器内同时托管 Postgres 数据库、FastAPI/Node 服务以及运行 7B/8B 量化开源大模型的 Ollama。
                </p>
              </div>

              {/* Docker Compose block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    docker-compose.yml 配置文件
                  </span>
                  <button
                    onClick={() => handleCopyCode(dockerComposeCode, 'docker')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded border border-slate-700 flex items-center gap-1 transition"
                  >
                    {copiedKey === 'docker' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'docker' ? '已复制' : '复制配置'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800/80 leading-relaxed">
                  {dockerComposeCode}
                </pre>
              </div>

              {/* Bash commands block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    Ubuntu ARM64 终端一键初始化命令
                  </span>
                  <button
                    onClick={() => handleCopyCode(armInitCommands, 'bash')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded border border-slate-700 flex items-center gap-1 transition"
                  >
                    {copiedKey === 'bash' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'bash' ? '已复制' : '复制命令'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto border border-slate-800/80 leading-relaxed">
                  {armInitCommands}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 3: Migration */}
          {activeTab === 'MIGRATION' && (
            <div className="space-y-4 max-w-3xl">
              <div className="p-4 bg-purple-950/20 border border-purple-800/50 rounded-xl space-y-2">
                <div className="font-semibold text-purple-300 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  迁移到新的运行环境
                </div>
                <p className="text-slate-300 leading-relaxed">
                  先备份，再在新环境中恢复和检查。确认资料完整后，处理旧环境中的资源。
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">1</span>
                    导出全工程 JSON 种子文件
                  </div>
                  <p className="text-slate-400 pl-7">
                    在当前界面右上角点击“备份”按钮，系统会自动将全部世界规则、地理网络、人物心理档案、已知事实、历史因果事件、已写章节以及世界书（Lorebook）打包为单一通用 JSON 备份文件。
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">2</span>
                    清理 Google Cloud 云端计算资源
                  </div>
                  <p className="text-slate-400 pl-7">
                    备份下载完成后，前往 Google Cloud 控制台，停止并删除临时 Compute Engine 虚拟机实例、挂载磁盘及外部静态 IP，避免免费试用期结束后产生无意扣费。
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">3</span>
                    在新环境恢复项目
                  </div>
                  <p className="text-slate-400 pl-7">
                    在新环境打开工作台，导入此前下载的 JSON。检查世界设定、人物与章节后，继续创作。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Storage */}
          {activeTab === 'STORAGE' && (
            <div className="space-y-4 max-w-3xl">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  项目存储在当前浏览器
                </div>
                <p className="text-slate-400 leading-relaxed">
                  工作台使用浏览器 IndexedDB 保存项目与章节。浏览器存储空间、隐私模式以及清理站点数据都会影响资料保留，请保留独立备份。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="font-semibold text-white mb-1">按需读取章节</div>
                  <div className="text-slate-400">
                    章节正文可按需读取，便于浏览长篇目录和继续写作。
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="font-semibold text-white mb-1">确认保存与导出备份</div>
                  <div className="text-slate-400">
                    留意编辑区的保存状态。完成重要修改后，导出一份项目备份，便于迁移与恢复。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Recommended Models */}
          {activeTab === 'MODELS' && (
            <div className="space-y-4 max-w-3xl">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  按创作任务选择模型
                </div>
                <p className="text-slate-400">
                  以下为可配置的模型示例。可用性、速度与费用取决于模型服务和设备，请通过 AI 设置中的连接测试确认。
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>Qwen2.5 7B Instruct (Q4_K_M)</span>
                    <span className="text-[10px] text-emerald-400 font-mono">本地模型示例</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    可通过 Ollama 尝试中文起草与润色，按设备内存选择量化版本和上下文窗口。
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>DeepSeek-R1 Distill Qwen 7B / 8B</span>
                    <span className="text-[10px] text-blue-400 font-mono">推理模型示例</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    可用于探索事件因果、检查伏笔与设定一致性，最终内容由作者审核。
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>Google Gemini 2.5 Flash (外部 API)</span>
                    <span className="text-[10px] text-purple-400 font-mono">外部服务示例</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    在 AI 设置中配置可用模型，用于起草、续写或润色。模型权限与用量以服务提供方为准。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>定期导出备份，保存重要创作进展。</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
          >
            返回创作工作台
          </button>
        </div>
    </Dialog>
  );
};
