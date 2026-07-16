import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen?: () => void;
  onclose?: (event: { reason?: string }) => void;
  onerror?: () => void;
  onmessage?: (event: { data: string }) => void;

  constructor(readonly url: string) {}

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = 3;
  }
}

function createUiHarness() {
  const html = readFileSync('pixso-plugin/ui.html', 'utf8');
  const script = html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
  const elements = new Map<string, any>([
    ['status', { textContent: '', className: '' }],
    ['port', { value: '3669' }],
    ['token', { value: '' }],
    ['connect', {}],
    ['disconnect', {}]
  ]);
  const sockets: FakeWebSocket[] = [];
  const pluginMessages: unknown[] = [];
  const WebSocketFactory = class extends FakeWebSocket {
    constructor(url: string) {
      super(url);
      sockets.push(this);
    }
  };
  Object.assign(WebSocketFactory, { OPEN: FakeWebSocket.OPEN, CONNECTING: FakeWebSocket.CONNECTING });
  const window: { onmessage?: (event: any) => void } = {};

  vm.runInNewContext(script, {
    document: { getElementById: (id: string) => elements.get(id) },
    window,
    parent: { postMessage: (message: unknown) => pluginMessages.push(message) },
    WebSocket: WebSocketFactory,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    Date
  });

  return { elements, pluginMessages, socket: sockets[0], window };
}

describe('Pixso plugin UI command lifecycle', () => {
  it('rejects overlapping commands before they reach the Pixso main context', () => {
    const { pluginMessages, socket, window } = createUiHarness();
    socket.readyState = FakeWebSocket.OPEN;
    socket.onopen?.();

    socket.onmessage?.({ data: JSON.stringify({ id: 'first', command: 'get_selection_context', input: {} }) });
    socket.onmessage?.({ data: JSON.stringify({ id: 'second', command: 'health', input: {} }) });

    expect(pluginMessages).toHaveLength(1);
    expect(JSON.parse(socket.sent.at(-1) || '{}')).toMatchObject({
      id: 'second',
      ok: false,
      error: expect.stringContaining('still executing get_selection_context')
    });

    window.onmessage?.({
      data: { pluginMessage: { type: 'mcp-response', response: { id: 'first', ok: true, result: {} } } }
    });
    socket.onmessage?.({ data: JSON.stringify({ id: 'third', command: 'health', input: {} }) });
    expect(pluginMessages).toHaveLength(2);
  });

  it('shows an explicit reload instruction when the bridge quarantines a timeout', () => {
    const { elements, socket } = createUiHarness();
    socket.readyState = FakeWebSocket.OPEN;
    socket.onopen?.();

    socket.onclose?.({ reason: 'Pixso plugin stopped responding; reload the plugin window' });

    expect(elements.get('status').textContent).toContain('Close and reopen this plugin window');
    expect(elements.get('status').className).toContain('bad');
  });
});
