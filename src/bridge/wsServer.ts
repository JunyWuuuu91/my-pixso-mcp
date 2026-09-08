import { createServer, type Server as HttpServer } from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
import { SessionRegistry, type PluginSession } from './pluginSession.js';

export interface BridgeServer {
  sessions: SessionRegistry;
  wsPort: number;
  close(): Promise<void>;
}

/** Protocol ping every N ms; a socket that misses pongs is half-open and gets terminated. */
const HEARTBEAT_INTERVAL_MS = 5_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson(data: unknown): unknown {
  if (typeof data === 'string') return JSON.parse(data);
  if (Buffer.isBuffer(data)) return JSON.parse(data.toString('utf8'));
  if (Array.isArray(data)) return JSON.parse(Buffer.concat(data).toString('utf8'));
  return JSON.parse(String(data));
}

export async function startBridgeServer(config: ServerConfig, log: Logger): Promise<BridgeServer> {
  const sessions = new SessionRegistry(config);
  const httpServer = createServer();
  const wsServer = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? config.host}`);
    if (requestUrl.pathname !== config.wsPath) {
      socket.destroy();
      return;
    }
    wsServer.handleUpgrade(request, socket, head, ws => {
      wsServer.emit('connection', ws, request);
    });
  });

  wsServer.on('connection', (socket: WebSocket, request) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? config.host}`);
    const baseInfo: Record<string, unknown> = {
      userAgent: request.headers['user-agent'],
      client: requestUrl.searchParams.get('client') ?? 'pixso-plugin'
    };

    let session: PluginSession | undefined;
    let authTimer: NodeJS.Timeout | undefined;

    const finishAuth = (authMessage?: Record<string, unknown>) => {
      if (authTimer) clearTimeout(authTimer);
      authTimer = undefined;
      if (session) return;
      const hello = authMessage && isObject(authMessage.plugin) ? authMessage.plugin : undefined;
      session = sessions.register(socket, { ...baseInfo, ...hello });
      log.info('Pixso plugin connected to WS bridge', { sessionId: session.id });
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: 'auth-ok', sessionId: session.id }));
      }
      startHeartbeat(socket, session, log);
      socket.on('close', (code, reason) => {
        log.info('Pixso plugin disconnected from WS bridge', { sessionId: session?.id, code, reason: reason.toString() });
      });
    };

    if (config.sessionToken) {
      authTimer = setTimeout(() => {
        if (!session) socket.close(4408, 'Authentication timeout: send {type:"auth", token} as the first message');
      }, config.authTimeoutMs);
    }

    socket.on('message', raw => {
      try {
        const message = parseJson(raw);
        if (!isObject(message)) return;

        if (!session) {
          if (!config.sessionToken) {
            finishAuth(message.type === 'hello' ? message : undefined);
          } else if (message.type === 'auth') {
            if (message.token !== config.sessionToken) {
              socket.close(4401, 'Invalid token');
              return;
            }
            finishAuth();
          } else {
            socket.close(4401, 'First message must be {type:"auth", token}');
            return;
          }
        }

        if (message.type === 'hello') {
          session?.updatePluginInfo(isObject(message.plugin) ? message.plugin : undefined);
          return;
        }

        // Application-level liveness from the plugin UI (browsers cannot send
        // protocol pings). Any received message already proves the pipe works.
        if (message.type === 'ping') {
          session?.markAlive();
          if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'pong', t: message.t }));
          return;
        }

        if (typeof message.id === 'string' && typeof message.ok === 'boolean') {
          session?.handleResponse({
            id: message.id,
            ok: message.ok,
            result: message.result,
            error: typeof message.error === 'string' ? message.error : undefined
          });
        }
      } catch (error) {
        log.warn('Failed to parse Pixso plugin WS message', {
          error: error instanceof Error ? error.message : String(error)
        });
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

  const boundPort = (httpServer.address() as import('node:net').AddressInfo).port;
  log.info(`Pixso plugin WS bridge listening on ws://${config.host}:${boundPort}${config.wsPath}${config.sessionToken ? ' (token required)' : ''}`);

  return {
    sessions,
    wsPort: boundPort,
    close: async () => {
      sessions.closeAll();
      await closeWsServer(wsServer);
      await closeHttpServer(httpServer);
    }
  };
}

/**
 * Protocol-level liveness loop. ws pings cannot be sent from browsers, so the
 * plugin UI answers with application-level {type:'ping'} frames; the bridge
 * sends a ws ping too and closes the socket after two missed cycles. Closing
 * is what makes a half-open connection visible: the session drops out of the
 * registry and health reports the truth instead of a session frozen in
 * "busy/stuck" forever.
 */
function startHeartbeat(socket: WebSocket, session: PluginSession, log: Logger): void {
  let missed = 0;
  const timer = setInterval(() => {
    if (socket.readyState !== socket.OPEN) {
      clearInterval(timer);
      return;
    }
    // A command in flight means the plugin is legitimately working (e.g. a slow
    // exportAsync render that starves the app-level ping). Never heartbeat-terminate
    // an active session; the heartbeat exists to catch idle half-open sockets only.
    if (session.hasPendingCall()) {
      missed = 0;
      try {
        socket.ping();
      } catch {
        clearInterval(timer);
      }
      return;
    }
    missed += 1;
    if (missed > 2) {
      log.warn('Pixso plugin missed heartbeat pongs; closing half-open socket', { sessionId: session.id });
      socket.close(4000, 'heartbeat timeout');
      clearInterval(timer);
      return;
    }
    try {
      socket.ping();
    } catch {
      clearInterval(timer);
    }
  }, HEARTBEAT_INTERVAL_MS);
  socket.on('close', () => clearInterval(timer));
  socket.on('message', () => {
    // any inbound traffic proves the pipe works
    missed = 0;
    session.markAlive();
  });
}

async function closeWsServer(server: WebSocketServer): Promise<void> {
  for (const client of server.clients) client.close(1001, 'Server shutdown');
  await new Promise<void>(resolve => server.close(() => resolve()));
}

async function closeHttpServer(server: HttpServer): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}
