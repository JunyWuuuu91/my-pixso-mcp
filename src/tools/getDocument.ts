import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { callPlugin } from '../utils/toolResult.js';

const getDocumentSchema = {
  maxTopFrames: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of top-level frames to list per page. Defaults to 100.')
};

export function registerGetDocumentTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'get_document',
    {
      title: 'Get Pixso document overview',
      description:
        'List the active Pixso file name, all pages, and each page\'s top-level frames (id, name, type, size). Use this first to discover what is in the design before drilling into specific frames. Read-only.',
      inputSchema: getDocumentSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async input => callPlugin(sessions.call.bind(sessions), 'get_document', input)
  );
}
