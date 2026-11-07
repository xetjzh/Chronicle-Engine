# Chronicle Engine · 编年创作工作台

面向长篇小说的本地创作工具：写作、AI 辅助创作、世界模拟、人物档案、世界设定集、世界法则与沉浸阅读在同一工作台中协作。

界面采用统一的炭灰与暖金色，写作和阅读还提供独立纸张主题。手机可从左上角菜单访问全部模块和工具。

## 本地运行

需要 Node.js 22.18 或更新版本与 npm。建议使用当前 Node.js LTS。

```powershell
npm ci
npm run dev-frontend
```

打开终端输出的本地地址（默认 `http://localhost:5173`）。纯写作、资料管理、模拟与阅读不需要 AI 凭证；AI 润色、章节生成、摘要和因果审计需要在顶部模型设置中配置可用服务。

支持 Gemini Vertex 代理、Ollama 本地模型和 OpenAI 兼容接口。Ollama 和兼容接口必须允许浏览器所在来源访问。

## Gemini 代理

使用 Gemini Vertex 时，还需要 Google Cloud SDK 与有效的应用默认凭证：

```powershell
gcloud init
gcloud auth application-default login
```

在 `backend/.env.local` 配置以下变量：

```dotenv
API_BACKEND_PORT=5000
API_PAYLOAD_MAX_SIZE=5mb
GOOGLE_CLOUD_LOCATION=your-region
GOOGLE_CLOUD_PROJECT=your-project-id
```

运行前后端：

```powershell
npm run dev
```

Vite 开发代理默认连接后端 5000 端口；调整后端端口时，也需同步修改 `frontend/vite.config.ts`。真实模型调用可能产生服务商费用。

## 存档与备份

作品保存在当前浏览器中，完整正文使用 IndexedDB，localStorage 保留最近章节的恢复快照。顶部状态会显示正在保存、已保存或保存失败。清除浏览器站点数据会删除本地作品，请定期使用顶部“备份”导出完整 JSON；“还原”会校验文件后替换当前作品。AI 创作页也可导出整本 Markdown。

如果完整存档暂时不可读，工作台会提供重试与备份还原入口，避免用不完整的最近章节快照覆盖完整作品。AI 生成失败会显示错误；生成期间修改过原稿时，结果会保留供手动取用。

文献参考支持文本阅读、章节检索与摘录。现有 EPUB/PDF 导入仍为原型能力：EPUB 未集成完整解析器，PDF 的本地文件链接刷新后需重新导入，重要参考资料建议使用 TXT 或 Markdown。

## 验证与构建

```powershell
npm test
npm run typecheck
npm run build
```

构建产物位于 `frontend/dist`。样式由 Tailwind 在本地编译，不依赖运行时样式 CDN；图表、模型 SDK 与非首屏模块按需加载。生产使用 AI Vertex 代理时，还需将 `/api-proxy` 与 `/ws-proxy` 转发到后端。

## 工程结构

- `frontend/App.tsx`：导航、恢复存档、统一保存状态与工具入口。
- `frontend/app.css`、`frontend/tailwind.config.cjs`：共享设计变量、响应式与颜色规范。
- `frontend/components/`：写作、世界档案、阅读与通用对话框。
- `frontend/services/`：AI 提供商、模拟、持久化、备份校验与文献处理。
- `backend/server.js`：Google Cloud API 与 WebSocket 代理。

这是原型工程，真实 AI 服务、浏览器权限及生产部署应在自己的环境中验证。
