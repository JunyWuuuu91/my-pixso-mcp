import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_PLUGIN_SESSION_CLOSE_REASON,
  PluginSession,
  REPLACED_PLUGIN_SESSION_CLOSE_REASON,
  UNRESPONSIVE_PLUGIN_SESSION_CLOSE_REASON
} from '../src/bridge/pluginSession.js';

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  closeCode?: number;
  closeReason?: string;
  send(payload: string) {
    this.sent.push(payload);
  }
  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3;
    this.emit('close');
  }
}

class ThrowingSocket extends FakeSocket {
  send() {
    throw new Error('send failed');
  }
}

describe('PluginSession', () => {
  it('tracks status after attach', () => {
    const session = new PluginSession({ pluginTimeoutMs: 1000 });
    const socket = new FakeSocket() as any;
    const connectionId = session.attach(socket, { client: 'test' });
    expect(connectionId).toBeTruthy();
    expect(session.getStatus().connected).toBe(true);
    expect(session.hasActiveConnection()).toBe(true);
    expect(session.getStatus().plugin?.client).toBe('test');
  });

  it('sends commands and resolves matching responses', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 1000 });
    const socket = new FakeSocket() as any;
    session.attach(socket, { client: 'test' });

    const promise = session.call('health', {});
    const sent = JSON.parse(socket.sent[0]);
    expect(sent.command).toBe('health');

    session.handleResponse({ id: sent.id, ok: true, result: { ok: true } });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('rejects pending calls when the Pixso plugin reconnects', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 1000 });
    const firstSocket = new FakeSocket() as any;
    const secondSocket = new FakeSocket() as any;
    session.attach(firstSocket, { client: 'first' });

    const promise = session.call('get_file_info', {});
    const rejection = expect(promise).rejects.toThrow('replaced by a new connection');

    session.attach(secondSocket, { client: 'second' });

    await rejection;
    expect(firstSocket.closeCode).toBe(1000);
    expect(firstSocket.closeReason).toBe(REPLACED_PLUGIN_SESSION_CLOSE_REASON);
    expect(session.getStatus().pending).toBeUndefined();
    expect(session.getStatus().plugin?.client).toBe('second');
  });

  it('exposes a duplicate-session close reason for bridge-level rejection', () => {
    expect(DUPLICATE_PLUGIN_SESSION_CLOSE_REASON).toBe('Another Pixso plugin session is already connected');
  });

  it('clears pending state when socket send fails', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 1000 });
    session.attach(new ThrowingSocket() as any, { client: 'test' });

    await expect(session.call('health', {})).rejects.toThrow('send failed');
    expect(session.getStatus().pending).toBeUndefined();
  });

  it('rejects a concurrent command instead of overloading the Pixso runtime', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 1000 });
    const socket = new FakeSocket() as any;
    session.attach(socket, { client: 'test' });

    const firstCall = session.call('get_selection_context', {});

    await expect(session.call('health', {})).rejects.toThrow(
      'Pixso plugin is busy with get_selection_context'
    );
    expect(socket.sent).toHaveLength(1);

    const sent = JSON.parse(socket.sent[0]);
    session.handleResponse({ id: sent.id, ok: true, result: { selectionCount: 1 } });
    await expect(firstCall).resolves.toEqual({ selectionCount: 1 });
  });

  it('quarantines an unresponsive plugin connection after a command timeout', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 10 });
    const socket = new FakeSocket() as any;
    session.attach(socket, { client: 'test' });

    await expect(session.call('get_selection_context', {})).rejects.toThrow(
      'timed out after 10ms'
    );

    expect(socket.closeCode).toBe(1011);
    expect(socket.closeReason).toBe(UNRESPONSIVE_PLUGIN_SESSION_CLOSE_REASON);
    expect(session.getStatus().connected).toBe(false);
    expect(session.getStatus().pending).toBeUndefined();
    expect(session.getStatus().lastFailure?.command).toBe('get_selection_context');
    expect(session.getStatus().lastFailure?.reason).toBe('timeout');
  });

  it('clears the previous timeout failure when a fresh plugin session attaches', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 10 });
    const firstSocket = new FakeSocket() as any;
    session.attach(firstSocket, { client: 'first' });
    await expect(session.call('health', {})).rejects.toThrow('timed out');

    const secondSocket = new FakeSocket() as any;
    session.attach(secondSocket, { client: 'second' });

    expect(session.getStatus().connected).toBe(true);
    expect(session.getStatus().lastFailure).toBeUndefined();
  });
});
