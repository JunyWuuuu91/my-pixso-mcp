# Pixso 官方 MCP 接入配置（pi / Qoder / Codex）

不需要自建插件，也不需要自建本地 MCP 服务。Pixso 桌面客户端（≥ 2.2.0）**自带标准 MCP server**，37 个工具覆盖读结构、设计令牌、截图导出、`design_to_code`、写回设计稿，以及 `eval_script`（在画布内执行任意 Plugin API）。

本仓库曾按"插件 + WS 桥 + 本地 MCP"路线做到阶段 1（已在真实客户端 2.3.1 跑通），实测确认官方 MCP 覆盖了该路线的核心价值，故全部回退。被删代码保留在 tag **`archive-pixso-plugin-bridge`**。

## 前提

- Pixso 桌面客户端在运行，且客户端内的 MCP 开关是开的（显示"MCP 已连接"）。
- 目标设计稿在**活跃标签页**——它只服务当前文件。
- 端点：`http://127.0.0.1:3667/mcp`。
- **只支持 POST 的 Streamable HTTP**：`GET /mcp` 返回 400，所以客户端必须配成 `http`/`url` 类型，不能配成 `sse`。
- 回环端口且**无鉴权**：任何本机进程都能读写你的设计稿。不要把该端口转发或暴露到局域网，也不要在不受信任的文件中开启写类工具。

## 配置

### Qoder

`~/.qoder/mcp.json`（或设置界面里加 HTTP 类型 MCP），改完需要重启 Qoder 或重载 MCP：

```json
{
  "mcpServers": {
    "pixso": { "type": "http", "url": "http://127.0.0.1:3667/mcp" }
  }
}
```

### pi

`~/.pi/agent/mcp.json`（用户全局）或项目根的 `.mcp.json`，内容同上。需要 `pi-mcp-adapter` ≥ 2.x，其 `url` 字段即 Streamable HTTP。

### Codex CLI

```bash
codex mcp add pixso --url http://127.0.0.1:3667/mcp
```

可直接取用的片段：[`mcp/pixso.json`](mcp/pixso.json)。

## 验证

```bash
node scripts/probe-mcp.mjs url    # 握手 + serverInfo
node scripts/probe-mcp.mjs tools  # 应列出 37 个工具
node scripts/probe-mcp.mjs call get_top_level_frames '{"type":"page"}'
```

在 agent 里：`用 pixso 的 get_top_level_frames 列出当前文件的所有页面`。

## 能力边界（实测）

工具全清单与入参见 [`docs/pixso-mcp-tools.md`](docs/pixso-mcp-tools.md)。官方 MCP **不覆盖**的只有三件事：

1. **网页版 Pixso**——浏览器里没有这个端点。
2. **跨文件并行**——一次只针对当前活跃文件。
3. **上下文预算**——官方自己的 `query_nodes` 描述里就警告 `readDepth > 3` 会撑爆 context，需要调用方（也就是 agent 或提示词）负责裁剪。

## 让 agent 取得准的几条

- **定位目标**：设计稿 URL 里的 `item-id` 直接当 `guid` 用；`page-id` 要先 URL 解码（`61%3A1` → `61:1`）再传给 `get_top_level_frames`。
- **先骨架后下钻**：`get_top_level_frames` → `query_nodes`（`searchDepth` 1–3、`readDepth` ≤ 3、用 `fields` 只要需要的属性）→ 确实需要完整结构时才 `get_node_dsl`。
- **要语义不要猜色值**：用 `read_variables` / `read_styles` / `read_components` 拿到令牌与组件名，别让模型从 hex 反推设计意图。
- **视觉核对**：`take_screenshot` 一次最多 3 个节点，适合"实现 vs 设计稿"对比；单节点用 `get_screenshot`。
- **复杂页面防爆 context**：按子节点分次读；或直接用 `eval_script` 在画布内做聚合，只把摘要返回给模型——这相当于自建提取内核，但不需要任何插件。
