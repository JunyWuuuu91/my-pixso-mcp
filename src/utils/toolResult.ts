import type { PluginCallOptions } from '../bridge/pluginSession.js';

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function jsonToolResult(result: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}

export function errorToolResult(error: unknown): McpToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    isError: true
  };
}

export async function callPlugin<TResult>(
  call: (command: string, input: unknown, timeoutMs?: number, options?: PluginCallOptions) => Promise<TResult>,
  command: string,
  input: unknown,
  timeoutMs?: number,
  options?: PluginCallOptions
): Promise<McpToolResult> {
  try {
    const result = await call(command, input, timeoutMs, options);
    return jsonToolResult(result);
  } catch (error) {
    return errorToolResult(error);
  }
}
