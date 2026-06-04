import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { ServerConfig, TransportKind } from './types.js';

const DEFAULT_VERSION = '0.4.0';
const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 11;

export function readPackageVersion(): string {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version?: string };
    return pkg.version ?? DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

export function isSupportedNodeVersion(version: string): boolean {
  const [majorRaw = '', minorRaw = ''] = String(version || '').split('.');
  const major = Number(majorRaw);
  const minor = Number(minorRaw);

  if (!Number.isInteger(major) || !Number.isInteger(minor)) return false;
  if (major > MIN_NODE_MAJOR) return true;
  if (major < MIN_NODE_MAJOR) return false;
  return minor >= MIN_NODE_MINOR;
}

export function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg?.startsWith('--')) continue;
    const raw = arg.slice(2);
    const eqIndex = raw.indexOf('=');
    if (eqIndex >= 0) {
      flags[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags[raw] = next;
      i += 1;
    } else {
      flags[raw] = true;
    }
  }

  return { command, flags };
}

function readNumber(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readString(value: string | boolean | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readTransport(value: string | boolean | undefined): TransportKind {
  return value === 'stdio' ? 'stdio' : 'http';
}

export function buildConfig(flags: Record<string, string | boolean>): ServerConfig {
  const transport = readTransport(flags.transport ?? process.env.PIXSO_ADVANCED_TRANSPORT);
  const sessionTokenFlag = flags.token;
  const envToken = process.env.PIXSO_ADVANCED_SESSION_TOKEN;
  const sessionToken = typeof sessionTokenFlag === 'string' ? sessionTokenFlag : envToken || undefined;

  return {
    transport,
    host: readString(flags.host ?? process.env.PIXSO_ADVANCED_HOST, '127.0.0.1'),
    mcpPort: readNumber(flags['mcp-port'] ?? process.env.PIXSO_ADVANCED_MCP_PORT, 3668),
    wsPort: readNumber(flags['ws-port'] ?? process.env.PIXSO_ADVANCED_WS_PORT, 3669),
    wsPath: readString(flags['ws-path'] ?? process.env.PIXSO_ADVANCED_WS_PATH, '/ws'),
    sessionToken,
    pluginTimeoutMs: readNumber(flags['plugin-timeout-ms'] ?? process.env.PIXSO_ADVANCED_PLUGIN_TIMEOUT_MS, 30_000),
    version: readPackageVersion()
  };
}

export function currentEntryPath(): string {
  if (process.argv[1]) return resolve(process.argv[1]);
  return fileURLToPath(new URL('./index.js', import.meta.url));
}
