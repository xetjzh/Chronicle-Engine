import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, WorldEvent, Character, LocationNode } from '../types';
import { SimulationEngine } from '../services/simulationEngine';
import { storageService } from '../services/storageService';
import { 
  Clock, Play, Pause, FastForward, RotateCcw, GitBranch, 
  MapPin, ShieldAlert, Sparkles, User, AlertCircle, BookmarkPlus, Eye,
  Activity, RefreshCw
} from 'lucide-react';

interface WorldSimConsoleProps {
  project: ProjectData;
  onUpdateProject: (p: ProjectData) => void;
  onJumpToWriting: (events: WorldEvent[]) => void;
}

export const WorldSimConsole: React.FC<WorldSimConsoleProps> = ({
  project,
  onUpdateProject,
  onJumpToWriting,
}) => {
  const [isAutoSimulating, setIsAutoSimulating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WorldEvent | null>(project.events[project.events.length - 1] || null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [snapshotNameInput, setSnapshotNameInput] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Auto-simulation ticker ref
  const autoSimRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStepHours = (hours: number) => {
    const { updatedProject, newEvents } = SimulationEngine.stepTime(project, hours);
    onUpdateProject(updatedProject);
    if (newEvents.length > 0) {
      setSelectedEvent(newEvents[newEvents.length - 1]);
      showToast(`推进成功！产生了 ${newEvents.length} 起新历史事件。`);
    } else {
      showToast(`时间推进了 ${hours} 小时，风平浪静。`);
    }
  };

  // Continuous auto simulation ticker
  useEffect(() => {
    if (isAutoSimulating) {
      autoSimRef.current = window.setInterval(() => {
        handleStepHours(4);
      }, 3500);
    } else if (autoSimRef.current) {
      clearInterval(autoSimRef.current);
    }
    return () => {
      if (autoSimRef.current) clearInterval(autoSimRef.current);
    };
  }, [isAutoSimulating, project]);

  const handleCreateSnapshot = () => {
    if (!snapshotNameInput.trim()) return;
    const updated = storageService.createSnapshot(project, snapshotNameInput, '创作者手动存盘点');
    onUpdateProject(updated);
    setSnapshotNameInput('');
    showToast('世界状态快照已保存！可随时安全回滚。');
  };

  const handleRestoreSnapshot = (snapId: string) => {
    if (window.confirm('确定要将当前世界回滚至此历史快照吗？当前快照之后发生的事件将被折叠。')) {
      const updated = storageService.restoreSnapshot(project, snapId);
      onUpdateProject(updated);
      showToast('世界状态已精准回滚！');
    }
  };

  const filteredEvents = selectedLocationId === 'all' 
    ? [...project.events].reverse() 
    : [...project.events].filter(e => e.locationId === selectedLocationId).reverse();

  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 text-sm animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Status & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/60 text-purple-300 border border-purple-700/50">
                模式 C: 自主世界运行中
              </span>
              <span className="text-xs text-slate-400">
                当前推理源: <strong className="text-purple-300 font-mono">{project.aiConfig?.activeProvider.toUpperCase() || 'GEMINI'}</strong>
              </span>
              {isAutoSimulating && (
                <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-950 px-2 py-0.5 rounded border border-green-800 animate-pulse">
                  <Activity className="w-3 h-3" />
                  自动心跳演进中
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-serif font-bold text-white tracking-wide">
                {project.currentSimulationTime}
              </h2>
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                步数 #{project.timeStepIndex}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAutoSimulating(!isAutoSimulating)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 ${
                isAutoSimulating ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isAutoSimulating ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  暂停自动模拟
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  开启无人值守演进
                </>
              )}
            </button>
            <button
              onClick={() => handleStepHours(2)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-purple-400" />
              推进一刻 (2小时)
            </button>
            <button
              onClick={() => handleStepHours(8)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <FastForward className="w-4 h-4" />
              推进一个时段 (8小时)
            </button>
            <button
              onClick={() => {
                if (selectedEvent) onJumpToWriting([selectedEvent]);
              }}
              disabled={!selectedEvent}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              以此事件成章
            </button>
          </div>
        </div>

        {/* World Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
          <div>活跃人物：<span className="text-white font-semibold">{project.characters.filter(c => c.isAlive).length}</span> 名</div>
          <div>已知据点：<span className="text-white font-semibold">{project.locations.length}</span> 处</div>
          <div>累计确凿历史事件：<span className="text-white font-semibold">{project.events.length}</span> 起</div>
          <div>已设伏笔：<span className="text-purple-300 font-semibold">{project.foreshadowing.filter(f => !f.isResolved).length}</span> 条待回收</div>
        </div>
      </div>

      {/* Main Grid: Location Map, Event Feed & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Spatial & Character status */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                地理地点分布
              </h3>
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none"
              >
                <option value="all">查看全部地点</option>
                {project.locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {project.locations.map(loc => {
                const occupants = project.characters.filter(c => c.currentLocationId === loc.id && c.isAlive);
                return (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                      selectedLocationId === loc.id 
                        ? 'bg-purple-950/40 border-purple-500/80 text-white' 
                        : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{loc.name}</span>
                      <span className="text-[11px] text-purple-400 font-mono">
                        {occupants.length > 0 ? `${occupants.length} 人滞留` : '空巷无人'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{loc.description}</p>
                    {occupants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {occupants.map(o => (
                          <span key={o.id} className="inline-flex items-center gap-1 bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[10px] border border-slate-700">
                            <User className="w-2.5 h-2.5 text-purple-400" />
                            {o.name} ({o.currentMood})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Snapshot Management */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-purple-400" />
              历史快照与平行分支
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={snapshotNameInput}
                onChange={e => setSnapshotNameInput(e.target.value)}
                placeholder="为当前世界节点命名..."
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white flex-1 outline-none focus:border-purple-500"
              />
              <button
                onClick={handleCreateSnapshot}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition flex items-center gap-1"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-purple-400" />
                存盘
              </button>
            </div>

            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {project.snapshots.map(snap => (
                <div key={snap.id} className="p-2.5 bg-slate-800/40 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-slate-200">{snap.snapshotName}</div>
                    <div className="text-[10px] text-slate-400">{snap.simulationTime} · {snap.eventsCount}事件</div>
                  </div>
                  <button
                    onClick={() => handleRestoreSnapshot(snap.id)}
                    className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition"
                    title="回滚到此快照"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Event Chronicle Feed */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              真实历史演进因果链 (按时间倒序)
            </h3>
            <span className="text-xs text-slate-400">{filteredEvents.length} 条记录</span>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredEvents.map(evt => {
              const isSelected = selectedEvent?.id === evt.id;
              const loc = project.locations.find(l => l.id === evt.locationId);
              return (
                <button
                  type="button"
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  aria-pressed={isSelected}
                  className={`block w-full text-left p-3.5 rounded-xl border cursor-pointer transition text-xs relative ${
                    isSelected 
                      ? 'bg-purple-950/30 border-purple-500 shadow-md' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-purple-400 font-semibold">{evt.simulationTime}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                      {loc?.name || evt.locationId}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-100 text-sm mb-1">{evt.title}</h4>
                  <p className="text-slate-400 line-clamp-2 leading-relaxed">{evt.description}</p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      参与者: {evt.participantIds.map(id => project.characters.find(c => c.id === id)?.name || id).join(', ')}
                    </div>
                    {evt.causeEventIds.length > 0 && (
                      <span className="text-purple-400 flex items-center gap-1">
                        因果前序: #{evt.causeEventIds.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Event Inspector & Epistemic Boundary */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sticky top-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-purple-400" />
                事件因果审计核查
              </h3>
              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
                不可随意篡改
              </span>
            </div>

            {selectedEvent ? (
              <div className="space-y-3.5">
                <div>
                  <div className="text-[11px] text-slate-400">事件名称与时间戳</div>
                  <div className="text-sm font-bold text-white mt-0.5">{selectedEvent.title}</div>
                  <div className="text-[11px] font-mono text-purple-300">{selectedEvent.simulationTime}</div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">事件详实描述</div>
                  <div className="p-2.5 bg-slate-800/60 rounded-lg text-slate-300 leading-relaxed border border-slate-800">
                    {selectedEvent.description}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">因果推导后果</div>
                  <ul className="space-y-1">
                    {selectedEvent.consequences.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-slate-300">
                        <span className="text-purple-400">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">认知边界 (严禁越权获知)</div>
                  <div className="p-2 bg-slate-800/40 rounded border border-slate-800 text-[11px] text-slate-300">
                    {selectedEvent.visibility.isPublic ? (
                      <span className="text-green-400">公开传闻（城内常识）</span>
                    ) : (
                      <div>
                        <span className="text-amber-400">仅限亲历者知晓：</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedEvent.visibility.knownByCharacterIds.map(id => (
                            <span key={id} className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">
                              {project.characters.find(c => c.id === id)?.name || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onJumpToWriting([selectedEvent])}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    将此因果输入叙事引擎生成小说
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-10">
                请在左侧点击任一历史事件进行详情审计
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
