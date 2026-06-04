import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PluginSession } from '../bridge/pluginSession.js';
import type { ServerConfig } from '../types.js';
export declare function createPixsoMcpServer(session: PluginSession, config: ServerConfig): McpServer;
