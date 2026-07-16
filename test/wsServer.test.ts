import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startBridgeServer, type BridgeServer } from '../src/bridge/wsServer.js';
import { DUPLICATE_PLUGIN_SESSION_CLOSE_REASON } from '../src/bridge/pluginSession.js';
import type { ServerConfig } from '../src/types.js';

const logger = {
  info() {},
  warn() {},
  error() {}
};

async function getFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  if (!address || typeof address === 'string') throw new Error('Failed to allocate a free TCP port');
  return address.port;
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function waitForClose(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise(resolve => {
    socket.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

describe('startBridgeServer', () => {
  let bridge: BridgeServer | undefined;

  afterEach(async () => {
    await bridge?.close();
    bridge = undefined;
  });

  it('rejects duplicate Pixso plugin sockets without replacing the active session', async () => {
    const wsPort = await getFreePort();
    const config: ServerConfig = {
      transport: 'http',
      host: '127.0.0.1',
      mcpPort: 0,
      wsPort,
      wsPath: '/ws',
      pluginTimeoutMs: 1000,
      version: 'test'
    };
    bridge = await startBridgeServer(config, logger);

    const firstSocket = await openSocket(`ws://127.0.0.1:${wsPort}/ws?client=first`);
    const firstConnectionId = bridge.session.getStatus().connectionId;
    const secondSocket = new WebSocket(`ws://127.0.0.1:${wsPort}/ws?client=second`);
    const duplicateClosePromise = waitForClose(secondSocket);
    await new Promise<void>((resolve, reject) => {
      secondSocket.once('open', resolve);
      secondSocket.once('error', reject);
    });
    const duplicateClose = await duplicateClosePromise;

    expect(duplicateClose).toEqual({ code: 1000, reason: DUPLICATE_PLUGIN_SESSION_CLOSE_REASON });
    expect(bridge.session.getStatus().connectionId).toBe(firstConnectionId);
    expect(firstSocket.readyState).toBe(WebSocket.OPEN);

    firstSocket.close();
  });
});
