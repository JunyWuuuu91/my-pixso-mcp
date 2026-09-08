import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { callPlugin } from '../utils/toolResult.js';

const readNodesSchema = {
  ids: z
    .array(z.string())
    .min(1)
    .max(80)
    .describe('Node ids to read in one round trip (e.g. "123:456"). Up to 80 per call — prefer this over repeated probe_api calls when walking a tree.'),
  fields: z
    .array(z.string())
    .max(30)
    .optional()
    .describe(
      'Property projection. Defaults to name, type, cornerRadius, fills, strokes, effects, fontSize, fontName, fontWeight, characters, padding, itemSpacing. Colors serialize to #RRGGBB(AA), effects to {type, offset, radius, color}, children to {id, name, type, childCount} summaries.'
    ),
  childSummary: z
    .boolean()
    .optional()
    .describe('Include a {id, name, type, childCount} summary of direct children (default true).'),
  file: z
    .string()
    .optional()
    .describe(
      'Pixso file to read, by fileKey or file name. Only needed when several plugin windows are connected; otherwise the most recently active window is used.'
    )
};

export function registerReadNodesTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'read_nodes',
    {
      title: 'Bulk-read compact node values',
      description:
        'Read compact design values for up to 80 nodes in ONE plugin round trip: name, type, colors (#RRGGBB(AA)), corner radius, strokes, effects (shadow offsets/radius/color), font size/weight, text content, padding, item spacing and a direct-children summary. Use this instead of repeated probe_api calls when walking a design tree — it is 10-30x fewer round trips and much gentler on the plugin window. Read-only.',
      inputSchema: readNodesSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ file, ...input }) =>
      callPlugin(sessions.call.bind(sessions), 'read_nodes', input, 30_000, { file })
  );
}
