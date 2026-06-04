import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { ServerConfig } from './types.js';

const BEGIN_MARKER = '# BEGIN pixso-advanced-mcp';
const END_MARKER = '# END pixso-advanced-mcp';

export interface InstallCodexConfigOptions {
  config: ServerConfig;
  entryPath: string;
  configPath?: string;
  write?: boolean;
  backupSuffix?: string;
}

export interface InstallCodexConfigResult {
  configPath: string;
  backupPath?: string;
  mode: 'preview' | 'write';
  created: boolean;
  updated: boolean;
  block: string;
  content: string;
}

export function defaultCodexConfigPath(): string {
  return resolve(homedir(), '.codex', 'config.toml');
}

export function renderCodexConfigSnippet(config: ServerConfig, entryPath: string): string {
  if (config.transport === 'http') {
    return `[mcp_servers.pixso_advanced]
url = "http://${config.host}:${config.mcpPort}/mcp"
startup_timeout_sec = 10
tool_timeout_sec = 120
default_tools_approval_mode = "prompt"
enabled_tools = [
  "health",
  "get_file_info",
  "list_pages",
  "list_frames",
  "search_nodes",
  "get_node_tree",
  "inspect_node",
  "get_selection_context",
  "get_design_tokens",
  "get_styles",
  "get_components",
  "get_export_preview",
  "get_screenshot",
  "export_asset",
  "find_related_frames",
  "get_coding_context",
  "get_css_context"
]
`;
  }

  return `[mcp_servers.pixso_advanced]
command = "node"
args = ["${entryPath}", "serve", "--transport", "stdio", "--ws-port", "${config.wsPort}"]
startup_timeout_sec = 10
tool_timeout_sec = 120
default_tools_approval_mode = "prompt"
enabled_tools = [
  "health",
  "get_file_info",
  "list_pages",
  "list_frames",
  "search_nodes",
  "get_node_tree",
  "inspect_node",
  "get_selection_context",
  "get_design_tokens",
  "get_styles",
  "get_components",
  "get_export_preview",
  "get_screenshot",
  "export_asset",
  "find_related_frames",
  "get_coding_context",
  "get_css_context"
]
`;
}

export function renderManagedCodexConfigBlock(config: ServerConfig, entryPath: string): string {
  return `${BEGIN_MARKER}
${renderCodexConfigSnippet(config, entryPath).trimEnd()}
${END_MARKER}
`;
}

export function hasPixsoCodexConfig(text: string): boolean {
  return text.includes('[mcp_servers.pixso_advanced]');
}

export function upsertManagedCodexConfig(existingText: string, block: string): string {
  const beginIndex = existingText.indexOf(BEGIN_MARKER);
  const endIndex = existingText.indexOf(END_MARKER);

  if (beginIndex >= 0 && endIndex >= beginIndex) {
    const before = existingText.slice(0, beginIndex).trimEnd();
    const after = existingText.slice(endIndex + END_MARKER.length).trimStart();
    const pieces = [before, block.trimEnd(), after].filter(Boolean);
    return `${pieces.join('\n\n')}\n`;
  }

  const trimmed = existingText.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

function backupPathFor(configPath: string, backupSuffix?: string): string {
  const suffix = backupSuffix ?? new Date().toISOString().replace(/[:.]/g, '-');
  return `${configPath}.bak-${suffix}`;
}

export function installCodexConfig(options: InstallCodexConfigOptions): InstallCodexConfigResult {
  const configPath = options.configPath ?? defaultCodexConfigPath();
  const block = renderManagedCodexConfigBlock(options.config, options.entryPath);
  const fileExists = existsSync(configPath);
  const existingText = fileExists ? readFileSync(configPath, 'utf8') : '';
  const content = upsertManagedCodexConfig(existingText, block);
  const changed = content !== existingText;

  if (!options.write) {
    return {
      configPath,
      mode: 'preview',
      created: !fileExists,
      updated: changed,
      block,
      content
    };
  }

  mkdirSync(dirname(configPath), { recursive: true });
  let backupPath: string | undefined;

  if (fileExists && changed) {
    backupPath = backupPathFor(configPath, options.backupSuffix);
    copyFileSync(configPath, backupPath);
  }

  writeFileSync(configPath, content, 'utf8');

  return {
    configPath,
    backupPath,
    mode: 'write',
    created: !fileExists,
    updated: changed,
    block,
    content
  };
}
