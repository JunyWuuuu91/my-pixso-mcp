# Pixso 官方本地 MCP 接入配置（个人空间适用）

Pixso 桌面客户端（≥ 2.2.0）**自带标准 MCP server**，37 个工具覆盖读结构、设计令牌、截图导出、`design_to_code`、写回设计稿，以及 `eval_script`（在画布内执行任意 Plugin API）。

**但它按席位校验。** `initialize` 与 `tools/list` 永远放行，`tools/call` 会按"当前文件所属空间 + 账号席位"检查；企业/团队空间里非全功能/研发席位拿到的是：

```
AUTHORIZATION_ERROR：当前账号在企业/团队中没有全功能/研发席位，
因此无法调用 MCP 工具。请切换至具备全功能席位或研发席位的账号，或开通后重试。
```

个人空间的文件实测可用。要读别人共享的团队稿，请走仓库主线的自建插件路线（见 [`../README.md`](../README.md)）。

## 前提

- Pixso 桌面客户端在运行，且客户端内的 MCP 开关是开的（显示"MCP 已连接"）。
- 目标设计稿在**活跃标签页**——它只服务当前文件。
- 端点：`http://127.0.0.1:3667/mcp`。
- **只支持 POST 的 Streamable HTTP**：`GET /mcp` 返回 400，所以客户端必须配成 `http`/`url` 类型，不能配成 `sse`。
- 回环端口且**无鉴权**：任何本机进程都能读写你的设计稿。不要把该端口转发或暴露到局域网。

## 配置

### Qoder

`~/.qoder/mcp.json`（或设置界面里加 HTTP 类型 MCP），改完需要重启 Qoder 或重载 MCP：

```json
{
  "mcpServers": {
    "pixso-official": { "type": "http", "url": "http://127.0.0.1:3667/mcp" }
  }
}
```

### pi

`~/.pi/agent/mcp.json`（用户全局）或项目根的 `.mcp.json`，内容同上。需要 `pi-mcp-adapter` ≥ 2.x，其 `url` 字段即 Streamable HTTP。

### Codex CLI

```bash
codex mcp add pixso-official --url http://127.0.0.1:3667/mcp
```

可直接取用的片段：[`../mcp/pixso-official.json`](../mcp/pixso-official.json)。

## 验证

```bash
node scripts/probe-mcp.mjs url    # 握手 + serverInfo
node scripts/probe-mcp.mjs tools  # 应列出 37 个工具
node scripts/probe-mcp.mjs call get_top_level_frames '{"type":"page"}'
```

若最后一条返回上面那段 `AUTHORIZATION_ERROR`，说明当前活跃文件属于没有席位的空间——换个人空间文件即可确认门禁跟着文件所属空间走。

## 能力边界（实测）

工具全清单与入参见 [`pixso-mcp-tools.md`](pixso-mcp-tools.md)。除席位门禁外，官方 MCP **不覆盖**的还有：

1. **网页版 Pixso**——浏览器里没有这个端点。
2. **跨文件并行**——一次只针对当前活跃文件。
3. **上下文预算**——官方自己的 `query_nodes` 描述里就警告 `readDepth > 3` 会撑爆 context，裁剪责任在调用方。

## 让 agent 取得准的几条

- **定位目标**：设计稿 URL 里的 `item-id` 直接当 `guid` 用；`page-id` 要先 URL 解码（`61%3A1` → `61:1`）再传给 `get_top_level_frames`。
- **先骨架后下钻**：`get_top_level_frames` → `query_nodes`（`searchDepth` 1–3、`readDepth` ≤ 3、用 `fields` 只要需要的属性）→ 确实需要完整结构时才 `get_node_dsl`。
- **要语义不要猜色值**：用 `read_variables` / `read_styles` / `read_components` 拿令牌与组件名，别让模型从 hex 反推设计意图。
- **视觉核对**：`take_screenshot` 一次最多 3 个节点，适合"实现 vs 设计稿"对比；单节点用 `get_screenshot`。
- **复杂页面防爆 context**：按子节点分次读；或用 `eval_script` 在画布内聚合后只返回摘要。
