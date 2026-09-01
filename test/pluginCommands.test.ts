import { beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface UiMessage {
  type: string;
  key?: string;
  value?: unknown;
  response?: { id: string; ok: boolean; result?: any; error?: string };
}

function frame(id: string, name: string, width: number, height: number) {
  return { id, name, type: 'FRAME', width, height };
}

function buildDocumentFixture() {
  const pageA = {
    id: 'p1',
    name: '首页',
    type: 'PAGE',
    width: 0,
    height: 0,
    children: [frame('f1', '登录页', 375, 812), frame('f2', '首页主界面', 375, 812)]
  };
  const pageB = { id: 'p2', name: '组件库', type: 'PAGE', width: 0, height: 0, children: [] };
  return {
    root: { id: 'doc-1', name: '示例文件', children: [pageA, pageB] },
    currentPage: pageA
  };
}

async function runPlugin(fixture = buildDocumentFixture(), storage = new Map<string, unknown>()) {
  const result = await build({
    entryPoints: [path.join(root, 'pixso-plugin/plugin-src/index.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2017',
    write: false
  });
  const code = result.outputFiles?.[0]?.text ?? '';

  const posted: UiMessage[] = [];
  const showUiCalls: Array<{ html: string; options?: Record<string, unknown> }> = [];
  const context = vm.createContext({
    __html__: '<html>ui</html>',
    pixso: {
      showUI(html: string, options?: Record<string, unknown>) {
        showUiCalls.push({ html, options });
      },
      notify() {},
      ui: {
        onmessage: null as ((payload: unknown) => Promise<void>) | null,
        postMessage(message: UiMessage) {
          posted.push(message);
        }
      },
      root: fixture.root,
      currentPage: fixture.currentPage,
      clientStorage: {
        async getAsync(key: string) {
          return storage.get(key);
        },
        async setAsync(key: string, value: unknown) {
          storage.set(key, value);
        },
        async deleteAsync(key: string) {
          storage.delete(key);
        },
        async keysAsync() {
          return [...storage.keys()];
        }
      }
    }
  });
  vm.runInContext(code, context);

  const dispatchCommand = async (id: string, command: string, input: Record<string, unknown> = {}) => {
    const handler = (context.pixso as any).ui.onmessage;
    await handler({ type: 'mcp-command', message: { id, command, input } });
    return posted.find(message => message.response?.id === id)?.response;
  };

  return { context, posted, showUiCalls, dispatchCommand, storage };
}

describe('pixso plugin skeleton', () => {
  it('shows the UI on load', async () => {
    const { showUiCalls } = await runPlugin();
    expect(showUiCalls).toHaveLength(1);
    expect(showUiCalls[0]?.options?.title).toBe('Pixso MCP 本地桥');
  });

  it('reports the runtime environment to the UI panel', async () => {
    const { context, posted } = await runPlugin();
    const handler = (context.pixso as any).ui.onmessage;
    await handler({ type: 'plugin-env-request' });
    const envMessage = posted.find(message => message.type === 'plugin-env');
    expect(envMessage).toBeDefined();
    expect((envMessage as any).env).toMatchObject({
      documentName: '示例文件',
      pageCount: 2,
      currentPageName: '首页'
    });
  });

  it('proxies only its own settings keys to clientStorage', async () => {
    const storage = new Map<string, unknown>([['bridgePort', '3700'], ['other', 'keep-me']]);
    const { context, posted } = await runPlugin(undefined, storage);
    const handler = (context.pixso as any).ui.onmessage;

    await handler({ type: 'plugin-storage-get', key: 'bridgePort' });
    expect(posted.find(message => message.type === 'plugin-storage')).toMatchObject({
      key: 'bridgePort',
      value: '3700'
    });

    await handler({ type: 'plugin-storage-get', key: 'other' });
    await handler({ type: 'plugin-storage-set', key: 'other', value: 'overwritten' });
    expect(posted.filter(message => message.type === 'plugin-storage')).toHaveLength(1);
    expect(storage.get('other')).toBe('keep-me');

    await handler({ type: 'plugin-storage-set', key: 'bridgePort', value: '3701' });
    expect(storage.get('bridgePort')).toBe('3701');
  });

  it('answers health with plugin and document info', async () => {
    const { dispatchCommand } = await runPlugin();
    const response = await dispatchCommand('cmd-1', 'health');
    expect(response?.ok).toBe(true);
    expect(response?.result.plugin.name).toBe('My Pixso MCP');
    expect(response?.result.document.name).toBe('示例文件');
    expect(response?.result.document.currentPageName).toBe('首页');
  });

  it('answers get_document with pages and top frames', async () => {
    const { dispatchCommand } = await runPlugin();
    const response = await dispatchCommand('cmd-2', 'get_document', { maxTopFrames: 10 });
    expect(response?.ok).toBe(true);
    expect(response?.result.file).toMatchObject({ id: 'doc-1', name: '示例文件', pageCount: 2 });
    expect(response?.result.pages).toHaveLength(2);
    const firstPage = response?.result.pages[0];
    expect(firstPage.isCurrent).toBe(true);
    expect(firstPage.topFrames.map((entry: any) => entry.id)).toEqual(['f1', 'f2']);
    expect(firstPage.topFrames[0]).toMatchObject({ name: '登录页', type: 'FRAME', width: 375, height: 812 });
    expect(response?.result.pages[1].topFrameCount).toBe(0);
  });

  it('respects the maxTopFrames limit and marks truncation', async () => {
    const { dispatchCommand } = await runPlugin();
    const response = await dispatchCommand('cmd-3', 'get_document', { maxTopFrames: 1 });
    const firstPage = response?.result.pages[0];
    expect(firstPage.topFrames).toHaveLength(1);
    expect(firstPage.truncated).toBe(true);
    expect(firstPage.topFrameCount).toBe(2);
  });

  it('rejects unknown commands with the known command list', async () => {
    const { dispatchCommand } = await runPlugin();
    const response = await dispatchCommand('cmd-4', 'nope');
    expect(response?.ok).toBe(false);
    expect(response?.error).toContain('Unknown My Pixso MCP command');
    expect(response?.error).toContain('get_document');
  });
});
