import { readProp } from '../utils/nodeProps.js';
import {
  serializeEffects,
  serializePadding,
  serializePaints,
  serializeRadius,
  truncateText
} from '../utils/serialize.js';

export interface ReadNodesInput {
  ids?: string[];
  fields?: string[];
  childSummary?: boolean;
}

const MAX_IDS = 80;
/** Yield to the plugin event loop every N nodes so the renderer never starves. */
const YIELD_EVERY = 16;
const CHILD_SUMMARY_LIMIT = 12;

/** Default compact field set: the values a design-token audit needs. */
export const DEFAULT_FIELDS = [
  'name',
  'type',
  'cornerRadius',
  'fills',
  'strokes',
  'effects',
  'fontSize',
  'fontName',
  'fontWeight',
  'characters',
  'padding',
  'itemSpacing'
];

const CHILD_SUMMARY_FIELDS = ['children'];

interface ChildSummary {
  id: string;
  name: string;
  type: string;
  childCount: number;
}

function childSummaries(children: unknown): ChildSummary[] | undefined {
  if (!Array.isArray(children) || children.length === 0) return undefined;
  const out: ChildSummary[] = [];
  for (const child of children.slice(0, CHILD_SUMMARY_LIMIT)) {
    const record = child as Record<string, unknown>;
    out.push({
      id: String(record.id ?? ''),
      name: String(record.name ?? ''),
      type: String(record.type ?? ''),
      childCount: Array.isArray(record.children) ? record.children.length : 0
    });
  }
  return out;
}

function resolveNode(id: string): Record<string, unknown> | undefined {
  const getNodeById = (pixso as unknown as { getNodeById?: (id: string) => unknown }).getNodeById;
  if (typeof getNodeById !== 'function') return undefined;
  try {
    const node = getNodeById.call(pixso, id);
    return node && typeof node === 'object' ? (node as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readField(node: Record<string, unknown>, field: string): unknown {
  switch (field) {
    case 'fills':
    case 'strokes':
      return serializePaints(node[field]);
    case 'effects':
      return serializeEffects(node.effects);
    case 'cornerRadius': {
      return serializeRadius(
        node.cornerRadius,
        node.topLeftRadius,
        node.topRightRadius,
        node.bottomLeftRadius,
        node.bottomRightRadius
      );
    }
    case 'padding':
      return serializePadding(node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft);
    case 'itemSpacing':
    case 'counterAxisSpacing': {
      const value = readProp(node, field);
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
      return Math.round(value * 1000) / 1000;
    }
    case 'layoutMode': {
      const value = readProp(node, field);
      return typeof value === 'string' ? value : undefined;
    }
    case 'characters':
      return truncateText(node.characters);
    case 'fontSize': {
      const value = readProp(node, field);
      return typeof value === 'number' ? value : undefined;
    }
    case 'fontName': {
      const value = readProp(node, field) as { family?: unknown; style?: unknown } | undefined;
      if (!value || typeof value !== 'object') return undefined;
      const font: Record<string, unknown> = {};
      if (typeof value.family === 'string') font.family = value.family;
      if (typeof value.style === 'string') font.style = value.style;
      return Object.keys(font).length ? font : undefined;
    }
    case 'fontWeight': {
      const value = readProp(node, field);
      if (typeof value === 'number' || typeof value === 'string') return value;
      return undefined;
    }
    case 'width':
    case 'height': {
      const value = readProp(node, field);
      return typeof value === 'number' ? Math.round(value * 1000) / 1000 : undefined;
    }
    case 'visible': {
      const value = readProp(node, field);
      return typeof value === 'boolean' ? value : undefined;
    }
    case 'opacity': {
      const value = readProp(node, field);
      return typeof value === 'number' ? Math.round(value * 1000) / 1000 : undefined;
    }
    case 'children':
      // summarized; real child arrays are never returned
      return undefined;
    default: {
      // passthrough for unknown fields, summarized for safety
      const value = readProp(node, field);
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'number' || typeof value === 'boolean') return value;
      if (typeof value === 'string') return truncateText(value);
      return undefined;
    }
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => {
    if (typeof setTimeout === 'function') setTimeout(resolve, 0);
    else resolve();
  });
}

export interface ReadNodesResult {
  nodes: Array<Record<string, unknown>>;
  requested: number;
  missingIds: string[];
}

export async function readNodes(input: ReadNodesInput = {}): Promise<ReadNodesResult> {
  const ids = Array.from(input.ids ?? [])
    .filter(id => typeof id === 'string' && id.length > 0)
    .slice(0, MAX_IDS);
  const requestedFields = Array.isArray(input.fields) && input.fields.length ? input.fields : DEFAULT_FIELDS;
  const fields = requestedFields.filter(field => typeof field === 'string' && field.length > 0);
  const includeChildren = input.childSummary !== false;

  const nodes: Array<Record<string, unknown>> = [];
  const missingIds: string[] = [];

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index] as string;
    const node = resolveNode(id);
    if (!node) {
      missingIds.push(id);
      nodes.push({ id, error: 'node not found' });
    } else {
      const record: Record<string, unknown> = { id };
      for (const field of fields) {
        try {
          const value = field === 'name' || field === 'type' ? readProp(node, field) : readField(node, field);
          if (value !== undefined) record[field] = value;
        } catch (error) {
          record[field] = `threw: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      if (includeChildren && !fields.includes('children')) {
        try {
          const summary = childSummaries(node.children);
          if (summary) record.children = summary;
        } catch {
          /* children read failure is non-fatal */
        }
      }
      nodes.push(record);
    }
    if (index > 0 && index % YIELD_EVERY === YIELD_EVERY - 1) {
      await yieldToEventLoop();
    }
  }

  return { nodes, requested: ids.length, missingIds };
}
