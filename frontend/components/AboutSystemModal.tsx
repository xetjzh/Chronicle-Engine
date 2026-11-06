import React, { useState } from 'react';
import { 
  X, Compass, Server, Cpu, Database, ShieldCheck, Terminal, 
  Copy, Check, BookOpen, HardDrive, Layers, ArrowRight, ExternalLink, Info
} from 'lucide-react';

interface AboutSystemModalProps {
  onClose: () => void;
}

export const AboutSystemModal: React.FC<AboutSystemModalProps> = ({ onClose }) => {
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col text-slate-200 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20 ring-1 ring-white/10">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                关于 Chronicle Engine (编年引擎)
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-800/80">
                  v2.0 私人运行系统
                </span>
              </h3>
              <p className="text-xs text-slate-400">系统架构 · 数据主权 · 部署规范 · 迁移指南</p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
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
            项目定位与理念
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
            数据主权与持久化
          </button>
          <button
            onClick={() => setActiveTab('MODELS')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'MODELS' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            推理模型推荐
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
                  设计初衷：世界自行发展，文学由因果自然孕育
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Chronicle Engine 不是一个调取语言模型套话的玩具网页，而是一套<strong>拥有确定性物理与社会法则、独立认知图谱、人物效用状态机与严格时空因果链</strong>的自主虚拟世界演进系统。
                  角色只有在真实亲历或口耳相传后才知晓信息，世界事件沉淀为确凿正史，再由文学引擎扩写成长篇巨著。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    三大协同创作模式
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
                    纯私人、单人、零外部追踪
                  </div>
                  <p className="text-slate-400">
                    系统专为私人创作与个人阅读定制。不包含商业化充值、社交信息流、外部数据遥测。所有数据保存在本地浏览器 IndexedDB 数据库或您自己的私人服务器中，永久归作者所有。
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2 text-slate-400">
                <div className="text-white font-semibold">为什么模拟系统不依赖每次 NPC 行动都调用 LLM？</div>
                <p>
                  如果每一个行人在每一秒钟都请求大模型，既缓慢又昂贵。Chronicle Engine 采用确定性规则引擎、地理图谱与效用状态机承担常规模拟，仅在需要复杂推理与长篇文学描写时才调用 AI，保证在 4 核低功耗 ARM 上依然能如行云流水般长期自驱演化。
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
                  Google Cloud 临时开发赠金环境向终身服务器迁移规范
                </div>
                <p className="text-slate-300 leading-relaxed">
                  针对前 18 天使用 Google Cloud Compute Engine 免费赠金进行测试的创作者，系统设计遵循<strong>零专有云绑定原则</strong>，确保赠金到期后无需支付任何费用即可继续创作。
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
                    在终身服务器一键恢复
                  </div>
                  <p className="text-slate-400 pl-7">
                    在自己的 Oracle ARM 或本地服务器打开本系统网页，点击“还原”选择此前下载的 JSON，所有状态即刻在本地数据库无损重现，继续不间断进行 3000 章创作。
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
                  IndexedDB 工业级浏览器持久化机制
                </div>
                <p className="text-slate-400 leading-relaxed">
                  市面上常见的网页工具因依赖 5MB 的 localStorage，常在写满 10~20 章后崩溃报错。Chronicle Engine 实现了底层的 <strong>IndexedDB 专用数据库管道</strong>，支持千兆字节（GB）级别的数据吞吐，即使全本突破 3000 章、1200 万字，也能安全稳定运行。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="font-semibold text-white mb-1">分块索引分页</div>
                  <div className="text-slate-400">
                    即使拥有 3000 章节，系统在目录加载时仅提取元数据与分卷切片，杜绝内存膨胀与界面卡顿。
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="font-semibold text-white mb-1">双轨自动存档</div>
                  <div className="text-slate-400">
                    每一次键盘敲击停止后，系统在 600 毫秒内自动将修改提交至 IndexedDB，避免意外刷新丢失文稿。
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
                  针对 24GB ARM 内存的文学与推理模型适配建议
                </div>
                <p className="text-slate-400">
                  根据实践经验，Oracle ARM 4核处理器配合 24GB 内存无需独立 GPU 即可流畅运行 7B~8B 量化模型：
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>Qwen2.5 7B Instruct (Q4_K_M)</span>
                    <span className="text-[10px] text-emerald-400 font-mono">强烈推荐</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    中文文学修辞和长句掌握极为自然，显存占用仅约 4.8GB，在 24GB 内存中留有极充裕的缓存空间。
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>DeepSeek-R1 Distill Qwen 7B / 8B</span>
                    <span className="text-[10px] text-blue-400 font-mono">悬疑因果利器</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    针对复杂历史事件、伏笔回收和一致性审查表现出色的逻辑链条，不易产生自相矛盾的剧情。
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>Google Gemini 2.5 Flash (外部 API)</span>
                    <span className="text-[10px] text-purple-400 font-mono">多幕长篇极速</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    在有网络时作为首选文学起草引擎，支持长达上万 Token 的四幕接力扩写，单章极速产出 4000+ 汉字。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>数据仅保存在您的当前设备与私有容器中</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition"
          >
            返回创作工作台
          </button>
        </div>
      </div>
    </div>
  );
};
