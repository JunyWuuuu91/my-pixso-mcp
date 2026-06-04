import { describe, expect, it } from 'vitest';
import { buildConfig, isSupportedNodeVersion, parseArgs } from '../src/config.js';

describe('config', () => {
  it('parses flags with values and booleans', () => {
    const parsed = parseArgs(['serve', '--transport', 'http', '--ws-port=4000', '--token', 'abc', '--verbose']);
    expect(parsed.command).toBe('serve');
    expect(parsed.flags.transport).toBe('http');
    expect(parsed.flags['ws-port']).toBe('4000');
    expect(parsed.flags.token).toBe('abc');
    expect(parsed.flags.verbose).toBe(true);
  });

  it('builds defaults for local http mode', () => {
    const config = buildConfig({});
    expect(config.transport).toBe('http');
    expect(config.host).toBe('127.0.0.1');
    expect(config.mcpPort).toBe(3668);
    expect(config.wsPort).toBe(3669);
    expect(config.wsPath).toBe('/ws');
  });

  it('uses http transport and custom ports', () => {
    const config = buildConfig({ transport: 'http', 'mcp-port': '4555', 'ws-port': '4666' });
    expect(config.transport).toBe('http');
    expect(config.mcpPort).toBe(4555);
    expect(config.wsPort).toBe(4666);
  });

  it('checks the minimum supported Node.js version precisely', () => {
    expect(isSupportedNodeVersion('20.10.0')).toBe(false);
    expect(isSupportedNodeVersion('20.11.0')).toBe(true);
    expect(isSupportedNodeVersion('22.12.0')).toBe(true);
  });
});
