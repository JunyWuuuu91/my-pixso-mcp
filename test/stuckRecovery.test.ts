import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SessionRegistry } from '../src/bridge/pluginSession.js';
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
}

function makeRegistry(pluginTimeoutMs = 30_000) {
  const config = { pluginTimeoutMs } as Pick<ServerConfig, 'pluginTimeoutMs'>;
  return new SessionRegistry(config);
}

interface SessionInternals {
  handleResponse(response: { id: string; ok: boolean; result?: unknown }): void;
  markAlive(): void;
}

function firstSession(registry: SessionRegistry): SessionInternals {
  const sessions = (registry as unknown as { sessions: Map<string, SessionInternals> }).sessions;
  return sessions.values().next().value as SessionInternals;
}

/** Registers a session and lets a command time out, returning the pieces needed to recover. */
function timedOutSession() {
  const registry = makeRegistry(20);
  const socket = new FakeSocket();
  registry.register(socket as any, { client: 'test', version: '0.1.0', editorType: 'pixso' });
  const promise = registry.call('health', {});
  promise.catch(() => {});
  vi.advanceTimersByTime(25);
  const sent = JSON.parse(socket.sent[0] as string) as { id: string };
  return { registry, socket, promise, timedOutId: sent.id };
}

describe('session stuck auto-clear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the session stuck after a timeout', async () => {
    const { registry, promise } = timedOutSession();
    await expect(promise).rejects.toThrow(/timed out/);
    expect(registry.getStatus().sessions[0]?.availability).toBe('stuck');
  });

  it('clears stuck when the late response with the exact id arrives', async () => {
    const { registry, timedOutId, promise } = timedOutSession();
    await expect(promise).rejects.toThrow(/timed out/);
    firstSession(registry).handleResponse({ id: timedOutId, ok: true, result: { pong: true } });
    expect(registry.getStatus().sessions[0]?.availability).toBe('ready');
  });

  it('auto-clears stuck after the grace period while liveness keeps arriving', async () => {
    const { registry, promise } = timedOutSession();
    await expect(promise).rejects.toThrow(/timed out/);
    expect(registry.getStatus().sessions[0]?.availability).toBe('stuck');

    // heartbeats every 5s across the 15s grace period
    const session = firstSession(registry);
    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(5_000);
      session.markAlive();
    }
    expect(registry.getStatus().sessions[0]?.availability).toBe('ready');
  });

  it('stays stuck when the window goes silent after the timeout', async () => {
    const { registry, promise } = timedOutSession();
    await expect(promise).rejects.toThrow(/timed out/);
    vi.advanceTimersByTime(60_000);
    expect(registry.getStatus().sessions[0]?.availability).toBe('stuck');
  });
});
