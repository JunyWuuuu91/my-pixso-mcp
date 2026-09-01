import { clamp, describeKind, numericSize, readProp } from '../utils/nodeProps.js';

export interface GetSelectionInput {
  maxNodes?: number;
}

export type SelectionMode = 'event' | 'poll' | 'manual';

const PATH_HOPS = 4;

let selectionMode: SelectionMode = 'manual';

export function setSelectionMode(mode: SelectionMode): void {
  selectionMode = mode;
}

export function getSelectionMode(): SelectionMode {
  return selectionMode;
}

export interface SelectedNodeInfo {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  childCount?: number;
  path: string[];
}

function ancestorPath(node: unknown): string[] {
  const names: string[] = [];
  let current = readProp(node, 'parent');
  for (let hop = 0; hop < PATH_HOPS && current; hop += 1) {
    const name = readProp(current, 'name');
    if (typeof name === 'string' && name) names.unshift(name);
    if (readProp(current, 'type') === 'PAGE') break;
    current = readProp(current, 'parent');
  }
  return names;
}

function describeNode(node: unknown): SelectedNodeInfo {
  const children = readProp(node, 'children');
  return {
    id: String(readProp(node, 'id') ?? ''),
    name: String(readProp(node, 'name') ?? ''),
    type: String(readProp(node, 'type') ?? ''),
    width: numericSize(readProp(node, 'width')) ?? 0,
    height: numericSize(readProp(node, 'height')) ?? 0,
    ...(Array.isArray(children) ? { childCount: children.length } : {}),
    path: ancestorPath(node)
  };
}

export async function getSelection(input: GetSelectionInput = {}): Promise<Record<string, unknown>> {
  const selection = readProp(pixso.currentPage, 'selection');
  if (!Array.isArray(selection)) {
    throw new Error(
      `pixso.currentPage.selection is not available in this runtime (editorType=${String(pixso.editorType ?? 'unknown')}, ` +
        `apiVersion=${String(pixso.apiVersion ?? 'unknown')}, got ${describeKind(selection)}).`
    );
  }

  const cap = clamp(input.maxNodes ?? 10, 1, 50);
  const nodes = selection.slice(0, cap).map(describeNode);

  return {
    file: { id: pixso.root?.id, name: pixso.root?.name },
    page: { id: pixso.currentPage?.id, name: pixso.currentPage?.name },
    selectionMode,
    count: selection.length,
    nodes,
    truncated: selection.length > nodes.length,
    ...(selection.length === 0
      ? { note: 'Nothing is selected. Ask the user to click an element on the canvas, then call again.' }
      : {})
  };
}
