import { resolvePage } from './resolvePage.js';

export interface ExportNodesInput {
  nodeIds?: string[];
  scale?: number;
  page?: string;
}

interface ExportedNode {
  id: string;
  name: string;
  fileNameSafe: string;
  bytesBase64: string;
  byteLength: number;
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

async function renderNode(node: SceneNodeLike, scale: number): Promise<Uint8Array> {
  const exportAsync = node.exportAsync;
  if (typeof exportAsync !== 'function') {
    throw new Error('exportAsync missing on node');
  }
  const shapes = [{ format: 'PNG', constraint: { type: 'SCALE', value: scale } }, { format: 'PNG', scale }];
  const failures: string[] = [];
  for (const shape of shapes) {
    try {
      return toBytes(await exportAsync.call(node, shape));
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
  const nodeIds = Array.from(new Set((input.nodeIds ?? []).filter(id => typeof id === 'string' && id.length > 0))).slice(
    0,
    MAX_NODES
  );
  if (nodeIds.length === 0) throw new Error('nodeIds must contain at least one node id.');

  const exported: ExportedNode[] = [];
  const skipped: SkippedNode[] = [];
  let totalBase64Bytes = 0;
  let aborted: string | undefined;

  let capabilityChecked = false;

  for (const id of nodeIds) {
    if (aborted) {
      skipped.push({ id, reason: 'not attempted: export aborted early' });
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
      const bytes = await renderNode(node, scale);
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
      exported.push({
        id,
        name: node.name,
        fileNameSafe: fileNameSafe(node.name),
        bytesBase64,
        byteLength: bytes.byteLength
      });
    } catch (error) {
      skipped.push({ id, reason: errorMessage(error) });
    }
  }

  return {
    file: { name: pixso.root.name },
    page: { id: page.id, name: page.name },
    scale,
    exported,
    skipped,
    totalBase64Bytes,
    ...(aborted ? { aborted } : {})
  };
}
