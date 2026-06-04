import { createServer } from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import { PluginSession } from './pluginSession.js';
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function parseJson(data) {
    if (typeof data === 'string')
        return JSON.parse(data);
    if (Buffer.isBuffer(data))
        return JSON.parse(data.toString('utf8'));
    if (Array.isArray(data))
        return JSON.parse(Buffer.concat(data).toString('utf8'));
    return JSON.parse(String(data));
}
export async function startBridgeServer(config, logger) {
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
    wsServer.on('connection', (socket, request) => {
        const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
        const pluginInfo = {
            userAgent: request.headers['user-agent'],
            client: requestUrl.searchParams.get('client') ?? 'pixso-plugin'
        };
        const connectionId = session.attach(socket, pluginInfo);
        logger.info(`Pixso plugin connected to WS bridge`, { connectionId });
        socket.on('message', raw => {
            try {
                const message = parseJson(raw);
                if (!isObject(message))
                    return;
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
            }
            catch (error) {
                logger.warn('Failed to parse Pixso plugin WS message', error instanceof Error ? error.message : String(error));
            }
        });
    });
    await new Promise((resolve, reject) => {
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
async function closeWsServer(server) {
    for (const client of server.clients)
        client.close(1001, 'Server shutdown');
    await new Promise(resolve => server.close(() => resolve()));
}
async function closeHttpServer(server) {
    if (!server.listening)
        return;
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}
//# sourceMappingURL=wsServer.js.map