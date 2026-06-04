import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPixsoMcpServer } from './createMcpServer.js';
export async function runStdioServer(config, bridge, logger) {
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
//# sourceMappingURL=stdio.js.map