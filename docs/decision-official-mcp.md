# 决策记录：不采用 Pixso 官方 MCP

**结论：排除。** 日期 2026-09-01，环境 Pixso 桌面客户端 2.3.1。

## 官方能力其实很强

`http://127.0.0.1:3667/mcp`，实测 37 个工具，18–26ms 响应，默认返回紧凑 DSL。读取面覆盖节点结构与具体填充色、变量/样式/组件语义名、截图与导出、布局体检，还有 `eval_script` 能在画布内跑任意 Plugin API。完整清单见 [`pixso-mcp-tools.md`](pixso-mcp-tools.md)——它同时也是我们自建工具面的能力对标基线。

## 但按席位收费，这一条就足够否决

`initialize` 和 `tools/list` 永远放行，**`tools/call` 会校验"当前活跃文件所属空间 + 账号席位"**：

```
AUTHORIZATION_ERROR：当前账号在企业/团队中没有全功能/研发席位，
因此无法调用 MCP 工具。请切换至具备全功能席位或研发席位的账号，或开通后重试。
```

同一时刻、同一端点、同一套参数：个人空间的稿子返回真实数据，团队空间的稿子返回上面这句话。四个只读调用（`get_top_level_frames` × 2、`read_variables`、`get_local_styles`）无一例外。

不付费就不可能读到团队/企业空间的稿子，而**读别人共享的设计稿正是这个项目存在的理由**。所以自建插件 + 本地 MCP 是唯一可行路线。

## 顺带澄清一个早前的误判

`Cannot use this plugin in "preview" editor type` 与付费无关，是我们自己的 `manifest.json` 没声明 `preview`。Pixso 的 `editorType` 取值：`pixso`(编辑) · `preview`(预览) · `history`(历史) · `dev`(研发) · `historyDev`(历史研发) · `singleFrame`(单画板)，不写默认仅编辑。本项目已声明 `["pixso","preview","dev","singleFrame"]`，并已实测：未上架的开发插件在预览模式下正常运行并取到团队稿数据，既不需要上架审核，也不需要编辑权限。

## 其它限制（即使有席位也在）

- 只存在于桌面客户端，**网页版 Pixso 没有这个端点**。
- 只服务**当前活跃标签页**的单个文件，无法跨文件并行。
- 无上下文预算：官方自己的 `query_nodes` 描述就警告 `readDepth > 3` 会撑爆 context，裁剪责任全在调用方。
- 回环端口且**无鉴权**：任何本机进程都能读写你的设计稿（含写类工具）。

## 若将来账号升级

接入方式是标准的：`{ "type": "http", "url": "http://127.0.0.1:3667/mcp" }`，必须是 `http`/`url` 类型——它只接受 POST 的 Streamable HTTP，`GET /mcp` 返回 400，配成 `sse` 连不上。任意 `Origin` 都放行，协议版本 `2024-11-05` 与 `2025-06-18` 均可协商。可用 `node scripts/probe-mcp.mjs tools` 随时复核端点状态。
