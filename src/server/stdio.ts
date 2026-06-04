import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { BridgeServer } from '../bridge/wsServer.js';
import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
import { createPixsoMcpServer } from './createMcpServer.js';

export async function runStdioServer(config: ServerConfig, bridge: BridgeServer, logger: Logger): Promise<void> {
  const server = createPixsoMcpServer(bridge.session, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`MCP stdio server ready. Pixso plugin should connect to ws://${config.host}:${config.wsPort}${config.wsPath}`);

  const shutdown = async () => {
    logger.info('Shutting down stdio MCP server');
    await server.close();
    await bridge.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
