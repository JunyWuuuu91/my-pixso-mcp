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

预览模式下**节点级 `exportAsync` 已实测可用**（2026-09-01，Pixso 2.3.1 / apiVersion 2.0.0，`probe_api` 报 `exportAsync: function`，并真实导出过 emoji/矢量 PNG）。变量、样式、组件定义等其余只读面是否有额外限制仍未验证，是阶段 2 第一批要探的点。

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

- **命令级超时不断链**：插件会话超时只被标记为 stuck 并在后续调用中跳过，插件窗口不用重开。上游那种"卡住就得重开插件"的行为是本项目主要修掉的痛点。批量导出还在插件侧自带预算：单节点 `exportAsync` 8s deadline、整批 45s 上限（低于 60s 桥超时）、连续 3 次超时立即熔断，超时的节点变成带重跑提示的 `skipped`。依据是真机实测：Pixso 逐节点渲染约 780ms/个，连续导出近百个后渲染器饱和、之后的 `exportAsync` 再不返回，冷却 25s 同一批节点 100% 出图——所以饱和时正确动作是停批并重试，不是继续戳。
- **多会话路由**：同时开多个 Pixso 窗口时，命令优先派发给上报过运行环境（`version` / `editorType` / `fileKey`）且最近活跃的会话；旧 bundle 或未打开文件的会话只作兜底，并在 `/health` 与 `health` 工具里标成 `unknown-build`，`nextPick` 指出下一条命令会落到哪个窗口。`get_document` / `probe_api` / `find_decorative_nodes` / `export_nodes_png` / `get_selection` 的 `file` 参数（fileKey 或文件名，可部分匹配）可把调用钉在某个文件上，匹配不到时报错并列出全部窗口，不会退到别的文件。
- **面向上下文预算的提取内核（阶段 2）**：`get_context` / `get_tokens` / `search_nodes` 单个入口、少量参数，输出按 token 预算裁剪，并把 hex 映射回变量与样式的语义名。

## 现状

- 阶段 1 完成并**在真实客户端 Pixso 2.3.1 端到端验证**：`health` + `get_document`。
- **装饰元素批量导出**已同样实测闭环：`find_decorative_nodes` 按页面扫出 emoji 文本 / `svg` 图标容器 / 已标记导出项候选并给出倍数建议（中位数边长 → 目标 128px），用户拍板后 `export_nodes_png` 用节点级 `exportAsync` 渲染，PNG 由服务端落盘到 `pixso-exports/<页面名>/`，只回传路径（base64 不进 MCP 文本）。真机测量确认 SVG 图标是名为 `svg` 的 FRAME 容器，里面的矢量只是局部路径（一个火苗两条 path），所以扫描按容器名捞容器而不是捞碎片。扫描结果按「类型 + 名字 + 尺寸 + 命中原因」分组（`groups`，含 `count` 和全部 `ids`），一页几百个重复图标也只占几组，`maxCandidates` 默认因此抬到 500（上限 2000）。
- **选区回显与定向**：面板「当前选区」卡片实时显示用户点选节点的 id / 类型 / 尺寸 / 祖先路径，可一键复制成给 AI 的上下文清单；MCP 侧 `get_selection` 读同一批节点，用户只需说「我选中的这个」。真机测得 Pixso 2.3.1 preview 下 `pixso.on` 存在但订阅 `currentselectionchange` 失败，插件按 700ms 轮询跟随，面板 badge 显示实际模式（`轮询跟随`）。
- 阶段 2 待做：提取内核。
- 官方 37 工具清单与入参见 [`docs/pixso-mcp-tools.md`](docs/pixso-mcp-tools.md)；`node scripts/probe-mcp.mjs tools | call <tool> '<json>'` 可随时重探官方端点。

## 上游

fork 自 [pishikin/pixso-advanced-mcp](https://github.com/pishikin/pixso-advanced-mcp)（`upstream` remote 已配置），按其思路大幅重写：上游插件是 5191 行单文件、启发式硬编码，本项目拆成 TypeScript 模块 + esbuild 打包。
