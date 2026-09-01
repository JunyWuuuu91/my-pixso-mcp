# my-pixso-mcp

本地 MCP 桥 + Pixso 插件，让 AI agent 精准读取 Pixso 设计稿。

> 项目基于 [pishikin/pixso-advanced-mcp](https://github.com/pishikin/pixso-advanced-mcp) fork 后大幅重写。

## 架构

```
Pixso 插件（浏览器）                 本地服务（Node ≥20）                  AI Agent
┌─────────────────────┐   WS 127.0.0.1:3679   ┌─────────────────────┐  Streamable HTTP 3678 / stdio
│ main.js 沙箱(pixso API)│ ◄── postMessage ──► │ bridge：命令转发/超时 │ ◄────────────────────────► │ Qoder / Codex / pi
│ ui.html：WS 客户端+状态灯│                    │ MCP server：标准工具集│                            │（任何 MCP 客户端）
└─────────────────────┘                       └─────────────────────┘
```

开发中。文档将在各阶段补齐。
