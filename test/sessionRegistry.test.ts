import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { NO_PLUGIN_MESSAGE, SessionRegistry } from '../src/bridge/pluginSession.js';
import { startBridgeServer } from '../src/bridge/wsServer.js';
import type { ServerConfig } from '../src/types.js';

type CloseHandler = (code: number, reason: Buffer) => void;

class FakeSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  private closeHandlers: CloseHandler[] = [];

  on(event: string, handler: CloseHandler): void {
    if (event === 'close') this.closeHandlers.push(handler);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    for (const handler of this.closeHandlers) handler(code, Buffer.from(reason));
  }

  lastMessage(): { id: string; command: string; input: unknown } {
    const last = this.sent[this.sent.length - 1];
    if (!last) throw new Error('no message sent');
    return JSON.parse(last);
  }
}

function makeRegistry(pluginTimeoutMs = 30_000) {
  const config = { pluginTimeoutMs } as Pick<ServerConfig, 'pluginTimeoutMs'>;
  return new SessionRegistry(config);
}

/** What a current bundle publishes in its hello payload; old bundles only report name + uiConnectedAt. */
function env(overrides: Record<string, unknown> = {}) {
  return { name: 'My Pixso MCP', version: '0.1.0', editorType: 'pixso', apiVersion: '1.0', ...overrides };
}

describe('SessionRegistry', () => {
  it('throws a helpful error when no plugin is connected', async () => {
    const registry = makeRegistry();
    await expect(registry.call('health', {})).rejects.toThrow(NO_PLUGIN_MESSAGE);
    expect(registry.getStatus().connected).toBe(false);
  });

  it('round-trips a command to the plugin', async () => {
    const registry = makeRegistry();
    const socket = new FakeSocket();
    const session = registry.register(socket as any, { client: 'test' });

    const promise = registry.call<{ pong: boolean }>('health', { a: 1 });
    const sent = socket.lastMessage();
    expect(sent.command).toBe('health');
    expect(sent.input).toEqual({ a: 1 });

    session.handleResponse({ id: sent.id, ok: true, result: { pong: true } });
    await expect(promise).resolves.toEqual({ pong: true });
  });

  it('rejects with the plugin error message', async () => {
    const registry = makeRegistry();
    const socket = new FakeSocket();
    const session = registry.register(socket as any);

    const promise = registry.call('get_document', {});
    const sent = socket.lastMessage();
    session.handleResponse({ id: sent.id, ok: false, error: 'boom from plugin' });
    await expect(promise).rejects.toThrow('boom from plugin');
  });

  it('marks the session stuck on timeout and recovers on a late response', async () => {
    const registry = makeRegistry(20);
    const socket = new FakeSocket();
    const session = registry.register(socket as any);

    const promise = registry.call('get_document', {});
    const sent = socket.lastMessage();

    await expect(promise).rejects.toThrow(/timed out after 20ms/);
    const stuckStatus = session.getStatus().stuck;
    expect(stuckStatus?.command).toBe('get_document');
    await expect(registry.call('health', {})).rejects.toThrow(/busy/);

    session.handleResponse({ id: sent.id, ok: true, result: { late: true } });
    expect(session.getStatus().stuck).toBeUndefined();
    expect(session.isBusy()).toBe(false);
  });

  it('routes to an idle session when another is busy', async () => {
    const registry = makeRegistry();
    const busySocket = new FakeSocket();
    const idleSocket = new FakeSocket();
    registry.register(busySocket as any);
    const idleSession = registry.register(idleSocket as any);

    void registry.call('health', {}).catch(() => {});
    expect(busySocket.sent).toHaveLength(1);

    const second = registry.call<{ from: string }>('get_document', {});
    expect(idleSocket.sent).toHaveLength(1);
    const sent = idleSocket.lastMessage();
    idleSession.handleResponse({ id: sent.id, ok: true, result: { from: 'idle' } });
    await expect(second).resolves.toEqual({ from: 'idle' });
  });

  it('prefers a window that reported its environment over an old bundle', async () => {
    const registry = makeRegistry();
    const staleSocket = new FakeSocket();
    registry.register(staleSocket as any, { name: 'My Pixso MCP', uiConnectedAt: new Date().toISOString() });
    const freshSocket = new FakeSocket();
    registry.register(freshSocket as any, env({ fileKey: 'keyFresh', documentName: '登录页' }));

    void registry.call('health', {}).catch(() => {});
    expect(staleSocket.sent).toHaveLength(0);
    expect(freshSocket.sent).toHaveLength(1);
  });

  it('labels each session with its availability and marks the next pick', () => {
    const registry = makeRegistry();
    const staleSocket = new FakeSocket();
    registry.register(staleSocket as any, { name: 'My Pixso MCP' });
    const freshSocket = new FakeSocket();
    registry.register(freshSocket as any, env({ fileKey: 'keyFresh', documentName: '登录页' }));

    const [first, second] = registry.getStatus().sessions;
    expect(first.fileKey).toBe('keyFresh');
    expect(first.availability).toBe('ready');
    expect(first.nextPick).toBe(true);
    expect(second.availability).toBe('unknown-build');
    expect(second.nextPick).toBeUndefined();
  });

  it('pins a call to the window matching file by key or name', async () => {
    const registry = makeRegistry();
    const socketA = new FakeSocket();
    registry.register(socketA as any, env({ fileKey: 'keyA', documentName: '首页设计' }));
    const socketB = new FakeSocket();
    registry.register(socketB as any, env({ fileKey: 'keyB', documentName: '个人中心' }));

    void registry.call('health', {}, undefined, { file: '个人中心' }).catch(() => {});
    expect(socketA.sent).toHaveLength(0);
    expect(socketB.sent).toHaveLength(1);

    void registry.call('get_document', {}, undefined, { file: '首页' }).catch(() => {});
    expect(socketA.sent).toHaveLength(1);
  });

  it('does not fall back to another file when the pinned window is busy', async () => {
    const registry = makeRegistry();
    const socketA = new FakeSocket();
    registry.register(socketA as any, env({ fileKey: 'keyA', documentName: 'A' }));
    const socketB = new FakeSocket();
    registry.register(socketB as any, env({ fileKey: 'keyB', documentName: 'B' }));

    void registry.call('health', {}, undefined, { file: 'keyA' }).catch(() => {});
    await expect(registry.call('get_document', {}, undefined, { file: 'keyA' })).rejects.toThrow(/matching "keyA"/);
    expect(socketB.sent).toHaveLength(0);
  });

  it('lists the connected windows when no file matches', async () => {
    const registry = makeRegistry();
    registry.register(new FakeSocket() as any, env({ fileKey: 'keyA', documentName: '首页设计' }));

    await expect(registry.call('get_document', {}, undefined, { file: '不存在的文件' })).rejects.toThrow(
      /Connected windows: "首页设计" \(keyA, pixso\)/
    );
  });

  it('removes sessions when the socket closes', async () => {
    const registry = makeRegistry();
    const socket = new FakeSocket();
    registry.register(socket as any);
    expect(registry.getStatus().sessions).toHaveLength(1);

    socket.close();
    expect(registry.getStatus().sessions).toHaveLength(0);
    expect(registry.getStatus().connected).toBe(false);
  });

  it('rejects pending calls on socket close', async () => {
    const registry = makeRegistry();
    const socket = new FakeSocket();
    registry.register(socket as any);

    const promise = registry.call('health', {});
    socket.close();
    await expect(promise).rejects.toThrow(/closed/);
  });
});

const silentLogger = { info() {}, warn() {}, error() {} };

function tokenBridgeConfig(): ServerConfig {
  return {
    host: '127.0.0.1',
    mcpPort: 0,
    wsPort: 0,
    wsPath: '/ws',
    sessionToken: 'secret-token',
    pluginTimeoutMs: 5_000,
    authTimeoutMs: 500,
    version: 'test'
  };
}

function waitForClose(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise(resolve => {
    socket.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

function waitForMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    socket.once('message', raw => resolve(JSON.parse(raw.toString())));
  });
}

describe('WS bridge authentication', () => {
  it('accepts a first-frame auth message with the right token', async () => {
    const config = tokenBridgeConfig();
    const bridge = await startBridgeServer(config, silentLogger);
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${bridge.wsPort}/ws`);
      const authOk = waitForMessage(socket);
      socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', token: 'secret-token' })));
      const message = await authOk;
      expect(message.type).toBe('auth-ok');
      expect(bridge.sessions.getStatus().connected).toBe(true);
      socket.close();
    } finally {
      await bridge.close();
    }
  });

  it('rejects a wrong token', async () => {
    const config = tokenBridgeConfig();
    const bridge = await startBridgeServer(config, silentLogger);
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${bridge.wsPort}/ws`);
      const closed = waitForClose(socket);
      socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', token: 'wrong' })));
      const { code } = await closed;
      expect(code).toBe(4401);
      expect(bridge.sessions.getStatus().connected).toBe(false);
    } finally {
      await bridge.close();
    }
  });

  it('closes connections that never authenticate', async () => {
    const config = tokenBridgeConfig();
    const bridge = await startBridgeServer(config, silentLogger);
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${bridge.wsPort}/ws`);
      const closed = waitForClose(socket);
      const { code } = await closed;
      expect(code).toBe(4408);
    } finally {
      await bridge.close();
    }
  });
});
