import type { ServerConfig, Transport } from './types.js';

export const VERSION = '0.1.0';

export const DEFAULTS = {
  host: '127.0.0.1',
  mcpPort: 3678,
  wsPort: 3679,
  wsPath: '/ws',
  pluginTimeoutMs: 30_000,
  authTimeoutMs: 5_000
};

export interface ServeArgs {
  transport: Transport;
  config: ServerConfig;
}

function fail(message: string): never {
  process.stderr.write(`my-pixso-mcp: ${message}\n`);
  process.exit(1);
}

export function parseServeArgs(argv: string[]): ServeArgs {
  const args: Partial<ServeArgs> = { transport: 'http' };
  const config: Partial<ServerConfig> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    const next = (): string => {
      const value = argv[i + 1];
      if (value === undefined) fail(`missing value for ${arg}`);
      i += 1;
      return value as string;
    };

    switch (arg) {
      case '--transport': {
        const value = next();
        if (value !== 'http' && value !== 'stdio') fail(`--transport must be http or stdio, got ${value}`);
        args.transport = value;
        break;
      }
      case '--host':
        config.host = next();
        break;
      case '--mcp-port':
        config.mcpPort = Number(next());
        break;
      case '--ws-port':
        config.wsPort = Number(next());
        break;
      case '--token':
        config.sessionToken = next();
        break;
      case '--plugin-timeout-ms':
        config.pluginTimeoutMs = Number(next());
        break;
      default:
        fail(`unknown option ${arg}`);
    }
  }

  if (Number.isNaN(config.mcpPort) || Number.isNaN(config.wsPort) || Number.isNaN(config.pluginTimeoutMs)) {
    fail('port and timeout options must be numbers');
  }

  return {
    transport: args.transport ?? 'http',
    config: {
      host: config.host ?? DEFAULTS.host,
      mcpPort: config.mcpPort ?? DEFAULTS.mcpPort,
      wsPort: config.wsPort ?? DEFAULTS.wsPort,
      wsPath: DEFAULTS.wsPath,
      sessionToken: config.sessionToken,
      pluginTimeoutMs: config.pluginTimeoutMs ?? DEFAULTS.pluginTimeoutMs,
      authTimeoutMs: DEFAULTS.authTimeoutMs,
      version: VERSION
    }
  };
}
