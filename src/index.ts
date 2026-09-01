#!/usr/bin/env node
import { parseServeArgs, VERSION } from './config.js';
import { logger } from './logger.js';
import { startBridgeServer } from './bridge/wsServer.js';
import { runHttpServer } from './server/http.js';
import { runStdioServer } from './server/stdio.js';

const HELP = `my-pixso-mcp ${VERSION}

Usage:
  my-pixso-mcp serve [options]

Options:
  --transport <http|stdio>   MCP transport (default: http)
  --host <host>              bind host (default: 127.0.0.1)
  --mcp-port <port>          MCP HTTP port (default: 3678)
  --ws-port <port>           Pixso plugin WS bridge port (default: 3679)
  --token <token>            require this token from the plugin (first WS message)
  --plugin-timeout-ms <ms>   plugin command timeout (default: 30000)

HTTP transport endpoints:
  MCP:  http://127.0.0.1:<mcp-port>/mcp
  WS:   ws://127.0.0.1:<ws-port>/ws
`;

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === 'serve') {
    const { transport, config } = parseServeArgs(process.argv.slice(3));
    const bridge = await startBridgeServer(config, logger);
    if (transport === 'http') {
      await runHttpServer(config, bridge, logger);
    } else {
      await runStdioServer(config, bridge, logger);
    }
    return;
  }

  if (command === 'help' || command === '--help' || command === undefined) {
    process.stdout.write(HELP);
    return;
  }

  process.stderr.write(`my-pixso-mcp: unknown command ${command}\n\n${HELP}`);
  process.exit(1);
}

main().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.stack ?? error.message : String(error) });
  process.exit(1);
});
