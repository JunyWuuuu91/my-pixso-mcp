import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { callPlugin } from '../utils/toolResult.js';

const getSelectionSchema = {
  maxNodes: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of selected nodes to describe. Defaults to 10.'),
  file: z
    .string()
    .optional()
    .describe(
      'Pixso file to read, by fileKey or file name. Only needed when several plugin windows are connected; otherwise the most recently active window is used.'
    )
};

export function registerGetSelectionTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'get_selection',
    {
      title: 'Get the nodes selected in Pixso',
      description:
        'Read the nodes the user currently has selected in the Pixso canvas: id, name, type, size and ancestor path. Use this whenever the user says "this one", "the element I selected" or "this block" — call it first to get concrete node ids, then pass them to export_nodes_png or probe_api. Requires the plugin window to be open; returns count 0 with a note when nothing is selected. Read-only.',
      inputSchema: getSelectionSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ file, ...input }) =>
      callPlugin(sessions.call.bind(sessions), 'get_selection', input, 10_000, { file })
  );
}
