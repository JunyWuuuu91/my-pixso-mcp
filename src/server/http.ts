import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { BridgeServer } from '../bridge/wsServer.js';
import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
import { createPixsoMcpServer } from './createMcpServer.js';

export async function runHttpServer(config: ServerConfig, bridge: BridgeServer, logger: Logger): Promise<void> {
  const app = createMcpExpressApp();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.get('/health', (_req: any, res: any) => {
    res.json({ ok: true, plugin: bridge.session.getStatus(), wsPort: config.wsPort, mcpPort: config.mcpPort });
  });

  app.post('/mcp', async (req: any, res: any) => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId) {
        const existingTransport = transports.get(sessionId);
        if (!existingTransport) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'MCP session not found. Initialize a new session.' },
            id: null
          });
          return;
        }
        transport = existingTransport;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: initializedSessionId => {
            transports.set(initializedSessionId, transport as StreamableHTTPServerTransport);
          }
        });

        transport.onclose = () => {
          if (transport?.sessionId) transports.delete(transport.sessionId);
        };

        const server = createPixsoMcpServer(bridge.session, config);
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: missing or invalid MCP session id' },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP HTTP request', error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  app.get('/mcp', (_req: any, res: any) => {
    res.status(405).set('Allow', 'POST').send('Method Not Allowed');
  });

  app.delete('/mcp', async (req: any, res: any) => {
    const sessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)?.close();
      transports.delete(sessionId);
    }
    res.status(204).end();
  });

  const httpServer = app.listen(config.mcpPort, config.host, () => {
    logger.info(`MCP Streamable HTTP server listening on http://${config.host}:${config.mcpPort}/mcp`);
  });

  const shutdown = async () => {
    logger.info('Shutting down HTTP MCP server');
    for (const transport of transports.values()) await transport.close();
    await new Promise<void>((resolve, reject) => httpServer.close((error: Error | undefined) => (error ? reject(error) : resolve())));
    await bridge.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
