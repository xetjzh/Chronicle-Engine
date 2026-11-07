# Chronicle Engine · 编年创作工作台

面向长篇小说的本地创作工具：写作、AI 辅助创作、世界模拟、人物档案、世界设定集、世界法则与沉浸阅读在同一工作台中协作。

界面采用统一的炭灰与暖金色，写作和阅读还提供独立纸张主题。手机可从左上角菜单访问全部模块和工具。

## 快速运行

开发环境需要 Node.js 22.18 或更新版本与 npm 10 或更新版本。在仓库根目录运行：

```powershell
npm ci
npm run dev-frontend
```

打开终端输出的本地地址（默认 `http://localhost:5173`）。纯写作、资料管理、模拟与阅读不需要云凭证；AI 润色、章节生成、摘要和因果审计需要在顶部模型设置中配置可用服务。

安装好 Docker 与 Compose 后，也可以直接构建并启动完整应用：

```sh
docker compose up --build -d
docker compose logs --tail=100 -f
```

访问 `http://127.0.0.1:8080`。镜像内的单个 Node 进程提供前端和可选的 Vertex 代理，默认关闭代理，无需 Google Cloud 凭证。Compose 将端口绑定到宿主机回环地址；默认镜像标签为 `chronicle-engine:local`。端口与标签可通过根目录 [.env.example](.env.example) 配置。

已有 Node 环境也可运行构建后的应用：

```powershell
npm ci
npm run build
$env:SERVE_FRONTEND = 'true'
$env:AI_PROXY_ENABLED = 'false'
npm start
```

访问 `http://127.0.0.1:5000`。这两个环境变量优先于已有的 `backend/.env.local`，用于明确启用静态入口并关闭云代理；关闭终端后不再保留。运行参数、健康检查、TLS 与认证入口、升级及回滚见 [部署与运维](docs/operations.md)。

## AI 服务

支持 Gemini Vertex 代理、Ollama 本地模型和 OpenAI 兼容接口。Ollama 和兼容接口由浏览器直接访问，服务必须允许应用来源的跨域请求，并能从用户设备访问。

在“AI 写作设置”选择并保存调优预设后，卡片会显示当前选择；手动修改采样或作者附注会标为自定义。预设保留已填写的服务地址、密钥和模型名称，Gemini 也可填写实际使用的模型。

连接测试可取消，修改配置后会清除旧测试结果。测试最多等待 20 秒；Gemini 和兼容接口会执行一条短生成请求，可能计费，Ollama 只检查服务与所选模型是否已安装。空回复不再显示连通成功；错误会给出认证、地址、额度、超时或跨域排查提示，避免显示密钥和供应商原始错误。纯享写作中的 AI 润色与续写支持“停止生成”。

本地启用 Vertex 代理时，将 [backend/.env.example](backend/.env.example) 复制为 `backend/.env.local`，设置 `AI_PROXY_ENABLED=true`、Google Cloud 项目、区域和允许来源，保留与前端 shim 一致的 `PROXY_HEADER` 标记。使用 Google Cloud SDK 配置应用默认凭证后运行前后端：

```powershell
Copy-Item backend/.env.example backend/.env.local
gcloud auth application-default login
# 编辑 backend/.env.local，再启动
Remove-Item -LiteralPath Env:AI_PROXY_ENABLED, Env:SERVE_FRONTEND -ErrorAction SilentlyContinue
npm run dev
```

Vite 开发代理默认连接后端 5000 端口；调整后端端口时也需同步修改 `frontend/vite.config.ts`。`PROXY_HEADER` 是前端公开标记，不提供用户认证。服务器部署必须通过组织的 TLS 与身份认证网关保护应用、`/api-proxy` 和 `/ws-proxy`，并限制来源。实际模型调用会向所选服务发送相关内容，并可能产生费用。

## 存档与备份

作品保存在当前浏览器、当前站点来源中，完整正文使用 IndexedDB，localStorage 保留最近章节的恢复快照。服务端不保存中心作品数据库，容器备份也不会包含浏览器中的作品。更换协议、域名、端口、浏览器或设备后，需要导入备份才能迁移作品。

顶部状态会显示正在保存、已保存或保存失败。清除浏览器站点数据会删除本地作品，请定期使用顶部“备份”导出完整 JSON；“还原”会校验文件后替换当前作品。JSON 包含项目 AI 设置，可能带有 API 密钥和自定义认证头，应作为敏感文件保存，分享前先脱敏。AI 创作页也可导出整本 Markdown，但它不替代完整 JSON 备份。

纯享写作的章节目录提供删除按钮，确认后删除章节及正文；取消不会修改作品。删除当前章节后会打开相邻章节，删完最后一章可重新新建。删除无法撤销，重要正文请先导出备份。

如果完整存档暂时不可读，工作台会提供重试与备份还原入口，避免用不完整的最近章节快照覆盖完整作品。AI 生成失败会显示错误；生成期间修改过原稿时，结果会保留供手动取用。

文献参考支持文本阅读、章节检索与摘录。现有 EPUB/PDF 导入仍为原型能力：EPUB 未集成完整解析器，PDF 的本地文件链接刷新后需重新导入，重要参考资料建议使用 TXT 或 Markdown。

## 验证与构建

```powershell
npm run check
# 对已启动的 Compose 应用执行不调用 AI 的 HTTP 检查
npm run smoke -- http://127.0.0.1:8080
```

`check` 覆盖本地配置跟踪检查、前后端测试、类型检查与构建。构建产物位于 `frontend/dist`。样式由 Tailwind 在本地编译；图表、模型 SDK 与非首屏模块按需加载。`/healthz` 只表示进程存活，`/readyz` 表示配置有效且未进入停机排空；两者都不验证云凭证或真实模型可用性。

## 工程结构

- `frontend/App.tsx`：导航、恢复存档、统一保存状态与工具入口。
- `frontend/app.css`、`frontend/tailwind.config.cjs`：共享设计变量、响应式与颜色规范。
- `frontend/components/`：写作、世界档案、阅读与通用对话框。
- `frontend/services/`：AI 提供商、模拟、持久化、备份校验与文献处理。
- `backend/server.js`：Google Cloud API 与 WebSocket 代理。
- `Dockerfile`、`compose.yaml`：单容器构建和本地部署。
- [CONTRIBUTING.md](CONTRIBUTING.md)：开发与贡献流程。
- [SECURITY.md](SECURITY.md)：安全边界和漏洞报告方式。
- [docs/operations.md](docs/operations.md)：运行配置、备份与交付流程。

这是原型工程，尚未提供组织账号、多人协作、RBAC 或中心审计留存。部署方需要自行验证真实 AI 服务、浏览器权限、网关认证和容器运行环境。仓库尚未提供项目级许可证；许可证及授权范围由权利人确认。已有第三方版权和 SPDX 标记应保留，详见 [贡献说明](CONTRIBUTING.md)。
