import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { callPlugin } from '../utils/toolResult.js';

const findDecorativeNodesSchema = {
  page: z
    .string()
    .optional()
    .describe('Page name or id to scan. Defaults to the current page.'),
  maxNodeSizePx: z
    .number()
    .int()
    .min(16)
    .max(512)
    .optional()
    .describe('Largest edge (in px) for a small-graphic candidate such as an icon. Defaults to 96.'),
  minNodeSizePx: z
    .number()
    .int()
    .min(1)
    .max(64)
    .optional()
    .describe('Smallest edge (in px) for a small-graphic candidate; filters out micro vector fragments. Defaults to 8.'),
  maxCandidates: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .describe(
      'Maximum number of matching nodes to collect before the rest are dropped (truncatedCandidates). Defaults to 500 — matches that share type, name, size and reasons are grouped into one entry, so a large page stays small in context.'
    ),
  file: z
    .string()
    .optional()
    .describe(
      'Pixso file to scan, by fileKey or file name. Only needed when several plugin windows are connected; otherwise the most recently active window is used.'
    )
};

export function registerFindDecorativeNodesTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'find_decorative_nodes',
    {
      title: 'Find decorative elements on a Pixso page',
      description:
        'Scan one page of the design for decorative elements worth exporting: emoji text nodes, small icon-like graphics (instances, components, vectors, boolean ops, groups), nodes the designer already marked with export settings, and nodes whose names hint at icons/emoji/logos. Matches are returned as `groups` (name, type, size, reasons, count, ids) instead of one row per node, because a page repeats the same icon many times — take the node ids from a group\'s `ids` when calling export_nodes_png. Also returns a scale proposal computed from the measured sizes of every match. Follow up with export_nodes_png after the user picks groups and a scale. Read-only.',
      inputSchema: findDecorativeNodesSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ file, ...input }) =>
      callPlugin(sessions.call.bind(sessions), 'find_decorative_nodes', input, 20_000, { file })
  );
}
