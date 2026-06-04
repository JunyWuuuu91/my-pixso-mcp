import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../types.js';
import type { PluginSession } from '../bridge/pluginSession.js';
export declare function normalizePluginInputForCommand(command: string, input: unknown): unknown;
export declare function registerTools(server: McpServer, session: PluginSession, config: ServerConfig): void;
