# 部署与运维

应用由一个 Node 进程提供前端静态文件和可选的 Vertex HTTP / WebSocket 代理。作品保存在用户浏览器中；服务端没有中心作品数据库、组织账号、RBAC 或审计留存。部署共享入口不会自动实现多人协作或跨设备同步。

## 首次启动

在仓库根目录使用 Docker 与 Compose：

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 -f chronicle
```

打开 `http://127.0.0.1:8080`。Compose 的 `chronicle` 服务将宿主机 `127.0.0.1:8080` 转发到容器 5000 端口，默认镜像为 `chronicle-engine:local`。镜像使用非 root 用户；Compose 使用只读根文件系统、临时 `/tmp` 和受限权限。默认关闭 Vertex 代理，无需云凭证。

需要改变标签、端口或基础镜像时，将根目录 [.env.example](../.env.example) 复制为 `.env`，编辑其中的 `IMAGE_TAG`、`CHRONICLE_PORT` 与 `NODE_IMAGE`。这里的 `.env` 用于 Compose 插值，不是后端环境文件；不要把云凭证写入其中。镜像构建排除本地环境文件与凭证，容器不会自动读取宿主机 `backend/.env.local`。

没有 Docker 时，需要 Node.js 22.18+ 与 npm 10+。在 PowerShell 中：

```powershell
npm ci
npm run build
$env:SERVE_FRONTEND = 'true'
$env:AI_PROXY_ENABLED = 'false'
npm start
```

访问 `http://127.0.0.1:5000`。`npm start` 从后端工作区启动，并可读取 `backend/.env.local`；终端中显式设置的变量优先于该文件。开发模式使用 `npm run dev-frontend` 或 `npm run dev`，Vite 默认端口 5173，代理目标为后端 5000。

## 运行配置

后端本地示例见 [backend/.env.example](../backend/.env.example)。布尔值使用 `true` 或 `false`，不要使用空值或 `0` / `1`。容器运行时通过部署配置注入变量和凭证，不要修改镜像内的文件。

| 变量 | 本地默认值 | 用途与约束 |
| --- | --- | --- |
| `AI_PROXY_ENABLED` | `false` | 显式开启 Vertex 代理；关闭时仍可写作和使用浏览器直连的其他 AI 服务。 |
| `SERVE_FRONTEND` | `false` | 从 `frontend/dist` 提供前端；镜像及 Compose 设置为 `true`，开启前须先构建。 |
| `API_BACKEND_HOST` | `127.0.0.1` | 监听地址。容器内部使用 `0.0.0.0`，Compose 在宿主机仍仅绑定回环地址。 |
| `API_BACKEND_PORT` | `5000` | Node 监听端口。更改本地开发端口时同步修改 Vite 代理。 |
| `API_PAYLOAD_MAX_SIZE` | `7mb` | 正数与 `b`、`kb` 或 `mb` 单位，最大 `50mb`。 |
| `API_TIMEOUT_MS` | `120000` | 上游请求时限，范围 `100`–`600000` 毫秒。 |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | 停机排空时限，范围 `100`–`60000` 毫秒；外部终止宽限需更长。Compose 默认 15 秒。 |
| `TRUST_PROXY` | `false` | 可设为逗号分隔的明确代理 IP / CIDR；不接受 `true` 或跳数。只信任实际受控网关。 |
| `GOOGLE_CLOUD_PROJECT` | 无 | 开启 Vertex 时必填，使用有效项目 ID 或项目编号。 |
| `GOOGLE_CLOUD_LOCATION` | 无 | 开启 Vertex 时必填，使用实际模型支持的区域或 `global`。 |
| `API_ALLOWED_ORIGINS` | 无 | 开启 Vertex 时必填，逗号分隔的精确 HTTP(S) 来源，如 `http://localhost:5173`；不接受通配符、路径、查询或用户信息。 |
| `PROXY_HEADER` | 与前端 shim 一致的公开标记 | HTTP 请求识别标记。通常保留默认值；自定义时须同步前端 shim，不能为空或包含非法头字符。不是认证凭证。 |
| `GOOGLE_APPLICATION_CREDENTIALS` | 未设置 | 可选的 Google 凭证文件路径，由认证库使用；开启代理时也可使用部署环境支持的应用默认凭证。 |

错误配置会在启动时被拒绝。精确来源包含协议、主机和端口：`http://localhost:5173` 与 `http://127.0.0.1:5173` 是不同来源。Vertex HTTP 与 WebSocket 都要求提供与允许列表匹配的 `Origin`，无来源的脚本请求也会被拒绝。

## 按需启用 Vertex

本地开发先复制 `backend/.env.example` 为 `backend/.env.local`，再编辑配置：

```dotenv
AI_PROXY_ENABLED=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=your-region
API_ALLOWED_ORIGINS=http://localhost:5173
```

通过 Google Cloud SDK 执行 `gcloud auth application-default login`，再运行 `npm run dev`。如果沿用前面的 PowerShell 终端，先执行 `Remove-Item -LiteralPath Env:AI_PROXY_ENABLED, Env:SERVE_FRONTEND -ErrorAction SilentlyContinue`，清除临时启动开关，让文件配置生效。将来源改为浏览器实际访问的地址；通过 Node 静态入口访问时，也要允许相应的 5000 端口来源。模型设置中的 Gemini 模式使用这一代理。

基础 Compose 明确设置 `AI_PROXY_ENABLED=false`；修改宿主机环境文件不会覆盖它。容器部署启用代理时，需在经过审阅的 Compose 覆盖文件或组织部署清单中同时设置 `AI_PROXY_ENABLED=true`、项目、区域、允许来源与凭证注入。保留容器监听地址 `0.0.0.0` 和静态入口开关。文件式凭证应只读挂载，并将容器内路径设置为 `GOOGLE_APPLICATION_CREDENTIALS`；确认非 root 运行用户可读。宿主机 ADC 不会自动进入容器，也不要将凭证写入镜像或 Git。实际授权的模型测试可能产生费用，应由部署方单独执行。

Ollama 与 OpenAI 兼容接口由浏览器直接访问。模型设置中的 `localhost` 指用户的设备，不是部署服务器或容器；从 HTTPS 页面连接 HTTP 服务还可能受到浏览器混合内容策略限制。配置可达地址、允许来源与适当的服务认证。

## TLS 与身份入口

提供给其他用户前，在应用前部署组织的 TLS 与身份认证网关，统一保护前端、`/api-proxy` 和 `/ws-proxy`。网关需支持 WebSocket 升级和流式响应，避免缓冲导致生成结果长时间不出现，并设置与应用相容的超时。

保持 Node 端口仅对网关可达，不直接将容器 5000 端口暴露到公网。默认回环绑定适合同机网关；独立网关需要受控网络与明确的防火墙规则。只有确需使用转发头时，才将 `TRUST_PROXY` 设置为受控代理的明确 IP / CIDR，避免信任任意客户端伪造的地址。

`PROXY_HEADER` 随前端公开，来源校验和限流不提供组织身份认证。应用也不会把网关身份映射为账号、角色或每用户配额。部署验收需分别验证未登录的页面、HTTP 代理和 WebSocket 请求都被网关拒绝，以及已登录请求和流式连接能够正常通过。

## 健康检查与日志

| 入口 | 含义 | 不检查的内容 |
| --- | --- | --- |
| `GET /healthz` | 进程可响应。 | 云授权、模型可用性和浏览器作品。 |
| `GET /readyz` | 配置有效且服务未进入排空，包含 AI 代理是否启用。排空时返回非就绪。 | ADC、模型权限、供应商连通性和网关身份策略。 |

镜像健康检查请求 `/readyz`。在已启动的默认 Compose 部署上运行无需 AI 的 smoke：

```sh
npm run smoke -- http://127.0.0.1:8080
```

本地 Node 入口改用 `http://127.0.0.1:5000`。smoke 检查健康状态、入口、脚本与样式、缓存和未知路径边界；代理关闭时确认其返回 503。它不会请求模型，且不处理身份网关登录跳转，应先从受控本机入口运行，再单独检查网关行为。

验证默认无云交付时可附加 `--expect-ai-disabled`，强制检查代理确实关闭；CI 的容器验收使用此选项。有意启用代理的环境使用上面的通用命令。

查看运行日志：

```sh
docker compose logs --since=15m --tail=200 chronicle
```

Compose 默认轮转日志，每份最大 10 MB，保留 3 份。日志用于运行排障，不是业务审计记录。不要为排障开启正文、密钥、令牌或认证头的打印；分享日志前仍需人工脱敏。收集故障时间、提交/镜像标识、路径、状态码与请求关联信息即可。

正常停止使用 `docker compose stop` 或向 Node 发送 SIGTERM。应用进入排空并在配置时限内关闭连接；正在生成的内容可能需要重试。调整排空时限时，同步增加 Compose 或编排器的停止宽限，避免提前强制终止。

## 作品与配置备份

容器没有作品数据卷。每个浏览器按来源保存 IndexedDB 正文和 localStorage 恢复快照，备份镜像、服务器目录或容器文件系统均不能备份这些作品。

1. 在原浏览器使用顶部“备份”导出完整项目 JSON，核对章节数量并妥善保存。Markdown 可供阅读，不代替完整 JSON。
2. 将 JSON 当作敏感资料：其中包含 AI 设置，可能有 API 密钥、自定义认证头与私人正文。按组织策略加密、限制访问并控制留存；不要附到公开 Issue。
3. 更换设备、浏览器、协议、域名或端口前先导出。在新来源中“还原”，检查章节正文、人物、设定和模型设置后，再清理旧环境。还原会替换当前项目，先备份目标浏览器中的现有项目。
4. 对重要作品定期演练导入，保留升级前备份。不要清除站点数据来排查保存失败；先尝试应用提供的重试与完整备份恢复。

部署配置、网关策略和运行凭证应另行安全备份。环境文件不会进入构建镜像，恢复镜像后仍需重新注入配置。发生凭证泄漏时应在供应商撤销或轮换，不能只删除备份文件。

## 构建、升级与回滚

每次交付记录源码提交、Node/npm 版本、依赖锁文件、基础镜像引用、应用镜像 ID、可用的仓库摘要、配置版本和验证结果。仓库标签可以被改写，发布时应使用独立版本标签并保留原镜像；跨机器分发优先使用镜像仓库的 `@sha256:` 摘要。

1. 在干净检出中执行 `npm ci` 与 `npm run check`。CI 覆盖前后端检查、Node 版本矩阵及容器 HTTP smoke，但真实网关、凭证和模型仍需部署方验证。
2. 让使用者导出升级前项目 JSON，保存当前部署配置和可运行镜像。在覆盖默认本地标签前，可给旧镜像加一个保留标签：

   ```sh
   docker tag chronicle-engine:local chronicle-engine:rollback-before-upgrade
   ```

   该命令适用于当前确实使用 `local` 的部署；使用版本标签时直接保留该标签，并在记录中写下准确引用。

3. 在 `.env` 中设置新的 `IMAGE_TAG`，例如 `release-20261107-<commit>`，不要复用已交付标签。生产构建可将 `NODE_IMAGE` 设置为经过组织审核的 `node:24-bookworm-slim@sha256:<digest>`，锁定两个构建阶段的基础镜像。示例占位符须换成实际摘要，基础镜像安全更新也要经过重新构建和验证。
4. 构建并检查实际镜像标识，将占位符替换为刚设置的标签：

   ```sh
   docker compose build
   docker image inspect chronicle-engine:<tag> --format '{{.Id}} {{json .RepoDigests}}'
   docker compose up -d --no-build --pull never
   docker compose ps
   npm run smoke -- http://127.0.0.1:8080
   ```

   本地构建的 `RepoDigests` 可能为空；`.Id` 是本地镜像 ID，不应冒充镜像仓库清单摘要。若组织另行推送至镜像仓库，记录其返回的清单摘要，并在部署覆盖清单中将 `image` 设为 `registry/path@sha256:<digest>`。当前 Compose 的 `IMAGE_TAG` 只表示冒号后的标签，不能直接填入完整摘要引用；仓库不会自动发布镜像。
5. 检查日志与真实写作、保存、导出操作；启用 AI 的环境另验授权的模型与网关。确认后保留上一版镜像和升级前 JSON，按组织留存策略清理更早版本。

回滚时，将 `.env` 的 `IMAGE_TAG` 改回准确的旧标签，例如 `rollback-before-upgrade`，并恢复相应的运行配置，再执行：

```sh
docker compose up -d --no-build --pull never
docker compose ps
npm run smoke -- http://127.0.0.1:8080
```

不要在回滚命令中重建旧标签，也不要提前清理保留镜像。镜像回滚不会回滚用户浏览器中的作品；如果版本修改了存档格式，应先确认旧版本兼容性，必要时在保存当前项目副本后恢复升级前 JSON。自动化目前没有数据库迁移或浏览器存档降级流程。

## 故障处理

| 现象 | 优先检查 |
| --- | --- |
| 容器退出或启动失败 | 查看脱敏启动日志；检查必填变量、合法范围和 `frontend/dist` 是否已构建。不要先打印完整环境。 |
| 页面 404，本地 Node 启动正常 | 确认执行过构建并设置 `SERVE_FRONTEND=true`；开发 Vite 与生产 Node 的入口不同。 |
| `/readyz` 非 200 | 检查是否正在停止或重启；探针不会修复云权限。 |
| `/api-proxy` 返回 503 | 代理默认关闭；确认部署配置是否有意启用，基础 Compose 的显式值会覆盖环境文件。 |
| HTTP / WebSocket 被拒绝 | 检查网关会话、精确 `Origin`、HTTP shim 标记与路径升级转发；不要通过放开所有来源来排障。 |
| 429、上游超时或模型错误 | 检查限流、供应商额度、ADC、项目区域、模型权限、网络与网关超时。健康检查成功不表示这些条件满足。 |
| 作品看似消失或保存失败 | 核对浏览器资料及协议/域名/端口，尝试应用恢复入口。保留旧站点数据，先导出能够读取的完整备份。 |

安全事件按 [SECURITY.md](../SECURITY.md) 处理。不要将本指南中的运行控制描述为账号隔离、合规认证或安全 SLA；这些能力需要组织独立设计与验收。
