import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { BridgeServer } from '../bridge/wsServer.js';
import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
import { createPixsoMcpServer } from './createMcpServer.js';

export async function runStdioServer(config: ServerConfig, bridge: BridgeServer, log: Logger): Promise<void> {
  const server = createPixsoMcpServer(bridge.sessions, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('MCP stdio server ready; Pixso plugin WS bridge stays available for the plugin window');

  const shutdown = async () => {
    await bridge.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
