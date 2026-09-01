import { dispatch } from './dispatch.js';
import { PLUGIN_NAME, PLUGIN_VERSION } from './commands/health.js';
import { getSelection, getSelectionMode, setSelectionMode } from './commands/getSelection.js';
import { readProp } from './utils/nodeProps.js';

pixso.showUI(__html__, {
  width: 440,
  height: 680,
  title: 'Pixso MCP 本地桥',
  visible: true,
  enableResize: true,
  minWidth: 360,
  minHeight: 380
});

interface BridgeMessage {
  id?: unknown;
  command?: unknown;
  input?: unknown;
}

interface UiPayload {
  type?: unknown;
  key?: unknown;
  value?: unknown;
  on?: unknown;
  message?: BridgeMessage;
}

/** The UI may only reach these keys; anything else is ignored. */
const STORED_SETTINGS_KEYS = new Set(['bridgePort']);

function readEnv() {
  const pages = [...(pixso.root?.children ?? [])];
  const topLevel = pages.flatMap(page => [...(page.children ?? [])]);
  return {
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    editorType: pixso.editorType,
    apiVersion: pixso.apiVersion,
    fileKey: pixso.fileKey,
    documentName: pixso.root?.name,
    pageCount: pages.length,
    currentPageName: pixso.currentPage?.name,
    topFrameCount: topLevel.filter(node => node.type === 'FRAME').length,
    componentCount: topLevel.filter(node => node.type === 'COMPONENT').length,
    selectionMode: getSelectionMode(),
    hasSelectionApi: Array.isArray(readProp(pixso.currentPage, 'selection'))
  };
}

async function readStorage(key: string): Promise<unknown> {
  try {
    return (await pixso.clientStorage.getAsync(key)) ?? null;
  } catch {
    return null;
  }
}

async function writeStorage(key: string, value: unknown): Promise<void> {
  try {
    await pixso.clientStorage.setAsync(key, value);
  } catch {
    // 存储不可用（预览模式受限、配额）时端口只在本次窗口生效。
  }
}

const SELECTION_POLL_MS = 700;
const SELECTION_FAILURE_LIMIT = 3;

let selectionSignature = '';
let lastSelectionError = '';
let selectionFailures = 0;
let selectionWatched = true;
let selectionTimer: ReturnType<typeof setInterval> | null = null;

function stopSelectionPolling() {
  if (selectionTimer && typeof clearInterval === 'function') clearInterval(selectionTimer);
  selectionTimer = null;
}

function startSelectionPolling() {
  if (typeof setInterval !== 'function' || typeof clearInterval !== 'function') {
    setSelectionMode('manual');
    return;
  }
  setSelectionMode('poll');
  if (selectionTimer) return;
  selectionTimer = setInterval(() => void pushSelection(), SELECTION_POLL_MS);
}

async function pushSelection(force = false) {
  if (!selectionWatched && !force) return;
  try {
    const selection = await getSelection();
    selectionFailures = 0;
    lastSelectionError = '';
    const payload = JSON.stringify(selection);
    if (!force && payload === selectionSignature) return;
    selectionSignature = payload;
    pixso.ui.postMessage({ type: 'plugin-selection', selection });
  } catch (error) {
    selectionFailures += 1;
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastSelectionError) {
      lastSelectionError = message;
      pixso.ui.postMessage({ type: 'plugin-selection', error: message, selectionMode: getSelectionMode() });
    }
    if (selectionFailures >= SELECTION_FAILURE_LIMIT) {
      stopSelectionPolling();
      setSelectionMode('manual');
    }
  }
}

function trackSelection() {
  const on = readProp(pixso, 'on');
  if (typeof on === 'function') {
    try {
      (on as (event: string, handler: () => void) => unknown).call(pixso, 'currentselectionchange', () => void pushSelection());
      setSelectionMode('event');
      return;
    } catch {
      // 事件名或签名与预期不符时退回轮询，不让面板失去选区。
    }
  }
  startSelectionPolling();
}

pixso.ui.onmessage = async (payload: unknown) => {
  const data = (payload ?? {}) as UiPayload;

  if (data.type === 'plugin-env-request') {
    pixso.ui.postMessage({ type: 'plugin-env', env: readEnv() });
    return;
  }

  if (data.type === 'plugin-selection-request') {
    await pushSelection(true);
    return;
  }

  if (data.type === 'plugin-selection-watch') {
    selectionWatched = data.on !== false;
    if (selectionWatched) {
      if (getSelectionMode() === 'poll') startSelectionPolling();
    } else {
      stopSelectionPolling();
    }
    return;
  }

  const settingKey = typeof data.key === 'string' && STORED_SETTINGS_KEYS.has(data.key) ? data.key : '';
  if (data.type === 'plugin-storage-get' && settingKey) {
    pixso.ui.postMessage({ type: 'plugin-storage', key: settingKey, value: await readStorage(settingKey) });
    return;
  }
  if (data.type === 'plugin-storage-set' && settingKey) {
    await writeStorage(settingKey, data.value);
    return;
  }

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

trackSelection();
