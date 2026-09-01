# My Pixso MCP

自建 Pixso 插件 + 本地 MCP 服务：用官方 Plugin API 把设计稿取到任意标准 MCP 客户端（Qoder / pi / Codex），**不受 Pixso 席位收费限制**。

```
Pixso 插件（main.js 沙箱 + ui.html iframe）
   ⇄ ws://127.0.0.1:3679/ws
本地 MCP 服务
   ⇄ http://127.0.0.1:3678/mcp        （也支持 stdio）
Qoder / pi / Codex
```

## 为什么要自建

Pixso 桌面客户端（≥ 2.2.0）自带官方 MCP（`127.0.0.1:3667`，实测 37 工具），但 **`tools/call` 按席位校验**：企业/团队空间里非全功能/研发席位一律返回

```
AUTHORIZATION_ERROR：当前账号在企业/团队中没有全功能/研发席位，因此无法调用 MCP 工具。
```

个人空间可用，团队共享稿不可用。只要目标是别人共享的团队设计稿，插件路线就是唯一不付费的路径。完整证据、误判澄清与"将来若升级账号怎么接"见 [`docs/decision-official-mcp.md`](docs/decision-official-mcp.md)。

## 预览模式与 editorType

插件能在哪些界面里运行，由 `manifest.json` 的 `editorType` 决定。Pixso 的取值：

| 值 | 模式 |
|---|---|
| `pixso` | 编辑 |
| `preview` | 预览 |
| `history` | 历史 |
| `dev` | 研发 |
| `historyDev` | 历史研发 |
| `singleFrame` | 单画板 |

不写等于只允许编辑模式。本项目声明 `["pixso", "preview", "dev", "singleFrame"]`。

**已实测（2026-09-01）**：未上架的本地开发插件在预览模式下即可运行并读取团队空间稿子（`get_document` 25ms 返回 2 页 / 13 个顶层节点），所以**不需要走插件广场上架审核，也不需要编辑权限**。若在预览模式看到 `Cannot use this plugin in "preview" editor type`，原因是 manifest 没声明 `preview`，不是权限或付费问题。

预览模式下的只读 API 是否有额外限制（变量、样式、组件定义能否全部拿到）尚未验证，是阶段 2 第一批要探的点。

## 快速开始

```bash
npm install
npm run build     # tsc → dist/，esbuild → pixso-plugin/main.js
npm start         # MCP 3678 / 插件 WS 3679
```

在 Pixso 里：打开设计稿 → 插件 → 开发插件 → 上传 `pixso-plugin/manifest.json` → 运行。插件窗口显示已连接后（端口在首次连接成功后会被 `clientStorage` 记住，下次打开自动填好）：

```bash
curl -s http://127.0.0.1:3678/health | head -c 200
```

应看到 `"plugin":{"connected":true}`。

CLI 选项：`--transport http|stdio`、`--host`、`--mcp-port`、`--ws-port`、`--token`、`--plugin-timeout-ms`。给了 `--token` 时插件 WS 首帧必须是 `{type:"auth",token}`（不把令牌挂在 URL query 上）。

## 接入 MCP 客户端

| 客户端 | 配置 |
|---|---|
| Qoder | `~/.qoder/mcp.json` → `"pixso": { "type": "http", "url": "http://127.0.0.1:3678/mcp" }` |
| pi | `~/.pi/agent/mcp.json` 或项目 `.mcp.json`，同上（需 `pi-mcp-adapter` ≥ 2.x） |
| Codex | `codex mcp add pixso --url http://127.0.0.1:3678/mcp` |

配置片段：[`mcp/pixso.json`](mcp/pixso.json)。必须用 `http`/`url` 类型——Pixso 系端点只接受 POST 的 Streamable HTTP，配成 `sse` 连不上。

## 设计要点

- **命令级超时不断链**：插件会话超时只被标记为 stuck 并在后续调用中跳过，插件窗口不用重开。上游那种"卡住就得重开插件"的行为是本项目主要修掉的痛点。
- **多会话注册表**：同时开多个 Pixso 窗口/文件时，请求会派发给第一个空闲会话。
- **面向上下文预算的提取内核（阶段 2）**：`get_context` / `get_tokens` / `search_nodes` 单个入口、少量参数，输出按 token 预算裁剪，并把 hex 映射回变量与样式的语义名。

## 现状

- 阶段 1 完成并**在真实客户端 Pixso 2.3.1 端到端验证**：`health` + `get_document`。
- 阶段 2 待做：提取内核。
- 官方 37 工具清单与入参见 [`docs/pixso-mcp-tools.md`](docs/pixso-mcp-tools.md)；`node scripts/probe-mcp.mjs tools | call <tool> '<json>'` 可随时重探官方端点。

## 上游

fork 自 [pishikin/pixso-advanced-mcp](https://github.com/pishikin/pixso-advanced-mcp)（`upstream` remote 已配置），按其思路大幅重写：上游插件是 5191 行单文件、启发式硬编码，本项目拆成 TypeScript 模块 + esbuild 打包。
