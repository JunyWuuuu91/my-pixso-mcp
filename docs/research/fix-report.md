# my-pixso-mcp 冻结修复报告（design-spec-audit 配套）

日期：2026-09-08 · 触发：seeky-h5 设计规范批量抽取时插件窗口反复冻结（probe_api 高频分块 → 命令无响应 → stuck 永久化，需人工重载）。

## 根因结论

1. **桥接层无心跳**：`wsServer.ts` 未做 ws ping/pong，半开 TCP 连接检测不到，session 永远留在 registry 且 stuck 后不解除。
2. **stuck 永久化**：`pluginSession.ts` 单 pending 槽超时后标 stuck，只有收到该次响应的精确 id 才解除——响应丢失/命令挂死时只能人工重载插件。
3. **插件侧无命令串行化**：`index.ts` `onmessage` 为 async 直调 dispatch，并发命令重叠执行。
4. **缺批量读命令**：probe_api 单次 ≤6 节点且字段冗余，树遍历被迫客户端高频分块（每批 2 节点 × 几百次往返），高频往返叠加渲染饱和（实测 ~780ms/节点）拖垮窗口。
5. 官方文档佐证修复方向：插件沙箱提供 **`findAllAsync()`** 整子树异步遍历（沙箱内批量）、`setTimeout` 可用于让步、iframe 有浏览器原生 API（可持 ws + 重连）。见 `pixso-plugin-api-brief.md`。

## 修改文件清单

### 桥接 / 服务端（src/）
- `src/bridge/wsServer.ts`：ws 协议心跳（5s ping，连续 2 次未响应即 close 并移出 registry）；响应插件 UI 应用级 `{type:'ping'}` 心跳。
- `src/bridge/pluginSession.ts`：stuck 自动解除——超时后心跳持续存活超过 15s 宽限期即恢复 ready（超时命令保持失败）；保留迟到精确响应解除逻辑。
- `src/server/createMcpServer.ts`：注册新工具 `pixso_read_nodes`。
- `src/tools/readNodes.ts`（新增）：MCP 工具封装。

### 插件侧（pixso-plugin/）
- `plugin-src/utils/commandQueue.ts`（新增）：命令串行队列，逐条执行杜绝并发重叠。
- `plugin-src/index.ts`：dispatch 入队 + `safePostMessage`（postMessage 失败不吞响应）。
- `plugin-src/utils/serialize.ts`（新增）：颜色 `#RRGGBB(AA)` / 渐变 stops / 阴影 `{type,offset,radius,color}` / 圆角 / 内边距紧凑序列化。
- `plugin-src/commands/readNodes.ts`（新增）：批量读命令，单次 ≤80 节点、字段投影、单节点异常不拖垮整批、每 16 节点 `await` 让步事件循环。
- `ui.html`：客户端 5s ping 心跳（保活 + 死链探测触发重连）。

### 测试 / 构建
- `test/readNodes.test.ts`（新增，序列化 + 队列 10 用例）
- `test/stuckRecovery.test.ts`（新增，stuck 自动解除 4 用例）
- `test/httpServer.test.ts`：工具清单补 `read_nodes`。
- 验证：`npm run check` → typecheck 0 错误、**72/72 测试通过**；`npm run build` → `pixso-plugin/main.js`（含 read_nodes）+ dist 已重新生成。

## 新工具使用约定（替代高频 probe_api）

- 树遍历优先 `pixso_read_nodes({ ids, fields?, childSummary? })`：单次 ≤80 节点一次往返，返回紧凑值（hex 色、圆角、阴影、字号字重、文本、padding、直接子节点摘要）。
- probe_api 仅用于探测 API 能力面（surfaces）或极少量（<6）节点的方法映射。
- 后续 seeky-h5 抽取：每内容卡用 read_nodes 一次拉子树，配合官方 `findAllAsync` 语义，单卡 1–2 次调用即可。

## 重载与验证

- 插件窗口需在 Pixso 里关闭后重新运行（加载新 main.js 才有 read_nodes + 命令队列 + 心跳）。
- 重载后验证：health ready；`pixso_read_nodes` 对一内容卡子树批量取值正常返回；长时间批量不再 stuck（若真超时，15s 内心跳存活即自动恢复，无需重载）。

注：未 git commit（等使用方验证后由维护者提交）。
