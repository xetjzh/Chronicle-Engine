# 功能审计修复计划

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Each group uses failing regression tests before implementation.

**Goal:** 按功能报告 F01–F30 修复已复现的问题，保留原稿和兼容旧存档，并如实记录验证边界。

**Architecture:** 沿用 React/TypeScript/Vite 和 Node 后端；用已有服务和小型共享函数处理校验、引用完整性、生成上下文与取消。保留原审计报告/结果作为修复前证据，新增回归测试及修复状态记录。

**Tech Stack:** React 19、TypeScript、Node test runner、现有 TSX 挂载测试工具、浏览器原生文件/解压 API。

**Spec:** `docs/qa/functional-audit-2026-11-08.md` 中各项预期行为；用户已要求逐项尝试修复。

## Constraints and review focus

- 不改用户原稿，不调用付费模型，不将连接密钥写入日志；存储/备份保持可恢复。
- 并发结果只能合并到最新同书状态；关闭或跨书时取消/丢弃旧任务。
- 导入数据先验证再保存；旧存档缺少新增字段仍可恢复，旧 PDF 无字节时明确重新关联。
- 引用删除、快照回滚、未知死亡时间和多角色调度需覆盖边界案例。
- 浏览器连接不可用时不宣称真实端到端验证通过。

## Sequential tasks

- [x] 1. F05/F21/F27：续写保留选区；正文变更使分析失效；日期重置写作计数。修改 writingWorkspace、AuthorDeskEditor，先写对应回归。
- [x] 2. F01/F02/F03/F04/F07/F18/F28：人物地点/势力选择，中性默认值，势力管理，地点引用保护；AI人物字段验证、取消与最新回调。修改 CharacterManager、WorldEditor、CharacterCardGeneratorModal，补组件及数据测试。
- [x] 3. F06/F23/F29/F30：资料导入合并最新作品、取消和来源绑定；选区/考据切换清理；对照章节与 PDF 阅读。修改 DocumentLibraryModal、AuthorDeskEditor，补延迟返回和来源测试。
- [x] 4. F08/F09/F10/F24：唯一文献ID、TXT/MD章节解析、ZIP/EPUB阅读顺序解析、PDF持久文件字节和URL生命周期。先以真实压缩夹具/序列化还原测试失败，再实现解析和展示。
- [x] 5. F11/F12/F13/F14/F20/F22/F26：真实失败、结构化提案校验、前文/摘要/认知上下文、统一采样附注、全链路取消、可配置篇幅和作品属性。先测试输入输出、取消及参数传递，再改生成服务和UI。
- [x] 6. F15/F16/F17/F19：死亡时序审计、完整世界快照与引用、轮转全部角色、导入语义校验及兼容诊断。补服务测试，再实现。
- [x] 7. F25：替换应用内过期部署帮助，统一至实际Node/浏览器存储方案。
- [x] 8. 更新 F01–F30 状态与回归证据；完整 check、HTTP smoke、独立代码复核；保留真实AI/浏览器未验证说明。

Each task: write regression -> run and confirm relevant failure -> implement -> run targeted tests -> record outcome. Commit/upload only after final validation and within the user's existing authorization.

## Completion evidence (2026-11-09)

- npm run check: 168 frontend + 19 backend + 4 delivery = 191 passing; typecheck/build passed.
- Real Node HTTP smoke passed; diff whitespace check passed.
- Independent review: 2 Important + 1 context omission, each corrected with regression evidence.
- Status and limits: docs/qa/remediation-2026-11-09.md. Browser E2E and real AI remain pending.
