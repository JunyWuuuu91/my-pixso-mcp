import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import type { ServerConfig } from '../types.js';
import { registerHealthTool } from '../tools/health.js';
import { registerGetDocumentTool } from '../tools/getDocument.js';

export function createPixsoMcpServer(sessions: SessionRegistry, config: ServerConfig, startedAt = Date.now()): McpServer {
  const server = new McpServer({
    name: 'my-pixso-mcp',
    version: config.version
  });

  registerHealthTool(server, sessions, config, startedAt);
  registerGetDocumentTool(server, sessions);
  return server;
}
