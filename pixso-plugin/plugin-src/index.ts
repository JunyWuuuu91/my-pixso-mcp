import { dispatch } from './dispatch.js';

pixso.showUI(__html__, {
  width: 420,
  height: 440,
  title: 'My Pixso MCP',
  visible: true,
  enableResize: true,
  minWidth: 360,
  minHeight: 300
});

interface BridgeMessage {
  id?: unknown;
  command?: unknown;
  input?: unknown;
}

interface UiPayload {
  type?: unknown;
  message?: BridgeMessage;
}

pixso.ui.onmessage = async (payload: unknown) => {
  const data = (payload ?? {}) as UiPayload;
  if (data.type !== 'mcp-command' || !data.message) return;

  const message = data.message;
  if (typeof message.id !== 'string' || typeof message.command !== 'string') return;

  const input = (message.input && typeof message.input === 'object' ? message.input : {}) as Record<string, unknown>;

  try {
    const result = await dispatch(message.command, input);
    pixso.ui.postMessage({ type: 'mcp-response', response: { id: message.id, ok: true, result } });
  } catch (error) {
    pixso.ui.postMessage({
      type: 'mcp-response',
      response: { id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) }
    });
  }
};
