# Advanced Setup

## When to use this guide

Use this only if the default HTTP onboarding path is not what you want.

For most users, [docs/quickstart.md](quickstart.md) is the better option.

## stdio transport

`stdio` is useful when you want Codex to auto-start the local bridge process instead of running `npm start` yourself.

Print the stdio config snippet:

```bash
npx pixso-advanced-mcp print-codex-config --transport stdio
```

Write the managed stdio block:

```bash
npx pixso-advanced-mcp install-codex-config --transport stdio --write
```

## Manual Codex config management

If you do not want the CLI to modify `~/.codex/config.toml`, print the snippet and paste it manually:

```bash
npx pixso-advanced-mcp print-codex-config --transport http
npx pixso-advanced-mcp print-codex-config --transport stdio
```

Example files:

- [examples/codex-config-http.toml](../examples/codex-config-http.toml)
- [examples/codex-config-stdio.toml](../examples/codex-config-stdio.toml)

## Custom Codex config path

Preview or write to a custom path:

```bash
npx pixso-advanced-mcp install-codex-config --transport http --config /absolute/path/to/config.toml
npx pixso-advanced-mcp install-codex-config --transport http --config /absolute/path/to/config.toml --write
```

## Optional WebSocket token

If you want a stricter local setup:

```bash
PIXSO_ADVANCED_SESSION_TOKEN="some-long-random-token" npm start
```

Then enter the same token in the Pixso plugin window before connecting.

## Metrics script

The metrics helper can be useful when validating extraction quality:

```bash
npm run metrics:pixso
npm run metrics:pixso -- 94:319869 94:319871
```
