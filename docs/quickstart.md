# Quick Start

This is the recommended setup path for first-time users.

It uses the local **HTTP** transport because it is easier to understand and debug than `stdio`.

## 1. Clone the repository

```bash
git clone https://github.com/pishikin/pixso-advanced-mcp.git pixso-advanced-mcp
cd pixso-advanced-mcp
```

## 2. Install dependencies

```bash
npm install
```

`dist/` is already committed, so you do not need to build the project before the first run.

## 3. Start the local bridge

```bash
npm start
```

This starts:

- MCP HTTP endpoint: `http://127.0.0.1:3668/mcp`
- Pixso plugin WebSocket bridge: `ws://127.0.0.1:3669/ws`

Keep this process running while you use the plugin and your coding agent.

## 4. Install the Codex config

Preview what will be written:

```bash
npx pixso-advanced-mcp install-codex-config --transport http
```

Write the managed block to `~/.codex/config.toml`:

```bash
npx pixso-advanced-mcp install-codex-config --transport http --write
```

This command:

- creates `~/.codex/config.toml` if needed;
- writes only a managed `pixso_advanced` block;
- creates a backup when an existing file is changed.

If you prefer manual editing:

```bash
npx pixso-advanced-mcp print-codex-config --transport http
```

## 5. Upload the Pixso plugin

Get the manifest path:

```bash
npx pixso-advanced-mcp plugin-path
```

Then in Pixso:

```text
Plugins
  -> Develop Plugin / 开发插件
  -> Upload Plugin / 上传插件
  -> select pixso-plugin/manifest.json
```

Open the plugin window and keep it open.

## 6. Verify the local setup

```bash
npm run doctor
```

You should see checks for:

- Node version
- built CLI entry
- plugin manifest
- Codex config file
- `pixso_advanced` config block

## 7. Verify from your coding agent

In Codex or another MCP-capable agent:

1. Select a frame in Pixso.
2. Keep the plugin window open.
3. Call:
   - `health`
   - `get_selection_context`
   - `get_coding_context`

If that works, the setup is complete.
