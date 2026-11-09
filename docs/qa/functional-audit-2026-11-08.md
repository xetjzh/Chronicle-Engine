# 编年引擎功能检查记录（2026-11-08）

本轮仅检查和记录，没有修复业务代码。检查基于提交 `df5eebca99f9eb9ebb96ae341653bb49d932e551`。以下为 **30 个问题条目**，不代表 30 个相互独立的根因。优先级：P1 高影响（11 项），P2 一般功能问题或行为差异（18 项），P3 统计与体验问题（1 项）。

## 检查方式与证据边界

- 环境：Windows / PowerShell，Node `v26.12.1`，npm `11.20.0`。
- `npm run check`：退出码 0；前端 136 项、后端 19 项、交付 4 项，共 **159 项现有测试通过**；仓库配置检查、TypeScript 检查、后端语法检查和生产构建通过。
- `node .superpowers/sdd/delivery/local-smoke.mjs`：退出码 0；真实 Node HTTP 服务、健康/就绪检查、首页及 3 个关联静态资源检查通过，AI 代理关闭。此脚本为已有的本地临时辅助脚本，不属于本报告新增交付文件。
- 新增诊断脚本运行 **38 个检查案例**：30 个问题行为复现、8 组正常行为验证，脚本自身失败 0。它直接运行真实 TS/TSX 服务和组件处理函数，仅替换 AI、浏览器存储或挂载边界；断言刻意记录当前问题行为，不是修复后的验收测试。
- 所有新增测试均使用合成作品和假 AI 返回；没有读取用户原稿、使用真实 API 密钥、发起付费模型请求或写入用户浏览器存储。
- **没有完成浏览器端到端验证。** 权限开放后重新连接，仍返回 `The browser access host is unavailable`；原生应用通道也报 `Computer Use native pipe is unavailable`。因此下文“复现”均指组件处理函数/服务层复现，不冒充浏览器点击、截图或视觉检查。
- GitHub 插件可读取 `xetjzh/Chronicle-Engine`。提交状态接口返回 `statuses: []`；提交工作流接口返回空列表，但该接口只筛选 PR 触发的工作流，**不能据此判断 push CI 没运行或已通过**。
- 未执行 Docker 实际构建/启动、真实云端 AI/Ollama 调用、真实浏览器刷新/跨设备恢复、移动端布局和键盘焦点检查；这些属于待测项，不计入已确认问题数。

复现材料：

- [诊断脚本](./functional-audit-2026-11-08.cjs)
- [本轮原始结果 JSON](./functional-audit-2026-11-08.results.json)
- 重跑：在仓库根目录执行 `node docs/qa/functional-audit-2026-11-08.cjs`。脚本重写同目录结果 JSON，不改变业务文件，不调用外部模型。

## 功能覆盖清单

“通过”仅表示下列列出的案例通过，不等于整个模块不存在问题。

| 模块/操作 | 本轮执行结果 | 关联问题/限制 |
| --- | --- | --- |
| 空白新书、独立项目结构 | P01：零章节、零人物，书名和题材正确，备份结构合法 | F01、F02、F03、F26 |
| 作品书架、切换、异步保存失败、跨书更新隔离 | 现有 App/ProjectLibrary/storage 测试通过 | 未操作用户真实书架、未做真实多标签页竞争 |
| 纯享写作新增、输入、字号偏好 | P02 通过；现有删除确认/取消/最后一章/停止 AI 等测试通过 | F05、F21、F27、F30 |
| 模式 A 批量生成与停止 | 现有作者指令传递、批量冲突/晚到结果测试通过；F22 执行停止处理 | 真实模型质量与付费任务未测；F13、F20、F22、F26 |
| 模式 B 单章起草、构思建议 | 现有空书第一章/配置摘要测试通过；捕获实际生成参数 | F13、F14、F20、F21 |
| 调优预设选择、保存、重开、自定义切换 | 现有 AISettingsModal 测试通过 | F20 记录其他工具与采样/附注的差异；不再报告“预设完全无法选择” |
| AI 连接检测、超时、取消、错误、Gemini 代理 | 现有 provider/interceptor/backend 测试通过，模拟 HTTP/SDK 边界 | 真实服务连通性未测，不作“真实 AI 全部连接正常”结论 |
| 人物手动添加、修改、AI 生成人物 | 执行真实添加/编辑处理函数及假 AI 返回 | F01、F03、F07、F18、F28 |
| 世界法则、地点、势力、伏笔 | P05 法则新增和伏笔回收通过；执行地点新增、删除、势力页切换 | F02、F03、F04、F26；未逐一验证全部字段 CRUD |
| 模式 C 时钟、自动运行、暂停 | 现有定时推进最新状态测试通过；P06 休息/财富转移通过 | F01、F04、F17；确实是本地规则执行，未调用 AI |
| 快照创建/恢复 | P07 简单回滚时钟和人物通过；执行跨地点/章节事件回滚场景 | F16 |
| 世界书命中与排序 | P04 常驻、启用开关、主次关键词、排序通过 | 编辑器全部 CRUD、巨大词条规模未完整测试 |
| TXT / Markdown / EPUB / PDF 导入 | 执行真实解析服务，EPUB 使用实际 ZIP/DEFLATE 合成容器 | F06、F08、F09、F10、F24 |
| 文献搜索、摘录、AI 考据、对照素材 | 现有搜索原始章节索引测试通过；执行摘录/异步考据回调 | F23、F29、F30；真实剪贴板/选择/下载未测 |
| 阅读器翻页、主题、字号 | P03 处理函数和生成属性通过 | 实际字体、滚动位置和移动端视觉未测 |
| 叙事分析 | P08 缺失评分不伪造、平均分只统计已评分章节通过 | F21；图表实际渲染和重名人物统计未全面验证 |
| 因果审计 | 假 AI 返回一致时执行本地审计规则 | F15；真实语义审计未测 |
| JSON 备份、导入与 Markdown 导出 | 现有备份保真、跨书导入和下载 URL 释放测试通过 | F10、F19、F28；未用浏览器实际下载并跨设备恢复 |
| 关于/部署帮助 | 执行内置帮助的部署标签切换 | F25 |
| 部署运行与接口边界 | 真实 HTTP 冒烟及现有后端测试通过 | Docker、push CI、真实生产运维未验收 |

## 问题索引

| 编号 | 优先级 | 问题 |
| --- | --- | --- |
| F01 | P1 | 人物先于地点创建后无法分配有效地点，世界模拟无法进入正常流程 |
| F02 | P2 | 空白书的势力页只有展示，没有新增/编辑入口 |
| F03 | P2 | 手动人物与地点默认值仍将旧示例世界写进新书 |
| F04 | P2 | 删除地点留下人物位置和地理连接的悬空引用 |
| F05 | P1 | 选中文字后点击续写会替换原文 |
| F06 | P1 | 异步资料导入会覆盖等待期间的新正文 |
| F07 | P1 | AI 人物生成旧回调会覆盖等待期间的新正文 |
| F08 | P2 | 标准压缩 EPUB 没有被真正解包解析 |
| F09 | P2 | 常见带标题中文章节和 Markdown 标题无法正确分章 |
| F10 | P1 | PDF 只保存临时 blob URL，完整项目备份没有文件内容 |
| F11 | P1 | 剧情灵感的 AI 失败被静默替换为旧作品固定提案 |
| F12 | P1 | 剧情灵感返回合法但缺字段的 JSON 数组时渲染抛错 |
| F13 | P1 | 单章生成未接入前章正文、提炼摘要及人物已知事实 |
| F14 | P2 | 共写建议缺少简介、正文和世界规则上下文 |
| F15 | P2 | 因果审计把死者生前的参与记录也判为严重错误 |
| F16 | P1 | 快照回滚后人物地点与章节事件引用可能失效 |
| F17 | P2 | 同地三人以上时，后续人物长期不被模拟 |
| F18 | P2 | 健康数值可越界；AI 的零值被默认值替换 |
| F19 | P2 | 备份校验接受重复 ID、非法枚举与无效引用 |
| F20 | P2 | 部分工具覆盖用户温度且不传作者附注，界面缺少对应说明 |
| F21 | P2 | 改写正文后旧摘要、张力分数和定稿状态继续保留 |
| F22 | P2 | 流水线停止没有向当前 AI 请求发送取消信号 |
| F23 | P2 | 切换文献后旧 AI 考据结果仍显示在新文献页面 |
| F24 | P1 | 批量导入文献的毫秒 ID 冲突，破坏选择和删除语义 |
| F25 | P2 | 内置部署说明仍指向不存在的 Python/PostgreSQL 后端 |
| F26 | P2 | 世界名、文风缺少入口，章节篇幅目标未控制生成流程 |
| F27 | P3 | “今日写作”计数不会跨日期重置 |
| F28 | P1 | AI 人物字段未校验，可使作品下次恢复被校验拒绝 |
| F29 | P2 | 跨文献切换后，摘录可被保存到错误来源 |
| F30 | P2 | 对照素材只显示第一章；PDF 对照仅显示占位说明 |

## 逐项问题记录

### F01 · P1 · 先建人物后建地点，人物无法进入有效位置

- 步骤：空白书 → 手动添加人物 → 新增一个地点 → 回到人物页尝试分配地点 → 推进世界时间。
- 预期：能将已有角色放到新地点，再参与模拟。
- 实际：角色最初被写入不存在的 `loc_tavern`；人物页没有地点选择器。后来增加真实地点也不更新角色。组件层确认地点选择器为 0，推进后无事件。
- 影响：按常见“先建主角，再搭世界”的顺序操作，会卡住模式 C；这也是界面提示“添加人物并分配地点”无法完成的场景。
- 位置：[CharacterManager.tsx](../../frontend/components/CharacterManager.tsx#L26) 的默认位置及编辑表单；[WorldSimConsole.tsx](../../frontend/components/WorldSimConsole.tsx#L34) 的运行条件。

### F02 · P2 · 势力页不能从零建立势力

- 步骤：空白书 → 世界法则 → 势力与阵营。
- 预期：新增势力，配置其名称、立场和关系。
- 实际：仅 `project.factions.map` 展示已有记录；空书页面没有任何表单和创建按钮。处理函数层生成的树只有 4 个模块切换按钮。
- 影响：需要依靠导入/编辑 JSON 才能给新书建立势力；已有势力也没有编辑入口。
- 位置：[WorldEditor.tsx](../../frontend/components/WorldEditor.tsx#L378)。

### F03 · P2 · 新书仍被真实写入旧世界默认设定

- 步骤：创建科幻书“月球考古” → 手动添加人物 → 地点仅填“月球基地”，其余留空保存。
- 预期：中性默认值或让用户补充。
- 实际：人物称号“流浪刀客”、目标“在寒江关打听兄长消息”；地点描述“北关未知据点”、环境“风雪严寒”。这些是保存数据，不只是输入框示例。
- 影响：新书会混入不属于本题材的设定，并可能进入 AI 提示和模拟。
- 位置：[CharacterManager.tsx](../../frontend/components/CharacterManager.tsx#L26)、[WorldEditor.tsx](../../frontend/components/WorldEditor.tsx#L54)。

### F04 · P2 · 删地点不维护引用完整性

- 步骤：地点 A 有人物，地点 B 连接 A → 删除 A。
- 预期：处理人物迁移和连接关系，或阻止删除并说明引用。
- 实际：只删除地点记录；人物 `currentLocationId` 和 B 的 `connectedLocationIds` 仍指向 A。
- 影响：人物显示“未知”，模拟忽略无效地点角色；原连接成为死路。没有自动恢复步骤。
- 位置：[WorldEditor.tsx](../../frontend/components/WorldEditor.tsx#L71)。

### F05 · P1 · 对选中文本续写会删除所选原文

- 步骤：正文为“开头。选中的原文。结尾。” → 选中“选中的原文。” → 点击续写；假 AI 返回“新增续写”。
- 预期：续写保留已有原文，在明确的位置插入新内容。
- 实际：结果为“开头。新增续写结尾。”，所选原文消失。未选中时则使用追加分支，行为不同。
- 影响：用户使用“续写”可能无意删掉已经写好的段落。
- 位置：[AuthorDeskEditor.tsx](../../frontend/components/AuthorDeskEditor.tsx#L153)，选中状态沿用替换区间。

### F06 · P1 · 资料上传旧状态覆盖新正文

- 步骤：开始异步导入文献 → 解析尚未结束时关闭资料库并继续写作，或让后台状态变化 → 解析结束。
- 预期：将新资料合并到最新作品，保留期间的正文修改。
- 实际：导入函数在开始时捕获 `project`，结束时用旧对象展开提交。诊断中等待期间正文已改为“上传期间刚写的新正文”，完成后提交的却是“原始正文”。
- 影响：同一书内的修改可能被无提示回退；App 的跨书 ID 检查不能拦截同书旧版本。
- 位置：[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L57)，尤其完成时的旧 `project` 提交。

### F07 · P1 · AI 人物生成旧回调覆盖新正文

- 步骤：打开人物 AI 生成 → 请求等待时关闭弹窗并写新内容 → AI 返回人物。
- 预期：只向当前最新作品追加人物，或忽略已关闭任务的结果。
- 实际：等待中的生成器保留旧 `onAddCharacter`，父处理函数使用当时的 `project` 追加人物。模拟返回时，新正文被旧正文替换。
- 影响：生成成功也可能导致原稿回退；此问题与跨书隔离是不同场景。
- 位置：[CharacterManager.tsx](../../frontend/components/CharacterManager.tsx#L60)、[CharacterCardGeneratorModal.tsx](../../frontend/components/CharacterCardGeneratorModal.tsx#L90)。

### F08 · P2 · EPUB 没有实际解包

- 步骤：导入包含压缩 XHTML 章节的 ZIP/DEFLATE EPUB；合成正文包含唯一标记。
- 预期：读取容器目录、解压正文并按阅读顺序解析。
- 实际：把整个 ZIP 二进制直接当 UTF-8 解码，然后查找 HTML 标签；没有 ZIP 解压、OPF/spine 解析。返回成功但内容不含原文标记，并含 ZIP/二进制乱码。
- 影响：常见压缩 EPUB 无法作为可读参考文献使用，成功状态会误导用户。
- 位置：[documentParserService.ts](../../frontend/services/documentParserService.ts#L70)。

### F09 · P2 · 常见文本标题分章失败

- 步骤：导入 `第一章 初见\n正文甲\n第二章 再见\n正文乙`；另导入含 `# 第一章`、`# 第二章` 的 Markdown。
- 预期：分别识别为两章。
- 实际：两份资料都只有 1 个解析章节；Markdown 还被标记为 `txt`。中文正则在“章”后要求直接换行，不支持常见的章名后缀；Markdown 标题没有处理。
- 影响：章节目录、搜索定位和按章考据失去粒度。
- 位置：[documentParserService.ts](../../frontend/services/documentParserService.ts#L12)。

### F10 · P1 · PDF 不包含在可持久恢复的数据里

- 步骤：导入 PDF → 检查持久化对象/导出 JSON → 在新会话或另一浏览器恢复。
- 预期：“完整备份”具备恢复 PDF 所需的文件内容，或明确标注需要重新关联。
- 实际：记录只有 `blob:` URL、元信息和占位段落，没有文件 Blob/字节数据。诊断确认源文件标记没有出现在序列化结果。
- 影响：blob URL 的生命周期结束后，备份/存档不能重建 PDF；丢失的是文件访问能力。**跨浏览器打开的实际报错界面未测**，上述存储缺失已确认。
- 位置：[documentParserService.ts](../../frontend/services/documentParserService.ts#L128)、[storageService.ts](../../frontend/services/storageService.ts#L136)。

### F11 · P1 · 剧情灵感失败被伪装成成功

- 步骤：科幻新书中生成剧情提案；AI 边界抛出网络错误。
- 预期：报告生成失败，允许重试。
- 实际：服务捕获所有异常，返回 3 个固定旧提案，包含“听雨居”“裴子期”“青溟石”等。没有失败标记。
- 影响：用户可能把示例素材误认为模型对自己作品的推演并采纳；断网、鉴权失败、解析错误都会走此分支。
- 位置：[chaosTwistService.ts](../../frontend/services/chaosTwistService.ts#L55)。此外弹窗初始剧情输入仍是旧客栈情节：[ChaosOracleModal.tsx](../../frontend/components/ChaosOracleModal.tsx#L21)。

### F12 · P1 · 剧情提案缺字段导致渲染异常

- 步骤：假 AI 返回合法 JSON `[ { "title": "提案" } ]` → 显示结果。
- 预期：验证结构，显示格式错误。
- 实际：服务只检查非空数组就返回；组件执行 `t.affectedEntities.join(...)`，抛出未定义字段异常。真实组件函数重渲染已复现该异常。
- 影响：剧情灵感工具无法继续显示；应用没有该处的局部错误兜底。实际浏览器异常页范围未验证。
- 位置：[chaosTwistService.ts](../../frontend/services/chaosTwistService.ts#L50)、[ChaosOracleModal.tsx](../../frontend/components/ChaosOracleModal.tsx#L92)。

### F13 · P1 · “递归记忆/认知边界”没有进入单章生成上下文

- 步骤：第一章正文设置独有秘密；提炼摘要与人物已知事实分别再放独有标记 → 在模式 B 起草第二章 → 捕获所有 AI 请求参数。
- 预期：后章能获得前文事实与人物认知资料。
- 实际：四幕生成的所有请求都没有前章正文、`chapter.extraction` 或 `character.knownFacts` 标记。生成引擎未读取这些集合，单章入口也未补入前章文本。`HierarchicalMemoryService` 没有接入调用。
- 影响：即使“递归事实沉淀”显示成功，也不能据此认为后续生成使用了该记忆，更不能保证人物认知不穿帮。
- 范围：**模式 A 另外传了前一章尾部 1200 字和大纲**，不能将此条说成所有模式完全无前文；A 同样没有读取沉淀摘要和 knownFacts。
- 位置：[NovelEditor.tsx](../../frontend/components/NovelEditor.tsx#L178)、[chapterExpansionEngine.ts](../../frontend/services/chapterExpansionEngine.ts#L18)、[hierarchicalMemoryService.ts](../../frontend/services/hierarchicalMemoryService.ts#L3)。

### F14 · P2 · 共写建议与实际故事脱节的上下文缺口

- 步骤：在简介、世界规则和正文分别设置唯一标记 → 请求下一步创作建议。
- 预期：根据故事现状和硬规则构思后续。
- 实际：提示仅包含书名、时间、人物位置/心境和用户方向；三个标记全部未传入。文本要求“恪守世界法则”，却没有给出这些法则。
- 影响：建议功能缺少判断“下一步”的关键事实。实际模型会产生什么建议未作付费测试。
- 位置：[geminiService.ts](../../frontend/services/geminiService.ts#L140)。

### F15 · P2 · 死者审计没有区分历史和死后事件

- 步骤：当前第 10 步将角色标记为死亡；事件表只有第 1 步参与记录；AI 返回一致。
- 预期：不能仅凭生前历史参与记录推断死者仍在行动。
- 实际：只要 `isAlive === false` 且任何历史事件有其 ID，就报“已故角色仍然产生事件”，严重级 critical，并建议移除事件参与者或恢复生存状态。
- 影响：正常历史被误报，处理建议还可能破坏正当历史。项目当前缺少死亡时间，规则无法完成时序区分。
- 位置：[geminiService.ts](../../frontend/services/geminiService.ts#L59)。

### F16 · P1 · 快照恢复后数据相互矛盾

- 步骤：角色位于 old 地点时建立快照 → 删除 old/新增 new，推进事件并把事件关联到章节 → 恢复快照。
- 预期：恢复后人物和关联引用处于可解释的一致状态。
- 实际：恢复了指向 old 的人物，但地点仍只有 new；未来事件被截掉，章节 `associatedEventIds` 仍保留被删事件 ID。快照只保存人物、时钟及事件数量等，没有地点集合。
- 影响：回滚后人物不能模拟，章节史实链接失效；界面“世界状态已精准回滚”比实际能力更强。
- 位置：[storageService.ts](../../frontend/services/storageService.ts#L155)、[storageService.ts](../../frontend/services/storageService.ts#L174)。

### F17 · P2 · 同地点后排角色被饿死在调度之外

- 步骤：同一地点放 a、b、c 三名存活角色，连续推进 5 次。
- 预期：各角色有机会行动、学习和按状态休息。
- 实际：始终只选数组前两个角色交互；c 从未参加事件，knownFacts 为 0，健康仍为 50。多人位置不会走单人休息分支。
- 影响：所谓群像模拟实际只运行每处的前两人；人物顺序决定谁被忽略。
- 位置：[simulationEngine.ts](../../frontend/services/simulationEngine.ts#L40)。

### F18 · P2 · 人物数值边界和零值错误

- 步骤一：健康输入 `-999`；步骤二：假 AI 生成人物 `health:0, wealth:0, age:0`。
- 预期：限制健康到 0–100；合法零值不能被当作“未提供”。
- 实际：手动健康保存为 -999；AI 零值变成健康 90、财富 20、年龄 30，因为使用 `||` 默认值。
- 影响：人物状态和模拟依据失真；0 财富、0 健康也无法如实建立。
- 位置：[CharacterManager.tsx](../../frontend/components/CharacterManager.tsx#L216)、[CharacterCardGeneratorModal.tsx](../../frontend/components/CharacterCardGeneratorModal.tsx#L63)。

### F19 · P2 · 备份只做基本类型校验，未做语义完整性校验

- 步骤：同一备份放两个同 ID 章节，第二章状态为 `INVALID_STATUS`、章号 -10；人物位置引用不存在的地点。
- 预期：导入前拒绝重复标识、非法状态/编号和破损引用，或明确处理。
- 实际：`parseProjectBackup` 接受上述数据。
- 影响：重复章节 ID 会使选择/更新/删除同时命中多个章节；非法状态和位置进入正常界面。此类异常须由编辑 JSON 或其他上游问题触发，并非正常空白新书直接产生。
- 位置：[backupValidation.ts](../../frontend/services/backupValidation.ts#L49)、[backupValidation.ts](../../frontend/services/backupValidation.ts#L76)。

### F20 · P2 · 预设生效范围与其他工具存在未说明的差异

- 步骤：把温度保存为 0.13，开启含唯一标记的作者附注 → 请求共写建议。
- 实际：工具调用显式覆盖温度为 0.7，附注未传入；人物生成、剧情灵感、考据等也各自有温度覆盖和上下文处理。
- 影响：不能把“已保存预设”理解为每个 AI 工具都完全按相同参数和附注工作，用户仍难判断设置究竟在哪些功能生效。
- 定性：**参数差异已复现；是否允许专用工具覆盖属于产品约定待确认**。本条不表示预设无法选择，也不表示四幕流水线完全忽略设置。
- 位置：[geminiService.ts](../../frontend/services/geminiService.ts#L158)、[CharacterCardGeneratorModal.tsx](../../frontend/components/CharacterCardGeneratorModal.tsx#L52)、[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L194)。

### F21 · P2 · 正文变化不使旧摘要/评分失效

- 步骤：已定稿并提炼、张力 99 的章节 → 在纯享写作将正文完全改成另一段故事。
- 预期：旧摘要和评分应标为过期，定稿状态应有明确的变更语义。
- 实际：新正文保留旧 `extraction`、`tensionScore:99` 和 `status:final`；叙事分析继续使用旧评分。
- 影响：分析结果与作品实际内容不符；“定稿”也无法说明内容是否被修改。
- 位置：[writingWorkspace.ts](../../frontend/components/writingWorkspace.ts#L52)、[narrativeAnalytics.ts](../../frontend/components/narrativeAnalytics.ts#L6)。

### F22 · P2 · 停止流水线不等于取消当前请求

- 步骤：模式 A 开始批量任务 → 第一章请求等待时点击停止。
- 实际：只设置 `cancelled` 标记；调用参数没有 `AbortSignal`。界面已明确提示“当前请求结束后将丢弃结果”，本轮确认该行为确实如此。
- 影响：停止后当前请求仍可能继续占用模型资源/额度；离开页面也只是阻止后续提交与部分后续步骤。单章流水线没有对应请求取消入口。
- 定性：已披露的能力限制，不是“停止后仍把稿件写回”的旧问题。是否产生费用取决于真实服务，本轮未测费用。
- 位置：[NovelEditor.tsx](../../frontend/components/NovelEditor.tsx#L295)、[chapterExpansionEngine.ts](../../frontend/services/chapterExpansionEngine.ts#L18)。

### F23 · P2 · AI 考据答案与当前文献错位

- 步骤：资料甲启动考据 → 等待时切换资料乙 → 甲的请求返回。
- 预期：结果留在甲的来源下，或切换后不再显示。
- 实际：共用 `probeAnswer` 无来源绑定、无旧请求检查，资料乙页面显示“这是只属于资料甲的答案”。已完成的旧答案在切换时也不清理。
- 影响：用户可能将旧来源分析当成当前资料内容。
- 位置：[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L178)、[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L315)。

### F24 · P1 · 文献 ID 在批量导入时碰撞

- 步骤：连续解析 50 份很短的 TXT，使用真实 `Date.now()`，没有冻结时间。
- 预期：每份文献有唯一 ID。
- 实际：解析器只用 `doc_${Date.now()}`；本轮产生了重复 ID，具体唯一数以结果 JSON 的 F24 为准，受运行速度影响。
- 影响：相同 ID 文献无法可靠区分；查找总取第一条，按 ID 删除会一次移除所有撞号文献，摘录更新也可能命中多个对象。生产触发频率与文件大小/设备速度有关。
- 位置：[documentParserService.ts](../../frontend/services/documentParserService.ts#L56)、[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L100)。

### F25 · P2 · 应用内的部署指引与仓库实现不一致

- 步骤：关于编年引擎 → ARM 服务器与 Docker 部署。
- 预期：展示本仓库的 Node 服务和当前部署方式。
- 实际：仍给出 `python:3.12-slim` 后端、8000 端口、PostgreSQL 数据库的 Compose；仓库实际是 Node 后端，作品数据在浏览器存储。
- 影响：照帮助操作不能部署当前应用，也可能误以为作品已保存到服务器数据库。此问题不等于仓库实际 Dockerfile 已被测出故障。
- 位置：[AboutSystemModal.tsx](../../frontend/components/AboutSystemModal.tsx#L23)；与仓库 [compose.yaml](../../compose.yaml) / [operations.md](../operations.md) 对照。

### F26 · P2 · 世界/文风设置入口缺口与篇幅目标未接入

- 步骤：创建新书，尝试设置世界名和文学风格；另用合成数据将 `settings.chapterLengthTarget` 设为 200 后起草章节。
- 预期：可配置这些作品属性；配置目标能参与生成决策。
- 实际：新书 `worldName` 为空、文风默认“严肃文学”，作品书架仅能编辑书名/题材/简介，世界编辑器没有相关设置；生成仍要求第一幕 1000–1200 字，并以固定 4000 字阈值触发补写，200 字目标没有生效。
- 影响：需要通过备份文件才能修改部分属性，而且即便改了篇幅目标，生成流程仍不跟随。
- 位置：[projectFactory.ts](../../frontend/services/projectFactory.ts#L15)、[ProjectLibraryModal.tsx](../../frontend/components/ProjectLibraryModal.tsx#L48)、[chapterExpansionEngine.ts](../../frontend/services/chapterExpansionEngine.ts#L174)。

### F27 · P3 · “今日写作目标”实际累计且不按日重置

- 步骤：昨天累计 5000 字，下一天新增 4 字。
- 预期：今日计数为 4，或界面清楚标为累计/本会话。
- 实际：得到 5004；存储中没有日期或重置机制。删除后重写还会继续增加累计值。
- 影响：每日进度长期失真。
- 位置：[writingWorkspace.ts](../../frontend/components/writingWorkspace.ts#L65)、[AuthorDeskEditor.tsx](../../frontend/components/AuthorDeskEditor.tsx#L238)。

### F28 · P1 · AI 人物可写入不满足恢复校验的数据

- 步骤：AI 返回合法 JSON，其中 `age:"二十"`，`inventory:[{"name":"钥匙"}]` → 生成人物并保存 → 模拟启动时的作品校验。
- 预期：在接收 AI 结果时报告字段类型错误，避免保存坏数据。
- 实际：生成人物处理函数成功提交字符串年龄和对象物品；后续 `parseProjectBackup` 拒绝 `project.characters[0].age`。App 恢复流程会执行同一校验。
- 影响：看似生成成功的作品可能下次启动无法加载，需要额外的数据恢复处理。**未在用户浏览器写入坏数据或实际刷新**，已验证生成端与恢复校验的冲突。
- 位置：[CharacterCardGeneratorModal.tsx](../../frontend/components/CharacterCardGeneratorModal.tsx#L57)、[App.tsx](../../frontend/App.tsx#L70)、[backupValidation.ts](../../frontend/services/backupValidation.ts#L76)。

### F29 · P2 · 摘录内容和来源可被错配

- 步骤：在资料甲选中“甲的独有摘录” → 不保存，切换资料乙 → 点击存入卡片盒。
- 预期：保留原始出处，或切换来源时清除未保存的选区。
- 实际：旧 `highlightSelection` 被保留，但存卡片时用当前资料乙和乙章作为来源。
- 影响：产生错误引用，转换世界书和插入正文后会继续传播来源错误。
- 位置：[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L126)、[DocumentLibraryModal.tsx](../../frontend/components/DocumentLibraryModal.tsx#L315)。

### F30 · P2 · 纯享写作中的对照素材功能不完整

- 步骤：导入两章参考书 → 纯享写作打开对照素材；另选择一份 PDF。
- 预期：可在对照区选参考章节；PDF 能进入实际文件阅读。
- 实际：仅渲染 `parsedChapters[0].content`，只有文献选择器、没有章节选择器；选择 PDF 时渲染占位说明，没有 iframe/文件阅读入口。
- 影响：第二章以后的资料和 PDF 内容不能在该“对照素材”区正常参阅，需要切到独立文献库。
- 位置：[AuthorDeskEditor.tsx](../../frontend/components/AuthorDeskEditor.tsx#L252)。

## 交付和未执行事项

新增的只有本目录中的检查报告、诊断脚本和结果 JSON。没有修改 `frontend/`、`backend/`、部署配置或既有测试；没有执行修复、Git 提交/推送、发布或创建 GitHub Issue。

尚需浏览器服务恢复后补测：真实新书 → 保存 → 刷新 → 切书 → 再刷新；真实多标签页并发；点击/选区/剪贴板/下载；长文输入与滚动；弹窗焦点和移动端布局；PDF 会话结束后的恢复表现。真实 AI 连接与生成质量也仍需单独验证。不能把现有 159 项测试通过或本报告的组件层复现视为这些端到端流程全部通过。
