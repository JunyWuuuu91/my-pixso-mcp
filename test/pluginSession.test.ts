import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { PluginSession } from '../src/bridge/pluginSession.js';

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(payload: string) {
    this.sent.push(payload);
  }
  close() {
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
    expect(session.getStatus().pending).toBeUndefined();
    expect(session.getStatus().plugin?.client).toBe('second');
  });

  it('clears pending state when socket send fails', async () => {
    const session = new PluginSession({ pluginTimeoutMs: 1000 });
    session.attach(new ThrowingSocket() as any, { client: 'test' });

    await expect(session.call('health', {})).rejects.toThrow('send failed');
    expect(session.getStatus().pending).toBeUndefined();
  });
});
