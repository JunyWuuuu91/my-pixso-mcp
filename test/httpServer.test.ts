import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startBridgeServer, type BridgeServer } from '../src/bridge/wsServer.js';
import { runHttpServer, type HttpServerHandle } from '../src/server/http.js';
import type { ServerConfig } from '../src/types.js';
import type { Logger } from '../src/logger.js';

const silentLogger: Logger = { info() {}, warn() {}, error() {} };

const config: ServerConfig = {
  host: '127.0.0.1',
  mcpPort: 0,
  wsPort: 0,
  wsPath: '/ws',
  pluginTimeoutMs: 5_000,
  authTimeoutMs: 1_000,
  version: 'test'
};

const DOCUMENT_FIXTURE = {
  file: { id: 'doc-1', name: '集成测试文件', pageCount: 1 },
  currentPageId: 'p1',
  pages: [{ id: 'p1', name: '首页', isCurrent: true, topFrameCount: 1, topFrames: [{ id: 'f1', name: '登录页', type: 'FRAME', width: 375, height: 812 }], truncated: false }]
};

const FIND_DECORATIVE_FIXTURE = {
  file: { name: '集成测试文件' },
  page: { id: 'p1', name: '首页' },
  visited: 3,
  truncatedVisited: false,
  candidates: [{ id: 'v1', name: 'icon-star', type: 'VECTOR', width: 24, height: 24, reasons: ['small-graphic', 'name-hint'] }],
  candidateCount: 1,
  truncatedCandidates: false,
  scaleProposal: {
    medianSizePx: 24,
    recommended: 3,
    options: [{ scale: 1, typicalPx: 24 }, { scale: 2, typicalPx: 48 }, { scale: 3, typicalPx: 72 }],
    rationale: 'fixture'
  }
};

const SELECTION_FIXTURE = {
  file: { id: 'doc-1', name: '集成测试文件' },
  page: { id: 'p1', name: '首页' },
  selectionMode: 'poll',
  count: 2,
  nodes: [
    { id: 't1', name: '🎂', type: 'TEXT', width: 14.2, height: 21, path: ['首页', '登录页'] },
    { id: 'v1', name: 'icon-star', type: 'VECTOR', width: 24, height: 24, childCount: 0, path: ['首页'] }
  ],
  truncated: false
};

const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_BASE64 = Buffer.from(PNG_BYTES).toString('base64');

const EXPORT_FIXTURE = {
  file: { name: '集成测试文件' },
  page: { id: 'p1', name: '首页' },
  scale: 2,
  exported: [{ id: 'v1', name: 'icon-star', fileNameSafe: 'icon-star', bytesBase64: PNG_BASE64, byteLength: PNG_BYTES.length }],
  skipped: [],
  totalBase64Bytes: PNG_BASE64.length
};

let bridge: BridgeServer;
let http: HttpServerHandle;
let pluginSocket: WebSocket;
const exportDirs: string[] = [];

function openPluginSocket(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${config.wsPath}?client=test-plugin`);
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', plugin: { name: 'Fake Pixso Plugin', version: 'test' } }));
      resolve(socket);
    });
    socket.on('error', reject);
  });
}

async function mcpRequest(body: Record<string, unknown>, sessionId?: string): Promise<{ status: number; headers: Headers; body: any }> {
  const response = await fetch(`http://127.0.0.1:${http.port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

beforeAll(async () => {
  bridge = await startBridgeServer(config, silentLogger);
  http = await runHttpServer(config, bridge, silentLogger);
  pluginSocket = await openPluginSocket(bridge.wsPort);
  pluginSocket.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (typeof message.id !== 'string' || typeof message.command !== 'string') return;
    if (message.command === 'health') {
      pluginSocket.send(JSON.stringify({ id: message.id, ok: true, result: { ok: true, fake: true } }));
    } else if (message.command === 'get_document') {
      pluginSocket.send(JSON.stringify({ id: message.id, ok: true, result: DOCUMENT_FIXTURE }));
    } else if (message.command === 'find_decorative_nodes') {
      pluginSocket.send(JSON.stringify({ id: message.id, ok: true, result: FIND_DECORATIVE_FIXTURE }));
    } else if (message.command === 'get_selection') {
      pluginSocket.send(JSON.stringify({ id: message.id, ok: true, result: SELECTION_FIXTURE }));
    } else if (message.command === 'export_nodes_png') {
      pluginSocket.send(JSON.stringify({ id: message.id, ok: true, result: EXPORT_FIXTURE }));
    } else {
      pluginSocket.send(JSON.stringify({ id: message.id, ok: false, error: `unknown command ${message.command}` }));
    }
  });
  await new Promise(resolve => setTimeout(resolve, 100));
});

afterAll(async () => {
  pluginSocket.close();
  await http.close();
  for (const dir of exportDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('HTTP MCP server + WS bridge', () => {
  it('exposes the /health status route', async () => {
    const response = await fetch(`http://127.0.0.1:${http.port}/health`);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.plugin.connected).toBe(true);
    expect(body.plugin.sessions).toHaveLength(1);
  });

  it('lists health and get_document tools after initialize', async () => {
    const init = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'integration-test', version: '1.0' }
      }
    });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe('my-pixso-mcp');
    const sessionId = init.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId ?? undefined);

    const list = await mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, sessionId ?? undefined);
    const toolNames = list.body.result.tools.map((tool: any) => tool.name).sort();
    expect(toolNames).toEqual(['export_nodes_png', 'find_decorative_nodes', 'get_document', 'get_selection', 'health', 'probe_api']);
  });

  it('calls get_document end to end through the fake plugin', async () => {
    const init = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'integration-test', version: '1.0' } }
    });
    const sessionId = init.headers.get('mcp-session-id') ?? undefined;
    await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);

    const call = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_document', arguments: { maxTopFrames: 5 } }
      },
      sessionId
    );
    expect(call.status).toBe(200);
    expect(call.body.result.isError).toBeFalsy();
    const text = call.body.result.content[0].text;
    const payload = JSON.parse(text);
    expect(payload.file.name).toBe('集成测试文件');
    expect(payload.pages[0].topFrames[0].name).toBe('登录页');
  });

  it('aggregates the plugin probe into the health tool result', async () => {
    const init = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'integration-test', version: '1.0' } }
    });
    const sessionId = init.headers.get('mcp-session-id') ?? undefined;
    await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);

    const call = await mcpRequest(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'health', arguments: {} } },
      sessionId
    );
    expect(call.status).toBe(200);
    const payload = JSON.parse(call.body.result.content[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.pluginProbe).toMatchObject({ ok: true, fake: true });
  });

  it('proxies find_decorative_nodes to the plugin', async () => {
    const init = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'integration-test', version: '1.0' } }
    });
    const sessionId = init.headers.get('mcp-session-id') ?? undefined;
    await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);

    const call = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'find_decorative_nodes', arguments: { page: '首页' } }
      },
      sessionId
    );
    expect(call.status).toBe(200);
    expect(call.body.result.isError).toBeFalsy();
    const payload = JSON.parse(call.body.result.content[0].text);
    expect(payload.candidates[0]).toMatchObject({ id: 'v1', name: 'icon-star' });
    expect(payload.scaleProposal.recommended).toBe(3);
  });

  it('proxies get_selection to the plugin', async () => {
    const init = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'integration-test', version: '1.0' } }
    });
    const sessionId = init.headers.get('mcp-session-id') ?? undefined;
    await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);

    const call = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'get_selection', arguments: { maxNodes: 4 } }
      },
      sessionId
    );
    expect(call.status).toBe(200);
    expect(call.body.result.isError).toBeFalsy();
    const payload = JSON.parse(call.body.result.content[0].text);
    expect(payload.page.name).toBe('首页');
    expect(payload.selectionMode).toBe('poll');
    expect(payload.nodes.map((node: any) => node.id)).toEqual(['t1', 'v1']);
    expect(payload.nodes[0].path).toEqual(['首页', '登录页']);
  });

  it('writes exported PNGs to the output directory end to end', async () => {
    const init = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'integration-test', version: '1.0' } }
    });
    const sessionId = init.headers.get('mcp-session-id') ?? undefined;
    await mcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId);

    const outputDir = mkdtempSync(path.join(os.tmpdir(), 'pixso-export-'));
    exportDirs.push(outputDir);

    const call = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'export_nodes_png', arguments: { nodeIds: ['v1'], scale: 2, outputDir } }
      },
      sessionId
    );
    expect(call.status).toBe(200);
    expect(call.body.result.isError).toBeFalsy();
    const payload = JSON.parse(call.body.result.content[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.count).toBe(1);
    expect(payload.totalBytes).toBe(PNG_BYTES.length);

    const written = payload.written[0];
    expect(path.basename(written.path)).toBe('icon-star-v1@2x.png');
    expect(readFileSync(written.path)).toEqual(Buffer.from(PNG_BYTES));

    // Re-exporting collides with the existing file and gets a -2 suffix.
    const again = await mcpRequest(
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'export_nodes_png', arguments: { nodeIds: ['v1'], scale: 2, outputDir } }
      },
      sessionId
    );
    const againPayload = JSON.parse(again.body.result.content[0].text);
    expect(path.basename(againPayload.written[0].path)).toBe('icon-star-v1@2x-2.png');
  });
});
