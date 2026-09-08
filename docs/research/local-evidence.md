# my-pixso-mcp 本地实测证据（供插件 API 简报与冻结修复参考）

采集日期：2026-09-01～09-08；环境：Pixso 桌面客户端 2.3.1、manifest apiVersion 1.0.0 / api "1.0.0"。
性质说明：以下全部为**本地实测/项目文档记录**，未经官方 plugin-api 文档核对；官方文档结论由另行抓取的简报负责。

## 1. 冻结事故（修复动机）

- 批量 `probe_api` 深挖时两次冻结：`/health` 显示 `availability=stuck`、`lastSeenAt` 停更，必须**人工重载插件**才恢复。
- 初判三因：① 桥接 ws 无心跳（半开连接检测不到，stuck 状态永久化）；② ui.html 无断线重连；③ 缺少批量读命令，客户端被迫高频分块调用（每个节点一次 `probe_api`）。
- 现有缓解（对 export 路径有效，对纯读路径无效）：命令级超时只把会话标 stuck 并在后续调用跳过，不主动断链。

## 2. 预览模式（preview）沙箱实测

- 未上架本地开发插件在 preview 模式可运行并读取团队空间稿子：`get_document` 25ms 返回 2 页 / 13 个顶层节点。不需要上架审核，也不需要编辑权限。
- 节点级 `exportAsync` 实测可用：`probe_api` 报 `exportAsync: function`，真实导出过 emoji / 矢量 PNG。
- manifest `editorType` 取值（实测归纳）：`pixso`(编辑) / `preview`(预览) / `history`(历史) / `dev`(研发) / `historyDev`(历史研发) / `singleFrame`(单画板)；不写默认仅编辑。本项目声明 `["pixso","preview","dev","singleFrame"]`。
- 若见 `Cannot use this plugin in "preview" editor type`，是 manifest 未声明 preview，与权限/付费无关。
- preview 下其余只读面（变量、样式、组件定义等）是否有额外限制**未验证**。
- 事件订阅实测：Pixso 2.3.1 preview 下 `pixso.on` 存在，但订阅 `currentselectionchange` 失败；插件退化为 700ms 轮询跟随选区。

## 3. 渲染饱和（exportAsync 批量悬崖）

- 真机测量：逐节点渲染约 **780ms/个**；连续导出近百个后渲染器饱和，之后的 `exportAsync` 不再返回（挂死而非报错）。
- 冷却 25s 后同一批节点 100% 出图 → 饱和时正确动作是停批重试，不是继续戳。
- 已实现守门：单节点 8s deadline、整批 45s（低于 60s 桥超时）、连续 3 次超时熔断；跨命令早停——累计成功导出逼近阈值 90 时新命令直接把剩余 id 标 skipped（带原因），距上次导出满 30s 自动清零，守门状态随结果回传（`rendererGuard`）。

## 4. ui.html（iframe）内可用能力

- **clientStorage 实测可用**：首次连接成功后用 `clientStorage` 记住 ws 端口，下次打开插件自动填好。
- ws 长连接本身在 ui.html 可建立（`ws://127.0.0.1:3679/ws`），但无心跳/无自动重连是当前冻结主因之一。
- 消息大小/顺序/丢失边界**未测**（本地无官方文档依据）。

## 5. 与官方 MCP 的对标（能力参照，非插件 API）

- 官方桌面端 MCP（`127.0.0.1:3667`，≥2.2.0）实测 37 工具；但 `tools/call` 按席位校验，团队空间非全功能/研发席位返回 AUTHORIZATION_ERROR → 不可用，故走插件路线。
- 官方 `query_nodes` 工具描述自带警告：`readDepth > 3` 会撑爆 context，裁剪责任在调用方；入参含 `nodeIds`（批量按 id）、`patterns`、`readDepth`/`searchDepth`、`fields`（定向字段）——官方形态即"**单命令批量 + 限深 + 字段白名单**"，对 read_nodes 设计有直接参考价值。
- `eval_script` 证明官方路径同样依赖 Plugin API 在画布内执行任意脚本。
- 官方 MCP 其它限制：仅桌面端（网页版无端点）、只服务当前活跃标签页、回环无鉴权。

## 6. 本地证据回答不了、需官方文档裁决的问题

- 节点 getter（fills/children/width/characters 等）的性能成本与惰性计算语义；批量读有无官方建议。
- sandbox 内 setTimeout/Promise/让步语义；长任务是否阻塞 ui 消息处理。
- children 递归遍历的官方建议；除 exportAsync 外有无批量/一次性读 API。
- `pixso.ui.postMessage` 的消息大小限制、丢失可能性、顺序保证。
- ui.html 中 clientStorage / WebSocket 的官方约束与断线重连建议。
- preview 模式的完整沙箱限制清单。
- Paint/Effect/TypeStyle 标准字段规范（color r/g/b/a 范围、gradientStops 等）。

（以上 6 条即官方文档抓取任务的核验清单。）

## 补充实测（2026-09-08 晚，v0.2.0）
- pixso_read_nodes（≤80 节点/次）端到端验证通过：一次调用取整内容卡子树全部值，比旧 probe_api 往返降 10-30×；连续抽取 5 大分类 20+ 卡 + foundation 间距标签，窗口未再冻结（命令队列 + 心跳生效）。
- exportAsync 在渲染器饱和后**极小节点（8×8 色块）也 8s 超时**：read_nodes 大量读取会带动渲染消耗，饱和后即使单节点 export 也死。需重启 Pixso 应用彻底重置渲染器（光重载插件不重置渲染计数）。
