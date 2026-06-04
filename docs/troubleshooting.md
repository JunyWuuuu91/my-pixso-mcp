# Troubleshooting

## The Pixso plugin says "Connection error"

Most often, the local bridge is not running yet.

Check:

```bash
npm start
npm run doctor
```

Expected default endpoints:

- MCP: `http://127.0.0.1:3668/mcp`
- WS: `ws://127.0.0.1:3669/ws`

## Codex does not see the tools

Check that the `pixso_advanced` block exists in `~/.codex/config.toml`.

Helpful commands:

```bash
npx pixso-advanced-mcp install-codex-config --transport http
npx pixso-advanced-mcp install-codex-config --transport http --write
```

If you changed the config manually, restart Codex after updating it.

## The plugin connects, but nothing happens

Make sure:

- the Pixso plugin window is still open;
- a frame is selected in Pixso;
- your agent is actually calling `health` or another MCP tool;
- the local bridge process is still running.

## I updated the plugin code, but Pixso still behaves like the old version

Pixso keeps plugin code in memory.

Reload the local plugin manifest in Pixso and reopen the plugin window.

## Screenshot or export calls are unreliable

This project is optimized for structural extraction first, not screenshot-first workflows.

Recommended order:

1. `get_coding_context`
2. `get_css_context`
3. `get_export_preview`
4. `get_screenshot` only when needed

If export hangs or times out, rely on structural layout/style extraction instead of forcing more screenshot retries.

## I want automatic bridge startup via stdio

That is supported, but it is not the recommended first-run path.

See [docs/advanced-setup.md](advanced-setup.md).
