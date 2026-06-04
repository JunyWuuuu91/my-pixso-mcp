# Pixso Advanced MCP plugin

This directory contains the local Pixso plugin used by Pixso Advanced MCP.

## What it does

- reads the active Pixso file through the Pixso Plugin API;
- connects to the local MCP bridge through WebSocket;
- forwards read-only design data for extraction and UI implementation workflows.

## Files

- `manifest.json` — Pixso plugin manifest
- `main.js` — Pixso-side read-only runtime
- `ui.html` — small UI for connecting the plugin to the local bridge

## Default local bridge

```text
ws://127.0.0.1:3669/ws
```

## Important

Keep the plugin window open while your coding agent is using the MCP tools.

If you update plugin code locally, reload the plugin manifest in Pixso because Pixso keeps plugin code in memory.
