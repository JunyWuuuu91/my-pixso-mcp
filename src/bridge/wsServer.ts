import { createServer, type Server as HttpServer } from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
import { DUPLICATE_PLUGIN_SESSION_CLOSE_REASON, PluginSession } from './pluginSession.js';

export interface BridgeServer {
  session: PluginSession;
  close(): Promise<void>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson(data: unknown): unknown {
  if (typeof data === 'string') return JSON.parse(data);
  if (Buffer.isBuffer(data)) return JSON.parse(data.toString('utf8'));
  if (Array.isArray(data)) return JSON.parse(Buffer.concat(data).toString('utf8'));
  return JSON.parse(String(data));
}

export async function startBridgeServer(config: ServerConfig, logger: Logger): Promise<BridgeServer> {
  const session = new PluginSession(config);
  const httpServer = createServer();
  const wsServer = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    if (requestUrl.pathname !== config.wsPath) {
      socket.destroy();
      return;
    }

    if (config.sessionToken && requestUrl.searchParams.get('token') !== config.sessionToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(request, socket, head, ws => {
      wsServer.emit('connection', ws, request);
    });
  });

  wsServer.on('connection', (socket: WebSocket, request) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    const pluginInfo = {
      userAgent: request.headers['user-agent'],
      client: requestUrl.searchParams.get('client') ?? 'pixso-plugin'
    };

    if (session.hasActiveConnection()) {
      const activeConnectionId = session.getStatus().connectionId;
      socket.close(1000, DUPLICATE_PLUGIN_SESSION_CLOSE_REASON);
      logger.warn('Rejected duplicate Pixso plugin WS connection', { activeConnectionId });
      return;
    }

    const connectionId = session.attach(socket, pluginInfo);
    logger.info(`Pixso plugin connected to WS bridge`, { connectionId });
    socket.on('close', (code, reason) => {
      logger.info('Pixso plugin disconnected from WS bridge', {
        connectionId,
        code,
        reason: reason.toString()
      });
    });

    socket.on('message', raw => {
      try {
        const message = parseJson(raw);
        if (!isObject(message)) return;

        if (message.type === 'hello') {
          session.updatePluginInfo(isObject(message.plugin) ? message.plugin : undefined);
          return;
        }

        if (typeof message.id === 'string' && typeof message.ok === 'boolean') {
          session.handleResponse({
            id: message.id,
            ok: message.ok,
            result: message.result,
            error: typeof message.error === 'string' ? message.error : undefined
          });
          return;
        }
      } catch (error) {
        logger.warn('Failed to parse Pixso plugin WS message', error instanceof Error ? error.message : String(error));
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.wsPort, config.host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  logger.info(`Pixso plugin WS bridge listening on ws://${config.host}:${config.wsPort}${config.wsPath}`);

  return {
    session,
    close: async () => {
      session.close();
      await closeWsServer(wsServer);
      await closeHttpServer(httpServer);
    }
  };
}

async function closeWsServer(server: WebSocketServer): Promise<void> {
  for (const client of server.clients) client.close(1001, 'Server shutdown');
  await new Promise<void>(resolve => server.close(() => resolve()));
}

async function closeHttpServer(server: HttpServer): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}
