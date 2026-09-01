import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { errorToolResult, jsonToolResult, type McpToolResult } from '../utils/toolResult.js';

const EXPORT_TIMEOUT_MS = 60_000;

const exportNodesPngSchema = {
  nodeIds: z
    .array(z.string())
    .min(1)
    .max(40)
    .describe('Node ids to export, e.g. the ids inside a find_decorative_nodes group.'),
  scale: z
    .number()
    .min(0.25)
    .max(4)
    .describe('Export scale, e.g. 1, 2 or 3. Pick from the scaleProposal returned by find_decorative_nodes.'),
  outputDir: z
    .string()
    .optional()
    .describe('Directory to write PNGs into. Defaults to ./pixso-exports/<page name> under the server working directory.'),
  page: z
    .string()
    .optional()
    .describe('Page name or id, used only to name the default output directory. Defaults to the current page.'),
  file: z
    .string()
    .optional()
    .describe(
      'Pixso file to export from, by fileKey or file name. Only needed when several plugin windows are connected; otherwise the most recently active window is used.'
    )
};

interface ExportedEntry {
  id: string;
  name: string;
  fileNameSafe: string;
  bytesBase64: string;
  byteLength: number;
}

interface PluginExportResult {
  file?: { name?: string };
  page?: { id?: string; name?: string };
  scale?: number;
  exported?: ExportedEntry[];
  skipped?: Array<{ id: string; reason: string }>;
  totalBase64Bytes?: number;
  aborted?: string;
  timing?: { budgetMs: number; elapsedMs: number; budgetReached: boolean };
}

function sanitizeSegment(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 60);
  return cleaned.length > 0 ? cleaned : 'unnamed';
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export function registerExportNodesPngTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'export_nodes_png',
    {
      title: 'Export Pixso nodes as PNG files',
      description:
        'Render the given nodes at the chosen scale via the connected Pixso plugin and write one PNG per node to a local directory. Use find_decorative_nodes first, show its groups and scale proposal to the user, then call this tool with the node ids from the groups the user picked and the scale the user picked. At most 40 ids per call. Pixso renders one node at a time and its renderer saturates after a long burst: saturated nodes come back as skipped and the batch stops early, so wait ~30s and re-run just those ids. Returns the output directory and the written file paths; image bytes are never returned inline.',
      inputSchema: exportNodesPngSchema,
      annotations: { readOnlyHint: false, openWorldHint: false }
    },
    async ({ nodeIds, scale, outputDir, page, file }): Promise<McpToolResult> => {
      let result: PluginExportResult;
      try {
        result = await sessions.call<PluginExportResult>(
          'export_nodes_png',
          { nodeIds, scale, page },
          EXPORT_TIMEOUT_MS,
          { file }
        );
      } catch (error) {
        return errorToolResult(error);
      }

      const exported = Array.isArray(result.exported) ? result.exported : [];
      if (exported.length === 0) {
        return jsonToolResult({
          ok: true,
          note: 'Nothing was exported.',
          scale,
          skipped: result.skipped ?? [],
          ...(result.timing ? { timing: result.timing } : {}),
          ...(result.aborted ? { aborted: result.aborted } : {})
        });
      }

      const directory = outputDir
        ? path.resolve(outputDir)
        : path.resolve(process.cwd(), 'pixso-exports', sanitizeSegment(result.page?.name ?? 'page'));

      try {
        await mkdir(directory, { recursive: true });

        const written: Array<{ id: string; name: string; path: string; bytes: number }> = [];
        let totalBytes = 0;
        const skipped = [...(result.skipped ?? [])];

        for (const entry of exported) {
          const safeId = entry.id.replace(/[^A-Za-z0-9_-]/g, '_');
          const base = `${sanitizeSegment(entry.fileNameSafe)}-${safeId}@${scale}x.png`;
          let fileName = base;
          let suffix = 2;
          let target = path.join(directory, fileName);
          while (await fileExists(target)) {
            fileName = base.replace(/\.png$/, `-${suffix}.png`);
            suffix += 1;
            target = path.join(directory, fileName);
          }

          const bytes = Buffer.from(entry.bytesBase64, 'base64');
          await writeFile(target, bytes);
          totalBytes += bytes.byteLength;
          written.push({ id: entry.id, name: entry.name, path: target, bytes: bytes.byteLength });
        }

        return jsonToolResult({
          ok: true,
          outputDir: directory,
          scale,
          count: written.length,
          totalBytes,
          written,
          skipped,
          ...(result.timing ? { timing: result.timing } : {}),
          ...(result.aborted ? { aborted: result.aborted } : {})
        });
      } catch (error) {
        return errorToolResult(error);
      }
    }
  );
}
