import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

async function getFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  if (!address || typeof address === 'string') throw new Error('Failed to allocate a free TCP port');
  return address.port;
}

async function waitForHealth(url: string, process: ChildProcess, stderr: () => string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`Test MCP server exited early: ${stderr()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server startup is still in progress.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for test MCP server: ${stderr()}`);
}

describe('Streamable HTTP session recovery', () => {
  let child: ChildProcess | undefined;

  afterEach(async () => {
    if (!child || child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise<void>(resolve => child?.once('exit', () => resolve()));
  });

  it('returns 404 for an expired session id so clients can reinitialize', async () => {
    const mcpPort = await getFreePort();
    const wsPort = await getFreePort();
    let stderr = '';
    child = spawn(process.execPath, [
      '--import',
      'tsx',
      'src/index.ts',
      'serve',
      '--transport',
      'http',
      '--mcp-port',
      String(mcpPort),
      '--ws-port',
      String(wsPort)
    ], { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.on('data', chunk => {
      stderr += String(chunk);
    });

    await waitForHealth(`http://127.0.0.1:${mcpPort}/health`, child, () => stderr);
    const response = await fetch(`http://127.0.0.1:${mcpPort}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': 'expired-session'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining('Initialize a new session') }
    });
  }, 10_000);
});
