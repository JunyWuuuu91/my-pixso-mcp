# Pixso 插件 API 简报（供 my-pixso-mcp 修复参考）

> 来源：官方文档 https://pixso.cn/developer/zh/plugin-api/api/pixso.html（抓取于 2026-09-08，supervisor 抓取并核验；本文件只写有据可查内容，未覆盖处明确标注）。
> 本地实测素材见同目录 `local-evidence.md`（researcher 汇编）。

## 1. 沙箱模型

- 插件 JS 在**受限沙箱**运行，无浏览器 API；全局变量 `pixso` 访问编辑器/节点/样式（来源：api/pixso.html 开篇）。
- UI 是 **iframe**（`pixso.showUI(__html__, opts)`），iframe 内有浏览器原生 API 能力（含 WebSocket 可用——文档未直接写 WebSocket，但明确 iframe「提供访问浏览器原生 API 的能力」）。
- `pixso.closePlugin()` 会清除所有 `setTimeout / setInterval` → **沙箱内定时器存在**，可用于事件循环让步与轮询。
- 沙箱 ↔ iframe 跨线程通信：`pixso.ui.postMessage` / `pixso.ui.onmessage`（标注「跨线程通信」Tip）。

## 2. 节点读取（对 read_nodes 最关键）

- `getNodeById(id: string): BaseNode | null`（同步查找，找不到返回 null）。
- **`findAllAsync(): Promise<SceneNode[]>`**：官方推荐的**整棵子树一次性异步遍历**（文档示例：拿全部子孙节点再按 parent.id 组装树）。官方页面「Others > getFileOpenDuration > 获取图层数量与图层列表」给出完整示例。
  → **对本插件的含义**：批量读子树应该在**插件沙箱内一次命令完成**（`findAllAsync` + 沙箱内循环读字段），而不是客户端几百次 probe_api 往返。异步返回点天然给编辑器让步机会。
- 文档未覆盖：单节点属性 getter（fills/children/width 等）的逐个性能成本、是否有内部惰性布局计算——无官方量化数据。

## 3. 消息通道约束

- `pixso.ui.postMessage` / `ui.onmessage`：文档**未标注**大小上限、丢失语义或顺序保证 → 保守假设：大 payload 可能慢/丢，命令必须「始终响应 + 可超时重试」，桥接层需心跳探测。
- 文档未覆盖：postMessage 失败时的具体行为。

## 4. 其他相关面

- `clientStorage.getAsync/setAsync/deleteAsync/keysAsync`：本地存储（预览模式配额可能受限——项目 local-evidence 有实测注记）。
- `pixso.ui.bounds/mode/enableResize` 等仅 UI 管理面。
- 节点类型文档（SceneNode 等）在 https://pixso.cn/developer/zh/plugin-api/README.html 侧边栏分列；本次抓取只确认了概述页结构，具体节点类型字段定义未逐页抓取（文档未覆盖 → read_nodes 的字段序列化按运行时实测为准，即沿用 probe_api 已验证的属性集）。

## 5. 对修复的建议（结合 1-4）

1. **read_nodes 用 `findAllAsync` 做子树批量**：一次命令读整棵子树并按 fields 投影输出（上限保护 + 每 N 节点 `await` 让步），替代客户端驱动的高频 probe_api。
2. **命令必须始终回复**：dispatch 层 try/catch 全包，失败也回结构化错误，避免桥接单 pending 槽永久等待。
3. **桥接心跳**：官方未提供存活探测 API → 用 ws ping/pong + ui.html 自动重连（重连后重发 env 握手）。
4. **沙箱内让步**：`await new Promise(r => setTimeout(r, 0))` 可用（定时器存在），批量循环中定期让步，防止单命令长占主线程。
5. 序列化：颜色按 Paint Color `{r,g,b(,a)}`（0-1 浮点）→ hex；Effect 有 `type/offset/radius/color`（沿用 probe 实测结构）；大字符串截断。
