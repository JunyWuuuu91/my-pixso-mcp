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

function buildDecorativeFixture() {
  const emojiText = { id: 't1', name: '表情', type: 'TEXT', width: 32, height: 32, characters: '😀' };
  const iconStar = { id: 'v1', name: 'icon-star', type: 'VECTOR', width: 24, height: 24 };
  const screen = {
    id: 'f1',
    name: '首页',
    type: 'FRAME',
    width: 400,
    height: 300,
    children: [
      {
        id: 'g1',
        name: '图标/支付',
        type: 'GROUP',
        width: 40,
        height: 40,
        children: [{ id: 'r1', name: '内部图形', type: 'RECTANGLE', width: 10, height: 10 }]
      },
      { id: 'e1', name: '导出图', type: 'RECTANGLE', width: 60, height: 60, exportSettings: [{ format: 'PNG' }] },
      { id: 'h1', name: 'icon-hidden', type: 'VECTOR', width: 24, height: 24, visible: false },
      { id: 'm1', name: '矢量碎片', type: 'VECTOR', width: 2, height: 1 }
    ]
  };
  const pageA = { id: 'p1', name: '图标页', type: 'PAGE', width: 0, height: 0, children: [emojiText, iconStar, screen] };
  const pageB = { id: 'p2', name: '组件库', type: 'PAGE', width: 0, height: 0, children: [] };
  const svgFrame = {
    id: 'sf1',
    name: 'svg',
    type: 'FRAME',
    width: 22,
    height: 22,
    children: [{ id: 'sf1a', name: '矢量 5901', type: 'VECTOR', width: 0, height: 0 }]
  };
  const svgFrameTwin = {
    id: 'sf2',
    name: 'svg',
    type: 'FRAME',
    width: 22.001,
    height: 22,
    children: [{ id: 'sf2a', name: '矢量 5902', type: 'VECTOR', width: 0, height: 0 }]
  };
  const textChip = {
    id: 'ch1',
    name: '标签',
    type: 'FRAME',
    width: 24,
    height: 24,
    children: [{ id: 'ch1a', name: '文字', type: 'TEXT', width: 20, height: 12, characters: '热门' }]
  };
  const strip = {
    id: 'st1',
    name: '横条',
    type: 'FRAME',
    width: 60,
    height: 20,
    children: [{ id: 'st1a', name: '底', type: 'RECTANGLE', width: 60, height: 20 }]
  };
  const busyFrame = {
    id: 'bz1',
    name: '小容器',
    type: 'FRAME',
    width: 40,
    height: 40,
    children: [1, 2, 3, 4].map(index => ({ id: `bz1${index}`, name: `子${index}`, type: 'RECTANGLE', width: 10, height: 10 }))
  };
  const emptyFrame = { id: 'em1', name: '空框', type: 'FRAME', width: 30, height: 30, children: [] };
  const layoutWrapper = {
    id: 'lw1',
    name: 'div.flex flex-col items-center',
    type: 'FRAME',
    width: 22,
    height: 37,
    children: [{ id: 'lw1a', name: '底', type: 'RECTANGLE', width: 10, height: 10 }]
  };
  const labTest = { id: 'tx1', name: '肿瘤标志物', type: 'TEXT', width: 60, height: 14, characters: '肿瘤标志物' };
  const labFlag = { id: 'tx2', name: '标志', type: 'TEXT', width: 12, height: 12, characters: '标志' };
  const pageC = {
    id: 'p3',
    name: '容器页',
    type: 'PAGE',
    width: 0,
    height: 0,
    children: [svgFrame, svgFrameTwin, textChip, strip, busyFrame, emptyFrame, layoutWrapper, labTest, labFlag]
  };
  return {
    root: { id: 'doc-1', name: '示例文件', children: [pageA, pageB, pageC] },
    currentPage: pageA
  };
}

function buildBulkFixture(count = 100) {
  const screen: any = {
    id: 'f-bulk',
    name: '批量画板',
    type: 'FRAME',
    width: 100,
    height: 100,
    children: Array.from({ length: count }, (_, index) => ({
      id: `bulk-${index}`,
      name: `bulk ${index}`,
      type: 'RECTANGLE',
      width: 10,
      height: 10
    }))
  };
  const page: any = { id: 'p-bulk', name: '批量页', type: 'PAGE', width: 0, height: 0, children: [screen] };
  return { root: { id: 'doc-bulk', name: '批量文件', children: [page] }, currentPage: page };
}

function buildSelectionFixture(selectionNodes?: unknown[]) {
  const page: any = { id: 'p1', name: '首页', type: 'PAGE', width: 0, height: 0, children: [] };
  const screen: any = { id: 'f1', name: '登录页', type: 'FRAME', width: 375, height: 812, children: [], parent: page };
  const emoji: any = { id: 't1', name: '表情', type: 'TEXT', width: 14.2, height: 21, characters: '🎂', parent: screen };
  const icon: any = { id: 'v1', name: '矢量 5714', type: 'VECTOR', width: 23, height: 20, parent: screen };
  const group: any = {
    id: 'g1',
    name: '图标组',
    type: 'GROUP',
    width: 40,
    height: 40,
    parent: screen,
    children: [{ id: 'r1', name: '子图形', type: 'RECTANGLE', width: 10, height: 10 }]
  };
  page.children = [screen];
  screen.children = [emoji, icon, group];
  page.selection = selectionNodes ?? [emoji, icon, group];
  return { root: { id: 'doc-1', name: '示例文件', children: [page] }, currentPage: page };
}

async function runPlugin(
  fixture = buildDocumentFixture(),
  storage = new Map<string, unknown>(),
  options: { withExport?: boolean; withOn?: boolean } = {}
) {
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
  const eventHandlers: Array<{ event: string; handler: () => void }> = [];
  const pollCallbacks: Array<() => void> = [];
  const pendingTimers = new Map<number, () => void>();
  let timerId = 0;
  let clockNow = 1_700_000_000_000;
  const advanceClock = (ms: number) => {
    clockNow += ms;
  };
  const fireTimers = () => {
    const due = [...pendingTimers.entries()].sort((a, b) => a[0] - b[0]);
    pendingTimers.clear();
    for (const [, fn] of due) fn();
  };
  const context = vm.createContext({
    __html__: '<html>ui</html>',
    Date: class SandboxDate {
      static now() {
        return clockNow;
      }
      value = clockNow;
      toISOString() {
        return new Date(this.value).toISOString();
      }
    },
    // The sandbox has no host timers; capturing the poll callback lets a test
    // fire ticks deterministically instead of waiting on real time.
    setInterval(fn: () => void) {
      pollCallbacks.push(fn);
      return pollCallbacks.length;
    },
    clearInterval() {},
    setTimeout(fn: () => void) {
      timerId += 1;
      pendingTimers.set(timerId, fn);
      return timerId;
    },
    clearTimeout(handle: number) {
      pendingTimers.delete(handle as number);
    },
    pixso: {
      showUI(html: string, options?: Record<string, unknown>) {
        showUiCalls.push({ html, options });
      },
      notify() {},
      getNodeById(id: string) {
        const stack: Array<Record<string, unknown>> = [fixture.root as unknown as Record<string, unknown>];
        while (stack.length > 0) {
          const node = stack.pop() as Record<string, unknown>;
          if (node.id === id) return node;
          for (const child of (node.children as Array<Record<string, unknown>> | undefined) ?? []) stack.push(child);
        }
        return undefined;
      },
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
      },
      ...(options.withOn
        ? {
            on(event: string, handler: () => void) {
              eventHandlers.push({ event, handler });
            }
          }
        : {})
    }
  });

  const exportLog: Array<{ id: string; settings: unknown }> = [];
  if (options.withExport) {
    // The bytes must come from the sandbox realm so `instanceof Uint8Array`
    // holds inside the vm context (cross-realm instanceof fails otherwise).
    const sandboxBytes = vm.runInContext('Uint8Array.from([137, 80, 78, 71])', context);
    const attach = (node: any) => {
      node.exportAsync = async (settings: unknown) => {
        exportLog.push({ id: node.id, settings });
        return sandboxBytes;
      };
      (node.children ?? []).forEach(attach);
    };
    fixture.root.children.forEach((page: any) => (page.children ?? []).forEach(attach));
  }

  vm.runInContext(code, context);

  const dispatchCommand = async (id: string, command: string, input: Record<string, unknown> = {}) => {
    const handler = (context.pixso as any).ui.onmessage;
    await handler({ type: 'mcp-command', message: { id, command, input } });
    return posted.find(message => message.response?.id === id)?.response;
  };

  return { context, posted, showUiCalls, dispatchCommand, storage, exportLog, eventHandlers, pollCallbacks, fireTimers, advanceClock };
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

describe('decorative node scan', () => {
  const idsOf = (result: any) => (result.groups as any[]).flatMap(group => group.ids).sort();
  const groupOf = (result: any, id: string) =>
    (result.groups as any[]).find(group => (group.ids as string[]).includes(id));

  it('classifies emoji text, small graphics, export settings and name hints', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('scan-1', 'find_decorative_nodes', { page: '图标页' });
    expect(response?.ok).toBe(true);
    expect(response?.result.page).toMatchObject({ id: 'p1', name: '图标页' });

    const result = response?.result;
    expect(idsOf(result)).toEqual(['e1', 'g1', 't1', 'v1']);
    expect(groupOf(result, 't1').reasons).toEqual(['emoji-text', 'name-hint']);
    expect(groupOf(result, 't1').emoji).toBe('😀');
    expect(groupOf(result, 'v1').reasons).toEqual(['small-graphic', 'name-hint']);
    expect(groupOf(result, 'g1').reasons).toEqual(['small-graphic', 'name-hint']);
    expect(groupOf(result, 'e1').reasons).toEqual(['export-setting']);

    // Matched candidates are not descended into, invisible nodes are skipped.
    // Micro vector fragments are filtered by the default 8px minimum.
    expect(idsOf(result).filter(id => ['r1', 'h1', 'm1'].includes(id))).toEqual([]);
  });

  it('keeps micro fragments when minNodeSizePx is lowered', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('scan-6', 'find_decorative_nodes', { page: '图标页', minNodeSizePx: 1 });
    expect(response?.ok).toBe(true);
    expect(idsOf(response?.result)).toContain('m1');
  });

  it('resolves pages by name substring and rejects unknown pages', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());

    const partial = await dispatchCommand('scan-2', 'find_decorative_nodes', { page: '图标' });
    expect(partial?.ok).toBe(true);
    expect(partial?.result.page.name).toBe('图标页');

    const unknown = await dispatchCommand('scan-3', 'find_decorative_nodes', { page: '不存在' });
    expect(unknown?.ok).toBe(false);
    expect(unknown?.error).toContain('Page "不存在" not found');
    expect(unknown?.error).toContain('"图标页"');
    expect(unknown?.error).toContain('"组件库"');
  });

  it('caps the candidate list and reports truncation', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('scan-4', 'find_decorative_nodes', { page: '图标页', maxCandidates: 2 });
    expect(response?.ok).toBe(true);
    expect(response?.result.candidateCount).toBe(2);
    expect(idsOf(response?.result)).toHaveLength(2);
    expect(response?.result.truncatedCandidates).toBe(true);
  });

  it('proposes a scale from the median candidate size', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('scan-5', 'find_decorative_nodes', { page: '图标页' });
    const proposal = response?.result.scaleProposal;
    // Candidate edges 24/32/40/60 → lower median 32; 3x lands nearest 128px.
    expect(proposal.medianSizePx).toBe(32);
    expect(proposal.recommended).toBe(3);
    expect(proposal.options.map((option: any) => option.typicalPx)).toEqual([32, 64, 96]);
  });

  it('collapses repeated icon containers into one group and keeps every id', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('scan-7', 'find_decorative_nodes', { page: '容器页' });
    expect(response?.ok).toBe(true);
    const result = response?.result;

    // svgFrame is 22px wide and its twin 22.001px — sub-pixel noise must not split them.
    expect(result.groups).toHaveLength(2);
    const svgGroup = groupOf(result, 'sf1');
    expect(svgGroup).toMatchObject({ name: 'svg', type: 'FRAME', width: 22, count: 2, reasons: ['name-hint'] });
    expect(svgGroup.ids).toEqual(['sf1', 'sf2']);
    expect(idsOf(result)).toEqual(['sf1', 'sf2', 'tx2']);

    // Small layout containers must not be mistaken for icons.
    expect(idsOf(result).filter(id => ['ch1', 'st1', 'bz1', 'em1', 'lw1', 'lw1a', 'sf1a', 'sf2a'].includes(id))).toEqual(
      []
    );
  });

  it('no longer reads lab names as name hints', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('scan-8', 'find_decorative_nodes', { page: '容器页' });
    const result = response?.result;
    expect(idsOf(result)).not.toContain('tx1');
    expect(groupOf(result, 'tx2').reasons).toEqual(['name-hint']);
  });
});

describe('decorative node export', () => {
  function nodeById(fixture: ReturnType<typeof buildDecorativeFixture>, id: string): any {
    for (const page of fixture.root.children) {
      const stack = [...page.children];
      while (stack.length > 0) {
        const node = stack.pop() as any;
        if (node.id === id) return node;
        for (const child of node.children ?? []) stack.push(child);
      }
    }
    throw new Error(`fixture node ${id} not found`);
  }

  it('exports nodes as base64 PNG bytes', async () => {
    const { dispatchCommand, exportLog } = await runPlugin(buildDecorativeFixture(), undefined, { withExport: true });
    const response = await dispatchCommand('export-1', 'export_nodes_png', { nodeIds: ['v1', 'e1'], scale: 2 });
    expect(response?.ok).toBe(true);
    expect(response?.result.scale).toBe(2);
    expect(response?.result.skipped).toEqual([]);
    expect(response?.result.exported).toHaveLength(2);

    const expectedBase64 = Buffer.from([137, 80, 78, 71]).toString('base64');
    const star = response?.result.exported.find((entry: any) => entry.id === 'v1');
    expect(star.fileNameSafe).toBe('icon-star');
    expect(star.bytesBase64).toBe(expectedBase64);
    expect(Buffer.from(star.bytesBase64, 'base64')).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(response?.result.totalBase64Bytes).toBe(expectedBase64.length * 2);

    expect(exportLog.map(entry => entry.id)).toEqual(['v1', 'e1']);
    expect(exportLog[0]?.settings).toEqual({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
  });

  it('skips node ids that do not resolve', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture(), undefined, { withExport: true });
    const response = await dispatchCommand('export-2', 'export_nodes_png', { nodeIds: ['nope'], scale: 1 });
    expect(response?.ok).toBe(true);
    expect(response?.result.exported).toEqual([]);
    expect(response?.result.skipped).toEqual([{ id: 'nope', reason: 'not found in this document' }]);
  });

  it('fails fast when exportAsync is missing', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('export-3', 'export_nodes_png', { nodeIds: ['v1'], scale: 1 });
    expect(response?.ok).toBe(false);
    expect(response?.error).toContain('node.exportAsync is not available');
  });

  it('keeps both error messages when every export shape fails', async () => {
    const fixture = buildDecorativeFixture();
    nodeById(fixture, 'v1').exportAsync = async (settings: any) => {
      throw new Error(settings.constraint ? 'constraint-shape-failed' : 'scale-shape-failed');
    };
    const { dispatchCommand } = await runPlugin(fixture);
    const response = await dispatchCommand('export-4', 'export_nodes_png', { nodeIds: ['v1'], scale: 1 });
    expect(response?.ok).toBe(true);
    expect(response?.result.exported).toEqual([]);
    const reason = response?.result.skipped[0]?.reason as string;
    expect(reason).toContain('constraint-shape-failed');
    expect(reason).toContain('scale-shape-failed');
  });

  it('skips a hung exportAsync instead of losing the whole batch', async () => {
    const fixture = buildDecorativeFixture();
    const { dispatchCommand, fireTimers } = await runPlugin(fixture, undefined, { withExport: true });
    nodeById(fixture, 'v1').exportAsync = () => new Promise(() => {});

    const pending = dispatchCommand('export-8', 'export_nodes_png', { nodeIds: ['v1', 'e1'], scale: 1 });
    for (let tick = 0; tick < 4; tick += 1) {
      await new Promise(resolve => setImmediate(resolve));
      fireTimers();
    }
    const response = await pending;

    expect(response?.ok).toBe(true);
    expect(response?.result.exported.map((entry: any) => entry.id)).toEqual(['e1']);
    expect(response?.result.skipped[0]?.reason).toContain('exportAsync timed out');
    expect(response?.result.timing).toMatchObject({ budgetReached: false });
  });

  it('stops the batch after repeated timeouts instead of burning every node', async () => {
    const fixture = buildDecorativeFixture();
    const { dispatchCommand, fireTimers } = await runPlugin(fixture, undefined, { withExport: true });
    for (const id of ['v1', 't1', 'g1']) nodeById(fixture, id).exportAsync = () => new Promise(() => {});

    const pending = dispatchCommand('export-9', 'export_nodes_png', { nodeIds: ['v1', 't1', 'g1', 'e1'], scale: 1 });
    for (let tick = 0; tick < 12; tick += 1) {
      await new Promise(resolve => setImmediate(resolve));
      fireTimers();
    }
    const response = await pending;

    expect(response?.ok).toBe(true);
    expect(response?.result.exported).toEqual([]);
    const skipped = response?.result.skipped;
    expect(skipped.map((entry: any) => entry.id)).toEqual(['v1', 't1', 'g1', 'e1']);
    expect(skipped.slice(0, 3).every((entry: any) => entry.reason.includes('exportAsync timed out'))).toBe(true);
    expect(skipped[3].reason).toContain('not attempted');
    expect(response?.result.aborted).toContain('3 exports timed out in a row');
  });

  it('refuses ids once the export count reaches the saturation cliff', async () => {
    const { dispatchCommand, exportLog } = await runPlugin(buildBulkFixture(), undefined, { withExport: true });
    const range = (start: number, end: number) => Array.from({ length: end - start }, (_, i) => `bulk-${start + i}`);

    const first = await dispatchCommand('export-s1', 'export_nodes_png', { nodeIds: range(0, 40), scale: 1 });
    expect(first?.result.exported).toHaveLength(40);
    expect(first?.result.rendererGuard).toEqual({ exportsSinceRecovery: 40, threshold: 90, earlyStopped: 0 });

    const second = await dispatchCommand('export-s2', 'export_nodes_png', { nodeIds: range(40, 80), scale: 1 });
    expect(second?.result.rendererGuard).toEqual({ exportsSinceRecovery: 80, threshold: 90, earlyStopped: 0 });

    const third = await dispatchCommand('export-s3', 'export_nodes_png', { nodeIds: range(80, 100), scale: 1 });
    expect(third?.result.exported).toHaveLength(10);
    const skipped = third?.result.skipped ?? [];
    expect(skipped).toHaveLength(10);
    expect(skipped.every((entry: any) => entry.reason.includes('renderer near saturation'))).toBe(true);
    expect(third?.result.rendererGuard).toEqual({ exportsSinceRecovery: 90, threshold: 90, earlyStopped: 10 });
    expect(exportLog).toHaveLength(90);
  });

  it('resets the saturation counter only after the full recovery gap', async () => {
    const { dispatchCommand, advanceClock } = await runPlugin(buildDecorativeFixture(), undefined, { withExport: true });

    const before = await dispatchCommand('export-r1', 'export_nodes_png', { nodeIds: ['v1', 'e1'], scale: 1 });
    expect(before?.result.rendererGuard).toEqual({ exportsSinceRecovery: 2, threshold: 90, earlyStopped: 0 });

    advanceClock(29_999);
    const underGap = await dispatchCommand('export-r2', 'export_nodes_png', { nodeIds: ['v1', 'e1'], scale: 1 });
    expect(underGap?.result.rendererGuard).toEqual({ exportsSinceRecovery: 4, threshold: 90, earlyStopped: 0 });

    advanceClock(30_000);
    const afterGap = await dispatchCommand('export-r3', 'export_nodes_png', { nodeIds: ['v1', 'e1'], scale: 1 });
    expect(afterGap?.result.rendererGuard).toEqual({ exportsSinceRecovery: 2, threshold: 90, earlyStopped: 0 });
  });

  it('pins the counter when the breaker trips so the next command refuses immediately', async () => {
    const fixture = buildDecorativeFixture();
    const { dispatchCommand, exportLog, fireTimers, advanceClock } = await runPlugin(fixture, undefined, {
      withExport: true
    });
    for (const id of ['v1', 't1', 'g1']) nodeById(fixture, id).exportAsync = () => new Promise(() => {});

    const pending = dispatchCommand('export-b1', 'export_nodes_png', { nodeIds: ['v1', 't1', 'g1'], scale: 1 });
    for (let tick = 0; tick < 12; tick += 1) {
      await new Promise(resolve => setImmediate(resolve));
      fireTimers();
    }
    const tripped = await pending;
    expect(tripped?.result.aborted).toContain('3 exports timed out in a row');

    const immediate = await dispatchCommand('export-b2', 'export_nodes_png', { nodeIds: ['e1'], scale: 1 });
    expect(immediate?.result.exported).toEqual([]);
    expect(immediate?.result.skipped[0]?.reason).toContain('renderer near saturation');
    expect(exportLog).toHaveLength(0);

    advanceClock(30_000);
    const recovered = await dispatchCommand('export-b3', 'export_nodes_png', { nodeIds: ['e1'], scale: 1 });
    expect(recovered?.result.exported.map((entry: any) => entry.id)).toEqual(['e1']);
    expect(exportLog).toHaveLength(1);
  });

  it('normalizes plain number arrays into bytes', async () => {
    const fixture = buildDecorativeFixture();
    nodeById(fixture, 'v1').exportAsync = async () => [137, 80, 78, 71];
    const { dispatchCommand } = await runPlugin(fixture);
    const response = await dispatchCommand('export-5', 'export_nodes_png', { nodeIds: ['v1'], scale: 1 });
    expect(response?.ok).toBe(true);
    expect(response?.result.exported[0].bytesBase64).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'));
  });

  it('skips images over the per-image cap without truncating', async () => {
    const fixture = buildDecorativeFixture();
    const { context, dispatchCommand } = await runPlugin(fixture);
    nodeById(fixture, 'v1').exportAsync = async () => vm.runInContext('new Uint8Array(2097153)', context);
    const response = await dispatchCommand('export-6', 'export_nodes_png', { nodeIds: ['v1'], scale: 3 });
    expect(response?.ok).toBe(true);
    expect(response?.result.exported).toEqual([]);
    expect(response?.result.skipped[0].reason).toContain('image too large');
  });

  it('aborts when the cumulative base64 payload exceeds the cap', async () => {
    const fixture = buildDecorativeFixture();
    const { context, dispatchCommand } = await runPlugin(fixture);
    // Five 2MB images pass the per-image cap, but their base64 (5 × ~2.67MB)
    // exceeds the 12MB cumulative cap on the fifth node.
    const huge = vm.runInContext('new Uint8Array(2000000)', context);
    for (const id of ['v1', 'g1', 'e1', 't1', 'f1']) {
      nodeById(fixture, id).exportAsync = async () => huge;
    }
    const response = await dispatchCommand('export-7', 'export_nodes_png', {
      nodeIds: ['v1', 'g1', 'e1', 't1', 'f1'],
      scale: 1
    });
    expect(response?.ok).toBe(true);
    expect(response?.result.exported).toHaveLength(4);
    expect(response?.result.aborted).toContain('total payload cap');
    expect(response?.result.skipped.some((entry: any) => entry.id === 'f1')).toBe(true);
  }, 20_000);
});

describe('canvas selection', () => {
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const pushes = (posted: UiMessage[]) => posted.filter(message => message.type === 'plugin-selection') as any[];

  it('reports selected nodes with their ancestor path', async () => {
    const { dispatchCommand } = await runPlugin(buildSelectionFixture());
    const response = await dispatchCommand('sel-1', 'get_selection');
    expect(response?.ok).toBe(true);
    expect(response?.result.file).toMatchObject({ id: 'doc-1', name: '示例文件' });
    expect(response?.result.page).toMatchObject({ id: 'p1', name: '首页' });
    expect(response?.result.count).toBe(3);
    expect(response?.result.selectionMode).toBe('poll');
    expect(response?.result.nodes.map((node: any) => node.id)).toEqual(['t1', 'v1', 'g1']);
    expect(response?.result.nodes[0]).toMatchObject({
      name: '表情',
      type: 'TEXT',
      width: 14.2,
      height: 21,
      path: ['首页', '登录页']
    });
    expect(response?.result.nodes[0].childCount).toBeUndefined();
    expect(response?.result.nodes[2].childCount).toBe(1);
  });

  it('caps the node list and marks truncation', async () => {
    const { dispatchCommand } = await runPlugin(buildSelectionFixture());
    const response = await dispatchCommand('sel-2', 'get_selection', { maxNodes: 2 });
    expect(response?.ok).toBe(true);
    expect(response?.result.nodes).toHaveLength(2);
    expect(response?.result.count).toBe(3);
    expect(response?.result.truncated).toBe(true);
  });

  it('answers with a note when nothing is selected', async () => {
    const { dispatchCommand } = await runPlugin(buildSelectionFixture([]));
    const response = await dispatchCommand('sel-3', 'get_selection');
    expect(response?.ok).toBe(true);
    expect(response?.result.count).toBe(0);
    expect(response?.result.nodes).toEqual([]);
    expect(response?.result.note).toContain('Nothing is selected');
  });

  it('fails with a capability diagnostic when selection is unreadable', async () => {
    const { dispatchCommand } = await runPlugin();
    const response = await dispatchCommand('sel-4', 'get_selection');
    expect(response?.ok).toBe(false);
    expect(response?.error).toContain('selection is not available');
    expect(response?.error).toContain('editorType=unknown');
  });

  it('pushes on request and then only when the selection changes', async () => {
    const fixture = buildSelectionFixture();
    const { context, posted, pollCallbacks } = await runPlugin(fixture);
    const handler = (context.pixso as any).ui.onmessage;

    await handler({ type: 'plugin-selection-request' });
    expect(pushes(posted)).toHaveLength(1);
    expect(pushes(posted)[0].selection.nodes).toHaveLength(3);

    expect(pollCallbacks.length).toBe(1);
    pollCallbacks[0]();
    await flush();
    expect(pushes(posted)).toHaveLength(1);

    fixture.currentPage.selection = [fixture.currentPage.selection[1]];
    pollCallbacks[0]();
    await flush();
    const latest = pushes(posted).at(-1);
    expect(latest.selection.nodes.map((node: any) => node.id)).toEqual(['v1']);
  });

  it('subscribes to the selection-change event when Pixso provides it', async () => {
    const { context, posted, eventHandlers } = await runPlugin(buildSelectionFixture(), undefined, { withOn: true });
    expect(eventHandlers.map(entry => entry.event)).toEqual(['currentselectionchange']);

    const handler = (context.pixso as any).ui.onmessage;
    await handler({ type: 'plugin-env-request' });
    expect((posted.find(message => message.type === 'plugin-env') as any).env).toMatchObject({
      selectionMode: 'event',
      hasSelectionApi: true
    });

    eventHandlers[0].handler();
    await flush();
    expect(pushes(posted)[0].selection.selectionMode).toBe('event');
  });

  it('falls back to polling when Pixso exposes no event API', async () => {
    const { context, posted } = await runPlugin(buildSelectionFixture());
    const handler = (context.pixso as any).ui.onmessage;
    await handler({ type: 'plugin-env-request' });
    expect((posted.find(message => message.type === 'plugin-env') as any).env.selectionMode).toBe('poll');
  });

  it('lists get_selection in the known command list', async () => {
    const { dispatchCommand } = await runPlugin();
    const response = await dispatchCommand('sel-5', 'nope');
    expect(response?.error).toContain('get_selection');
  });
});

describe('node probe', () => {
  it('summarizes immediate children so nested vectors are inspectable', async () => {
    const { dispatchCommand } = await runPlugin(buildDecorativeFixture());
    const response = await dispatchCommand('probe-1', 'probe_api', { nodeIds: ['sf1'] });
    expect(response?.ok).toBe(true);
    const node = response?.result.nodes[0];
    expect(node.childTypes).toEqual({ VECTOR: 1 });
    expect(node.children).toHaveLength(1);
    expect(node.children[0]).toMatchObject({ id: 'sf1a', type: 'VECTOR', width: 0, height: 0 });
  });
});
