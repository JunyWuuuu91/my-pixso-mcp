import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PluginSession } from '../bridge/pluginSession.js';
import type { ServerConfig } from '../types.js';
import { registerTools } from '../tools/registerTools.js';

export function createPixsoMcpServer(session: PluginSession, config: ServerConfig): McpServer {
  const server = new McpServer({
    name: 'pixso-advanced-mcp',
    version: config.version,
    websiteUrl: 'https://pixso.net/'
  });

  registerTools(server, session, config);
  return server;
}
