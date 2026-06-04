export interface McpContentText {
  type: 'text';
  text: string;
}

export interface McpContentImage {
  type: 'image';
  mimeType: string;
  data: string;
}

export type McpContent = McpContentText | McpContentImage;

export interface McpToolResult {
  [key: string]: unknown;
  content: McpContent[];
  structuredContent?: Record<string, unknown>;
}

export function jsonToolResult(data: unknown): McpToolResult {
  const structuredContent = toStructuredContent(data);
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent
  };
}

function toStructuredContent(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  return { value: data };
}

export function imageToolResult(meta: Record<string, unknown>, dataBase64: string, mimeType: string): McpToolResult {
  return {
    content: [
      { type: 'text', text: JSON.stringify(meta, null, 2) },
      { type: 'image', mimeType, data: dataBase64 }
    ],
    structuredContent: meta
  };
}

export function errorToolResult(error: unknown): McpToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Pixso Advanced MCP error: ${message}` }],
    structuredContent: { ok: false, error: message }
  };
}
