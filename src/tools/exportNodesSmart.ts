import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from '../bridge/pluginSession.js';
import { errorToolResult, jsonToolResult, type McpToolResult } from '../utils/toolResult.js';

const EXPORT_TIMEOUT_MS = 60_000;

const exportNodesSmartSchema = {
  nodeIds: z
    .array(z.string())
    .min(1)
    .max(40)
    .describe('Node ids to export, e.g. the ids inside a find_decorative_nodes group.'),
  prefer: z
    .enum(['auto', 'svg', 'png'])
    .optional()
    .describe(
      "Format strategy. 'auto' (default) tries vector SVG first and falls back to PNG when SVG is unsupported, empty, raster-heavy, or contains <text>; 'svg' forces vector (fails if unsupported); 'png' forces raster."
    ),
  scale: z
    .number()
    .min(0.25)
    .max(4)
    .optional()
    .describe('PNG scale (only used when a node exports as PNG). Defaults to 2. Ignored for SVG (vector).'),
  outputDir: z
    .string()
    .optional()
    .describe('Directory to write assets into. Defaults to ./pixso-exports/<page name> under the server working directory.'),
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
  format: 'svg' | 'png';
  formatNote?: string;
}

interface PluginExportResult {
  file?: { name?: string };
  page?: { id?: string; name?: string };
  scale?: number;
  prefer?: string;
  exported?: ExportedEntry[];
  skipped?: Array<{ id: string; reason: string }>;
  totalBase64Bytes?: number;
  aborted?: string;
  timing?: { budgetMs: number; elapsedMs: number; budgetReached: boolean };
  rendererGuard?: { exportsSinceRecovery: number; threshold: number; earlyStopped: number };
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

export function registerExportNodesSmartTool(server: McpServer, sessions: SessionRegistry): void {
  server.registerTool(
    'export_nodes_smart',
    {
      title: 'Export Pixso nodes as SVG (preferred) or PNG (fallback)',
      description:
        'Export the given nodes via the connected Pixso plugin, preferring vector SVG and falling back to PNG per node. Under prefer=auto a node becomes PNG when SVG export is unsupported/empty, when the SVG embeds a large raster <image>, or when it contains <text> (cross-end font risk). Writes one .svg or .png per node to a local directory and reports the chosen format (and fallback reason) per node. SVG stays crisp and can be recolored/resized at runtime (e.g. base64 data URI in a mini-program <image>); PNG covers photos and complex raster. At most 40 ids per call; the same renderer saturation guard as export_nodes_png applies (skipped ids with a reason — wait ~30s and re-run). Image bytes are never returned inline.',
      inputSchema: exportNodesSmartSchema,
      annotations: { readOnlyHint: false, openWorldHint: false }
    },
    async ({ nodeIds, prefer, scale, outputDir, page, file }): Promise<McpToolResult> => {
      const resolvedPrefer = prefer ?? 'auto';
      const resolvedScale = scale ?? 2;
      let result: PluginExportResult;
      try {
        result = await sessions.call<PluginExportResult>(
          'export_nodes_smart',
          { nodeIds, scale: resolvedScale, page, prefer: resolvedPrefer },
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
          prefer: resolvedPrefer,
          scale: resolvedScale,
          skipped: result.skipped ?? [],
          ...(result.timing ? { timing: result.timing } : {}),
          ...(result.rendererGuard ? { rendererGuard: result.rendererGuard } : {}),
          ...(result.aborted ? { aborted: result.aborted } : {})
        });
      }

      const directory = outputDir
        ? path.resolve(outputDir)
        : path.resolve(process.cwd(), 'pixso-exports', sanitizeSegment(result.page?.name ?? 'page'));

      try {
        await mkdir(directory, { recursive: true });

        const written: Array<{ id: string; name: string; format: string; path: string; bytes: number; formatNote?: string }> = [];
        let totalBytes = 0;
        let svgCount = 0;
        let pngCount = 0;
        const skipped = [...(result.skipped ?? [])];

        for (const entry of exported) {
          const ext = entry.format === 'svg' ? 'svg' : 'png';
          const safeId = entry.id.replace(/[^A-Za-z0-9_-]/g, '_');
          // vector is resolution-independent: no @scale suffix; png keeps it
          const base = ext === 'svg' ? `${sanitizeSegment(entry.fileNameSafe)}-${safeId}.svg` : `${sanitizeSegment(entry.fileNameSafe)}-${safeId}@${resolvedScale}x.png`;
          let fileName = base;
          let suffix = 2;
          let target = path.join(directory, fileName);
          while (await fileExists(target)) {
            fileName = base.replace(new RegExp(`\\.${ext}$`), `-${suffix}.${ext}`);
            suffix += 1;
            target = path.join(directory, fileName);
          }

          const bytes = Buffer.from(entry.bytesBase64, 'base64');
          await writeFile(target, bytes);
          totalBytes += bytes.byteLength;
          if (ext === 'svg') svgCount += 1;
          else pngCount += 1;
          written.push({
            id: entry.id,
            name: entry.name,
            format: ext,
            path: target,
            bytes: bytes.byteLength,
            ...(entry.formatNote ? { formatNote: entry.formatNote } : {})
          });
        }

        return jsonToolResult({
          ok: true,
          outputDir: directory,
          prefer: resolvedPrefer,
          scale: resolvedScale,
          count: written.length,
          svgCount,
          pngCount,
          totalBytes,
          written,
          skipped,
          ...(result.timing ? { timing: result.timing } : {}),
          ...(result.rendererGuard ? { rendererGuard: result.rendererGuard } : {}),
          ...(result.aborted ? { aborted: result.aborted } : {})
        });
      } catch (error) {
        return errorToolResult(error);
      }
    }
  );
}
