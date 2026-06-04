import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../tools/registerTools.js';
export function createPixsoMcpServer(session, config) {
    const server = new McpServer({
        name: 'pixso-advanced-mcp',
        version: config.version,
        websiteUrl: 'https://pixso.net/'
    });
    registerTools(server, session, config);
    return server;
}
//# sourceMappingURL=createMcpServer.js.map