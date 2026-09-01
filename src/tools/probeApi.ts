import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { callPlugin } from '../utils/toolResult.js';

const probeApiSchema = {
  nodeIds: z
    .array(z.string())
    .max(6)
    .optional()
    .describe(
      'Node ids to deep-probe (e.g. "123:456"). Returns their actual bound values, variable bindings and child type breakdown. Omit to scan every API surface and collection instead.'
    ),
  file: z
    .string()
    .optional()
    .describe(
      'Pixso file to probe, by fileKey or file name. Only needed when several plugin windows are connected; otherwise the most recently active window is used.'
    )
};

export function registerProbeApiTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'probe_api',
    {
      title: 'Probe the reachable Pixso Plugin API',
      description:
        'Report what the connected Pixso plugin can actually read in the current file and editor mode (edit vs preview). With no input, scans every API surface plus the local style, component, library and font collections with availability, counts and errors. With nodeIds, returns the real values of the design properties on those nodes (paints, variable bindings, text style, auto-layout, corner radius, component links) plus a methods map showing which node methods (exportAsync, fillGeometry, hasMissingFont) exist in this runtime. Use this first to decide what extraction is possible. Read-only.',
      inputSchema: probeApiSchema,
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ file, ...input }) =>
      callPlugin(sessions.call.bind(sessions), 'probe_api', input, 20_000, { file })
  );
}
