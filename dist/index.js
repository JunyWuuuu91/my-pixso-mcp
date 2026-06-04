#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig, currentEntryPath, isSupportedNodeVersion, parseArgs } from './config.js';
import { defaultCodexConfigPath, hasPixsoCodexConfig, installCodexConfig, renderCodexConfigSnippet } from './codexConfig.js';
import { logger } from './logger.js';
import { startBridgeServer } from './bridge/wsServer.js';
import { runHttpServer } from './server/http.js';
import { runStdioServer } from './server/stdio.js';
function printHelp() {
    console.log(`pixso-advanced-mcp

Commands:
  serve [--transport http|stdio] [--host 127.0.0.1] [--mcp-port 3668] [--ws-port 3669] [--token TOKEN]
  print-codex-config [--transport http|stdio]
  install-codex-config [--transport http|stdio] [--config PATH] [--write]
  quickstart [--transport http|stdio]
  plugin-path
  doctor
  help

Examples:
  pixso-advanced-mcp serve
  pixso-advanced-mcp install-codex-config --transport http --write
  pixso-advanced-mcp print-codex-config --transport stdio
`);
}
function repoRootFromDistEntry() {
    const entryDir = dirname(fileURLToPath(import.meta.url));
    return resolve(entryDir, '..');
}
function pluginManifestPath() {
    return resolve(repoRootFromDistEntry(), 'pixso-plugin', 'manifest.json');
}
function printCodexConfig(flags) {
    const config = buildConfig(flags);
    const entryPath = currentEntryPath();
    console.log(renderCodexConfigSnippet(config, entryPath));
}
function readFlagString(flags, name, fallback) {
    const value = flags[name];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function printQuickstart(flags) {
    const config = buildConfig(flags);
    const configPath = readFlagString(flags, 'config', defaultCodexConfigPath());
    const installCommand = `npx pixso-advanced-mcp install-codex-config --transport ${config.transport} --write`;
    console.log(`Pixso Advanced MCP quickstart (${config.transport.toUpperCase()} transport)

1. Install dependencies from the project root:
   npm install

2. Start the local bridge:
   ${config.transport === 'http' ? 'npm start' : 'npx pixso-advanced-mcp serve --transport stdio'}

3. Install the Codex MCP config:
   ${installCommand}

4. In Pixso, upload this local plugin manifest:
   ${pluginManifestPath()}

5. Open the plugin window in Pixso and keep it open.
   Recommended first-run WebSocket URL: ws://127.0.0.1:${config.wsPort}/ws

6. In Codex, verify the setup:
   - call health
   - call get_selection_context
   - call get_coding_context

Target Codex config:
${configPath}
`);
}
function printInstallCodexConfigResult(flags) {
    const config = buildConfig(flags);
    const configPath = readFlagString(flags, 'config', defaultCodexConfigPath());
    const write = flags.write === true;
    const result = installCodexConfig({
        config,
        entryPath: currentEntryPath(),
        configPath,
        write
    });
    if (!write) {
        console.log(`Preview only. No file was changed.
Target config: ${result.configPath}

Run with --write to save this managed block:

${result.block}`);
        return;
    }
    console.log(`Updated Codex config: ${result.configPath}`);
    if (result.backupPath)
        console.log(`Backup created: ${result.backupPath}`);
    if (!result.updated)
        console.log('The managed pixso_advanced block was already up to date.');
    console.log(`Transport: ${config.transport}`);
}
async function runServe(flags) {
    const config = buildConfig(flags);
    const bridge = await startBridgeServer(config, logger);
    logger.info(`Pixso plugin manifest: ${pluginManifestPath()}`);
    if (config.sessionToken) {
        logger.info('WS session token is enabled. Enter the token in the Pixso plugin UI before connecting.');
    }
    if (config.transport === 'http') {
        await runHttpServer(config, bridge, logger);
        return;
    }
    await runStdioServer(config, bridge, logger);
}
function runDoctor() {
    const entryPath = currentEntryPath();
    const pluginPath = pluginManifestPath();
    const configPath = defaultCodexConfigPath();
    const hasConfigFile = existsSync(configPath);
    const configText = hasConfigFile ? renderConfigPreview(configPath) : '';
    const checks = [
        { name: 'Node.js >= 20.11', ok: isSupportedNodeVersion(process.versions.node), value: process.versions.node },
        { name: 'Built CLI entry exists', ok: existsSync(entryPath), value: entryPath },
        { name: 'Pixso plugin manifest exists', ok: existsSync(pluginPath), value: pluginPath },
        { name: 'Codex config file', ok: hasConfigFile, value: configPath },
        {
            name: 'Codex pixso_advanced block',
            ok: hasConfigFile && hasPixsoCodexConfig(configText),
            value: hasConfigFile && hasPixsoCodexConfig(configText) ? 'present' : 'missing'
        },
        { name: 'Recommended MCP HTTP endpoint', ok: true, value: 'http://127.0.0.1:3668/mcp' },
        { name: 'Recommended plugin WS endpoint', ok: true, value: 'ws://127.0.0.1:3669/ws' }
    ];
    for (const check of checks) {
        console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.value}`);
    }
    console.log('\nNext steps:');
    console.log('1. npm install');
    console.log('2. npm start');
    console.log('3. npx pixso-advanced-mcp install-codex-config --transport http --write');
    console.log(`4. In Pixso, upload plugin manifest: ${pluginPath}`);
    console.log('5. Open a Pixso file, keep the plugin window open, then ask Codex to call health/get_selection_context/get_coding_context.');
}
function renderConfigPreview(configPath) {
    try {
        return readFileSync(configPath, 'utf8');
    }
    catch {
        return '';
    }
}
async function main() {
    const { command, flags } = parseArgs(process.argv.slice(2));
    switch (command) {
        case 'serve':
            await runServe(flags);
            break;
        case 'print-codex-config':
            printCodexConfig(flags);
            break;
        case 'install-codex-config':
            printInstallCodexConfigResult(flags);
            break;
        case 'quickstart':
            printQuickstart(flags);
            break;
        case 'plugin-path':
            console.log(pluginManifestPath());
            break;
        case 'doctor':
            runDoctor();
            break;
        case 'help':
        case '--help':
        case '-h':
        default:
            printHelp();
            break;
    }
}
main().catch(error => {
    logger.error('Fatal error', error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
});
//# sourceMappingURL=index.js.map