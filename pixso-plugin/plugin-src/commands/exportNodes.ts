import { resolvePage } from './resolvePage.js';

export type ExportFormat = 'svg' | 'png';
export type ExportPrefer = 'auto' | 'svg' | 'png';

export interface ExportNodesInput {
  nodeIds?: string[];
  scale?: number;
  page?: string;
  /** 'auto' = try SVG then fall back to PNG; 'svg'/'png' force one format. Defaults to 'png'. */
  prefer?: ExportPrefer;
}

interface ExportedNode {
  id: string;
  name: string;
  fileNameSafe: string;
  bytesBase64: string;
  byteLength: number;
  format: ExportFormat;
  /** why the chosen format differs from the requested preference (e.g. png fallback reason) */
  formatNote?: string;
}

interface SkippedNode {
  id: string;
  reason: string;
}

const MAX_NODES = 40;
const MAX_IMAGE_BYTES = 2_097_152;
const MAX_TOTAL_BASE64 = 12_582_912;
const LOOKUP_VISITED_CAP = 20_000;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const PER_NODE_BUDGET_MS = 8_000;
const COMMAND_BUDGET_MS = 45_000;
const CONSECUTIVE_TIMEOUT_LIMIT = 3;
// Measured on Pixso 2.3.1: the renderer stops answering exportAsync after ~100
// consecutive renders and fully recovers after ~25s idle. Refuse just before
// the cliff instead of burning three 8s deadlines per batch.
const SATURATION_THRESHOLD = 90;
const RECOVERY_GAP_MS = 30_000;

let exportsSinceRecovery = 0;
let lastExportAt = 0;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function readProp(node: SceneNodeLike, prop: string): unknown {
  try {
    return (node as unknown as Record<string, unknown>)[prop];
  } catch {
    return undefined;
  }
}

function resolveById(id: string): SceneNodeLike | undefined {
  const getNodeById = (pixso as unknown as { getNodeById?: (nodeId: string) => unknown }).getNodeById;
  if (typeof getNodeById === 'function') {
    try {
      const node = getNodeById.call(pixso, id);
      if (node) return node as SceneNodeLike;
    } catch {
      /* fall back to the walk below */
    }
  }

  const wanted = new Set([id]);
  const found = findNodesByIds(wanted, 1);
  return found.get(id);
}

function findNodesByIds(wanted: Set<string>, limit: number): Map<string, SceneNodeLike> {
  const found = new Map<string, SceneNodeLike>();
  const queue: SceneNodeLike[] = [];
  for (const page of pixso.root?.children ?? []) {
    for (const child of page.children ?? []) queue.push(child);
  }
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length && visited < LOOKUP_VISITED_CAP && found.size < Math.min(wanted.size, limit)) {
    const node = queue[cursor] as SceneNodeLike;
    cursor += 1;
    visited += 1;
    if (wanted.has(node.id) && !found.has(node.id)) found.set(node.id, node);
    for (const child of (readProp(node, 'children') as SceneNodeLike[] | undefined) ?? []) {
      queue.push(child);
    }
  }
  return found;
}

function fileNameSafe(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 60);
  return cleaned.length > 0 ? cleaned : 'node';
}

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const length = bytes.length;
  for (let i = 0; i < length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < length ? bytes[i + 1] ?? 0 : 0;
    const b2 = i + 2 < length ? bytes[i + 2] ?? 0 : 0;
    parts.push(
      BASE64_ALPHABET.charAt(b0 >> 2) +
        BASE64_ALPHABET.charAt(((b0 & 3) << 4) | (b1 >> 4)) +
        (i + 1 < length ? BASE64_ALPHABET.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '=') +
        (i + 2 < length ? BASE64_ALPHABET.charAt(b2 & 63) : '=')
    );
  }
  return parts.join('');
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  const description =
    value === null ? 'null' : `${typeof value}${(value as { constructor?: { name?: string } })?.constructor?.name ? ` (${(value as { constructor?: { name?: string } }).constructor?.name})` : ''}`;
  throw new Error(`exportAsync returned an unexpected type: ${description}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (typeof setTimeout !== 'function') return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 512);
  let head = '';
  for (let i = 0; i < n; i += 1) head += String.fromCharCode(bytes[i] ?? 0);
  return /<svg[\s>]/i.test(head) || /<\?xml/i.test(head);
}

// Scan a bounded prefix of the svg text for a pattern (avoid decoding huge blobs fully).
function svgMatches(bytes: Uint8Array, re: RegExp, cap = 262_144): boolean {
  const n = Math.min(bytes.length, cap);
  let text = '';
  for (let i = 0; i < n; i += 1) text += String.fromCharCode(bytes[i] ?? 0);
  return re.test(text);
}

// Raster-heavy SVG (embedded <image>) above this size is usually better as PNG.
const SVG_RASTER_FALLBACK_BYTES = 262_144;

interface RenderResult {
  bytes: Uint8Array;
  format: ExportFormat;
  formatNote?: string;
}

async function renderNode(
  node: SceneNodeLike,
  scale: number,
  budgetMs: number,
  prefer: ExportPrefer
): Promise<RenderResult> {
  const exportAsync = node.exportAsync;
  if (typeof exportAsync !== 'function') {
    throw new Error('exportAsync missing on node');
  }
  const startedAt = Date.now();
  const failures: string[] = [];

  // 1) Vector attempt (SVG) when allowed.
  if (prefer === 'svg' || prefer === 'auto') {
    const remainingMs = Math.max(1, budgetMs - (Date.now() - startedAt));
    try {
      const bytes = toBytes(await withDeadline(exportAsync.call(node, { format: 'SVG' }), remainingMs, 'exportAsync(SVG)'));
      if (bytes.byteLength > 0 && looksLikeSvg(bytes)) {
        if (prefer === 'svg') return { bytes, format: 'svg' };
        // auto: fall back to PNG for cases that render inconsistently or bloat as SVG
        if (svgMatches(bytes, /<image[\s>]/i) && bytes.byteLength > SVG_RASTER_FALLBACK_BYTES) {
          failures.push('svg is raster-heavy (embedded <image>), prefer png');
        } else if (svgMatches(bytes, /<text[\s>]/i)) {
          failures.push('svg contains <text> (cross-end font risk), prefer png');
        } else {
          return { bytes, format: 'svg' };
        }
      } else {
        failures.push('svg export returned empty or non-svg bytes');
      }
    } catch (error) {
      const message = errorMessage(error);
      if (prefer === 'svg') throw new Error(`svg export failed (${message})`);
      failures.push(`svg unsupported/failed: ${message}`);
    }
  }

  // 2) Raster (PNG) — the only path when prefer==='png', and the fallback for 'auto'.
  const shapes = [{ format: 'PNG', constraint: { type: 'SCALE', value: scale } }, { format: 'PNG', scale }];
  for (const shape of shapes) {
    const remainingMs = Math.max(1, budgetMs - (Date.now() - startedAt));
    try {
      const bytes = toBytes(await withDeadline(exportAsync.call(node, shape), remainingMs, 'exportAsync'));
      const note = prefer === 'auto' && failures.length > 0 ? `png fallback: ${failures.join(' | ')}` : undefined;
      return { bytes, format: 'png', ...(note ? { formatNote: note } : {}) };
    } catch (error) {
      failures.push(errorMessage(error));
    }
  }
  throw new Error(`export failed (${failures.join(' | retry: ')})`);
}

export async function exportNodes(input: ExportNodesInput = {}): Promise<Record<string, unknown>> {
  if (!pixso.root) throw new Error('No document root available.');

  const page = resolvePage(input.page);
  const scale = clamp(input.scale ?? 1, 0.25, 4);
  const prefer: ExportPrefer =
    input.prefer === 'auto' || input.prefer === 'svg' || input.prefer === 'png' ? input.prefer : 'png';
  const nodeIds = Array.from(new Set((input.nodeIds ?? []).filter(id => typeof id === 'string' && id.length > 0))).slice(
    0,
    MAX_NODES
  );
  if (nodeIds.length === 0) throw new Error('nodeIds must contain at least one node id.');

  const exported: ExportedNode[] = [];
  const skipped: SkippedNode[] = [];
  let totalBase64Bytes = 0;
  let aborted: string | undefined;
  let budgetReached = false;
  let consecutiveTimeouts = 0;
  let earlyStopped = 0;
  const startedAt = Date.now();

  let capabilityChecked = false;

  for (const id of nodeIds) {
    if (aborted) {
      skipped.push({ id, reason: 'not attempted: export stopped early — see the aborted reason' });
      continue;
    }

    if (Date.now() - startedAt >= COMMAND_BUDGET_MS) {
      budgetReached = true;
      skipped.push({ id, reason: `not attempted: ${COMMAND_BUDGET_MS}ms command budget reached — re-run for the rest` });
      continue;
    }

    if (lastExportAt > 0 && Date.now() - lastExportAt >= RECOVERY_GAP_MS) exportsSinceRecovery = 0;
    if (exportsSinceRecovery >= SATURATION_THRESHOLD) {
      earlyStopped += 1;
      skipped.push({
        id,
        reason: `not attempted: renderer near saturation (${exportsSinceRecovery} exports since the last cooldown, measured cliff ~100) — wait about 30s and re-run these ids`
      });
      continue;
    }

    const node = resolveById(id);
    if (!node) {
      skipped.push({ id, reason: 'not found in this document' });
      continue;
    }

    if (!capabilityChecked) {
      capabilityChecked = true;
      if (typeof node.exportAsync !== 'function') {
        const api = pixso as unknown as Record<string, unknown>;
        throw new Error(
          `node.exportAsync is not available in this Pixso runtime (editorType=${String(api.editorType ?? 'unknown')}, apiVersion=${String(
            api.apiVersion ?? 'unknown'
          )}). Preview mode may block node-level export. Re-run probe_api to confirm, or open the file in edit mode.`
        );
      }
    }

    try {
      const rendered = await renderNode(node, scale, PER_NODE_BUDGET_MS, prefer);
      const bytes = rendered.bytes;
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        skipped.push({
          id,
          reason: `image too large (${bytes.byteLength} bytes at ${scale}x) — re-run with a lower scale or export this node alone`
        });
        continue;
      }
      const bytesBase64 = bytesToBase64(bytes);
      if (totalBase64Bytes + bytesBase64.length > MAX_TOTAL_BASE64) {
        aborted = 'total payload cap reached; re-run with fewer nodeIds';
        skipped.push({ id, reason: 'not exported: total payload cap reached' });
        continue;
      }
      totalBase64Bytes += bytesBase64.length;
      consecutiveTimeouts = 0;
      exportsSinceRecovery += 1;
      lastExportAt = Date.now();
      exported.push({
        id,
        name: node.name,
        fileNameSafe: fileNameSafe(node.name),
        bytesBase64,
        byteLength: bytes.byteLength,
        format: rendered.format,
        ...(rendered.formatNote ? { formatNote: rendered.formatNote } : {})
      });
    } catch (error) {
      const message = errorMessage(error);
      skipped.push({ id, reason: message });
      if (!message.includes('timed out')) {
        consecutiveTimeouts = 0;
      } else {
        consecutiveTimeouts += 1;
        if (consecutiveTimeouts >= CONSECUTIVE_TIMEOUT_LIMIT) {
          aborted = `${CONSECUTIVE_TIMEOUT_LIMIT} exports timed out in a row — the Pixso renderer saturates after a long burst; wait about 30s, then re-run the skipped ids`;
          exportsSinceRecovery = SATURATION_THRESHOLD;
          lastExportAt = Date.now();
        }
      }
    }
  }

  return {
    file: { name: pixso.root.name },
    page: { id: page.id, name: page.name },
    scale,
    prefer,
    exported,
    skipped,
    totalBase64Bytes,
    timing: { budgetMs: COMMAND_BUDGET_MS, elapsedMs: Date.now() - startedAt, budgetReached },
    rendererGuard: { exportsSinceRecovery, threshold: SATURATION_THRESHOLD, earlyStopped },
    ...(aborted ? { aborted } : {})
  };
}
