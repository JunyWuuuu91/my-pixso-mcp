#!/usr/bin/env node
// Zero-dependency probe for Pixso's local (desktop client) MCP endpoint.
// Requires the Pixso desktop app running with MCP enabled.
//
//   node scripts/probe-mcp.mjs url                     # handshake + serverInfo
//   node scripts/probe-mcp.mjs tools                   # list all tools
//   node scripts/probe-mcp.mjs call <tool> [jsonArgs]  # call a tool, report size + timing
//   node scripts/probe-mcp.mjs size <tool> [jsonArgs]  # call a tool, print char counts only

const DEFAULT_URL = process.env.PIXSO_MCP_URL || 'http://127.0.0.1:3667/mcp';

let endpoint = DEFAULT_URL;
let sessionId = null;
let nextId = 1;

async function rpc(method, params, isNotification = false) {
  const body = { jsonrpc: '2.0', method, params };
  if (!isNotification) body.id = nextId++;
  else delete body.params;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!sessionId) sessionId = res.headers.get('mcp-session-id');
  if (!res.ok && res.status !== 202) throw new Error(`${method} -> HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const text = await res.text();
  if (isNotification || !text.trim()) return null;
  const dataLine = text.split('\n').find(line => line.startsWith('data: '));
  const payload = JSON.parse(dataLine ? dataLine.slice(6) : text);
  if (payload.error) throw new Error(`${method} -> ${JSON.stringify(payload.error)}`);
  return payload.result;
}

async function connect() {
  const info = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'pixso-mcp-probe', version: '1.0.0' },
  });
  await rpc('notifications/initialized', undefined, true);
  return info;
}

function flatten(result) {
  const parts = (result?.content || []).map(item => {
    if (typeof item.text === 'string') return item.text;
    if (item.type === 'image') return `[image ${item.mimeType} ${(item.data || '').length}b base64]`;
    return `[${item.type}]`;
  });
  return parts.join('\n') || JSON.stringify(result);
}

const argv = process.argv.slice(2);
if (argv[0] === '--url' || argv[0] === '-u') {
  if (!argv[1]) {
    console.error('--url needs a value');
    process.exit(2);
  }
  endpoint = argv[1];
  argv.splice(0, 2);
}
const [command = 'url', ...rest] = argv;

const args = rest.length > 1 ? JSON.parse(rest.slice(1).join(' ')) : {};
const info = await connect();

switch (command) {
  case 'url':
    console.log(JSON.stringify({ endpoint, serverInfo: info.serverInfo, protocolVersion: info.protocolVersion, sessionId }, null, 2));
    break;
  case 'tools': {
    const { tools } = await rpc('tools/list', {});
    for (const tool of tools) {
      console.log(`${tool.name}\t${Object.keys(tool.inputSchema?.properties || {}).join(',')}`);
    }
    console.error(`\n${tools.length} tools @ ${endpoint}`);
    break;
  }
  case 'call':
  case 'size': {
    const name = rest[0];
    if (!name) throw new Error('usage: probe-mcp.mjs call <tool> [jsonArgs]');
    const started = Date.now();
    const result = await rpc('tools/call', { name, arguments: args });
    const text = flatten(result);
    const ms = Date.now() - started;
    if (command === 'size') {
      console.log(JSON.stringify({ tool: name, ms, chars: text.length, approxTokens: Math.round(text.length / 3.2), isError: !!result?.isError }));
    } else {
      console.log(`# ${name} · ${ms}ms · ${text.length} chars\n${text}`);
    }
    break;
  }
  default:
    throw new Error(`unknown command: ${command}`);
}
