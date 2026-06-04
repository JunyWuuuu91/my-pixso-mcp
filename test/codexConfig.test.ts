import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { installCodexConfig, renderCodexConfigSnippet, upsertManagedCodexConfig } from '../src/codexConfig.js';
import type { ServerConfig } from '../src/types.js';

const baseConfig: ServerConfig = {
  transport: 'http',
  host: '127.0.0.1',
  mcpPort: 3668,
  wsPort: 3669,
  wsPath: '/ws',
  pluginTimeoutMs: 30_000,
  version: '0.4.0'
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('codex config helpers', () => {
  it('renders an http config snippet', () => {
    const text = renderCodexConfigSnippet(baseConfig, '/tmp/dist/index.js');
    expect(text).toContain('url = "http://127.0.0.1:3668/mcp"');
    expect(text).not.toContain('command = "node"');
  });

  it('appends the managed block when no markers exist', () => {
    const text = upsertManagedCodexConfig('title = "demo"\n', '# BEGIN pixso-advanced-mcp\nhello\n# END pixso-advanced-mcp\n');
    expect(text).toContain('title = "demo"');
    expect(text).toContain('# BEGIN pixso-advanced-mcp');
  });

  it('writes a managed config block with backup on update', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'pixso-advanced-mcp-'));
    tempDirs.push(tempRoot);
    const configPath = join(tempRoot, 'config.toml');

    installCodexConfig({
      config: baseConfig,
      entryPath: '/tmp/dist/index.js',
      configPath,
      write: true
    });

    const stdioResult = installCodexConfig({
      config: { ...baseConfig, transport: 'stdio' },
      entryPath: '/tmp/dist/index.js',
      configPath,
      write: true,
      backupSuffix: 'test'
    });

    expect(stdioResult.backupPath).toBe(`${configPath}.bak-test`);
    expect(readFileSync(configPath, 'utf8')).toContain('"stdio"');
  });
});
