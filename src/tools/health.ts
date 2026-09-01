import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import type { ServerConfig } from '../types.js';
import { jsonToolResult, type McpToolResult } from '../utils/toolResult.js';

export function registerHealthTool(server: McpServer, sessions: SessionRegistry, config: ServerConfig, startedAt: number): void {
  server.registerTool(
    'health',
    {
      title: 'My Pixso MCP health',
      description:
        'Check the local MCP server and Pixso plugin connection status. Returns server info plus one entry per connected plugin window, each with its fileKey, documentName, editor type and an availability verdict; the entry marked nextPick is the window the next command will reach. Read-only.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (): Promise<McpToolResult> => {
      const status = sessions.getStatus();
      const target = status.sessions.find(entry => entry.nextPick);

      let pluginProbe: unknown = null;
      if (status.connected && !target) {
        pluginProbe = {
          ok: false,
          error: 'No Pixso plugin window is idle. Every connected window is busy or stuck; see plugin.sessions for the reason.'
        };
      } else if (target) {
        try {
          pluginProbe = await sessions.call('health', {}, 5_000);
        } catch (error) {
          pluginProbe = { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      }

      return jsonToolResult({
        ok: true,
        server: {
          name: 'my-pixso-mcp',
          version: config.version,
          transport: 'local-bridge',
          uptimeMs: Date.now() - startedAt
        },
        plugin: status,
        pluginProbe
      });
    }
  );
}
