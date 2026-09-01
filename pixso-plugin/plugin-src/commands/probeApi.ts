const API_SURFACES = [
  'root',
  'currentPage',
  'getNodeById',
  'getLocalPaintStyles',
  'getLocalTextStyles',
  'getLocalEffectStyles',
  'getLocalGridStyles',
  'getStyleById',
  'getLocalComponents',
  'getLibraryListAsync',
  'getLibraryComponentsInUse',
  'getLibraryStylesInUse',
  'listAvailableFontsAsync',
  'loadFontAsync',
  'createImage',
  'getImageByHash',
  'exportFileAsync',
  'getPageThumbnail',
  'currentUser',
  'activeUsers',
  'clientStorage'
];

const NODE_PROPS = [
  'id',
  'name',
  'type',
  'parent',
  'children',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'visible',
  'opacity',
  'isMask',
  'blendMode',
  'fills',
  'strokes',
  'strokeWeight',
  'strokeAlign',
  'dashPattern',
  'effects',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'constraints',
  'layoutMode',
  'layoutAlign',
  'layoutGrow',
  'primaryAxisSpacing',
  'counterAxisSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'clipsContent',
  'characters',
  'fontSize',
  'fontName',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'paragraphSpacing',
  'paragraphIndent',
  'textAlignHorizontal',
  'textAlignVertical',
  'textStyles',
  'fillsStyles',
  'boundVariables',
  'boundVariableFields',
  'componentId',
  'componentKey',
  'mainComponent',
  'variantProperties',
  'exportSettings',
  'layoutGrids',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight'
];

const DETAIL_PROPS = [
  'fills',
  'strokes',
  'effects',
  'boundVariables',
  'boundVariableFields',
  'fontName',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'characters',
  'layoutMode',
  'primaryAxisSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'cornerRadius',
  'textStyles',
  'fillsStyles',
  'componentId',
  'componentKey',
  'variantProperties',
  'mainComponent',
  'constraints'
];

const NODE_METHODS = ['exportAsync', 'fillGeometry', 'hasMissingFont'];

interface ReadProbe {
  name: string;
  available: boolean;
  ok: boolean;
  count?: number;
  keys?: string[];
  sample?: unknown;
  error?: string;
}

interface NodeProbe {
  id: string;
  name: string;
  type: string;
  present: Record<string, string>;
  missing: string[];
  methods?: Record<string, string>;
  values?: Record<string, unknown>;
  childTypes?: Record<string, number>;
  children?: Array<Record<string, unknown>>;
  error?: string;
}

const CHILD_SUMMARY_LIMIT = 20;

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

function readChildValue(node: unknown, prop: string): unknown {
  try {
    const value = (node as Record<string, unknown>)[prop];
    if (value === undefined) return 'missing';
    if (Array.isArray(value)) return `array(${value.length})`;
    return value as string | number | boolean;
  } catch (error) {
    return `threw: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function summarize(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 2).map(item => summarize(item));
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 12);
    return Object.fromEntries(entries.map(([key, item]) => [key, summarize(item)]));
  }
  if (typeof value === 'string' && value.length > 80) return `${value.slice(0, 80)}…`;
  return value;
}

async function readProbe(name: string, run: () => unknown): Promise<ReadProbe> {
  const api = pixso as unknown as Record<string, unknown>;
  if (!(name in api)) return { name, available: false, ok: false, error: 'not declared on pixso' };
  try {
    const value = await run();
    if (Array.isArray(value)) {
      const first = value[0] as Record<string, unknown> | undefined;
      return {
        name,
        available: true,
        ok: true,
        count: value.length,
        keys: first ? Object.keys(first).slice(0, 20) : [],
        sample: summarize(first)
      };
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      return {
        name,
        available: true,
        ok: true,
        count: entries.length,
        keys: entries.slice(0, 20).map(([key]) => key),
        sample: summarize(Object.fromEntries(entries.slice(0, 3)))
      };
    }
    return { name, available: true, ok: true, count: 0, sample: summarize(value) };
  } catch (error) {
    return { name, available: true, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function callApi(name: string): unknown {
  const api = pixso as unknown as Record<string, unknown>;
  const value = api[name];
  if (typeof value === 'function') return (value as () => unknown).call(pixso);
  return value;
}

function isNodeLike(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && typeof value.type === 'string' && typeof value.name === 'string';
}

function summarizeValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 8).map(item => summarizeValue(item, depth));
  if (depth > 4) return `<max-depth ${describe(value)}>`;
  const record = value as Record<string, unknown>;
  if (isNodeLike(record)) return { node: record.id, type: record.type, name: record.name };
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, summarizeValue(item, depth + 1)]));
}

function resolveNode(id: string): unknown {
  const getNodeById = (pixso as unknown as { getNodeById?: (id: string) => unknown }).getNodeById;
  if (typeof getNodeById !== 'function') return undefined;
  return getNodeById.call(pixso, id);
}

function probeNode(target: { id: string; name: string; type: string }, deep: boolean): NodeProbe {
  let node: unknown;
  try {
    node = resolveNode(target.id);
  } catch (error) {
    return {
      ...target,
      present: {},
      missing: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
  if (!node) return { ...target, present: {}, missing: [], error: 'getNodeById returned nothing' };

  const record = node as unknown as Record<string, unknown>;
  const present: Record<string, string> = {};
  const missing: string[] = [];
  for (const prop of NODE_PROPS) {
    let value: unknown;
    try {
      value = record[prop];
    } catch (error) {
      missing.push(`${prop} (threw: ${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    if (value === undefined) missing.push(prop);
    else present[prop] = describe(value);
  }

  const methods: Record<string, string> = {};
  for (const method of NODE_METHODS) {
    try {
      const value = record[method];
      methods[method] = value === undefined ? 'missing' : typeof value;
    } catch (error) {
      methods[method] = `threw: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  const probe: NodeProbe = { ...target, present, missing, methods };
  if (deep) {
    const values: Record<string, unknown> = {};
    for (const prop of DETAIL_PROPS) {
      try {
        const value = record[prop];
        if (value !== undefined) values[prop] = summarizeValue(value);
      } catch (error) {
        values[prop] = `threw: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    probe.values = values;
    const childNodes = (record.children as SceneNodeLike[] | undefined) ?? [];
    const childTypes: Record<string, number> = {};
    for (const child of childNodes) {
      childTypes[child.type] = (childTypes[child.type] ?? 0) + 1;
    }
    probe.childTypes = childTypes;
    if (childNodes.length) {
      probe.children = childNodes.slice(0, CHILD_SUMMARY_LIMIT).map(child => ({
        id: child.id,
        name: child.name,
        type: child.type,
        width: readChildValue(child, 'width'),
        height: readChildValue(child, 'height'),
        visible: readChildValue(child, 'visible'),
        childCount: readChildValue(child, 'children')
      }));
    }
  }
  return probe;
}

function pickTargetNode(): { id: string; name: string; type: string } | undefined {
  const pages = [pixso.currentPage, ...(pixso.root?.children ?? [])];
  for (const page of pages) {
    for (const child of page?.children ?? []) {
      const stack: SceneNodeLike[] = [child];
      let visited = 0;
      while (stack.length && visited < 200) {
        const node = stack.shift() as SceneNodeLike;
        visited += 1;
        const record = node as unknown as Record<string, unknown>;
        const hasPaints = Array.isArray(record.fills) && (record.fills as unknown[]).length > 0;
        const hasText = typeof record.characters === 'string' && record.characters.length > 0;
        if (hasPaints || hasText) return { id: node.id, name: node.name, type: node.type };
        for (const next of (node.children ?? []) as SceneNodeLike[]) stack.push(next);
      }
    }
  }
  const fallback = pixso.currentPage?.children?.[0];
  return fallback ? { id: fallback.id, name: fallback.name, type: fallback.type } : undefined;
}

export interface ProbeApiInput {
  nodeIds?: string[];
}

function probeContext(): Record<string, unknown> {
  const api = pixso as unknown as Record<string, unknown>;
  const selection = (pixso.currentPage as unknown as { selection?: unknown[] })?.selection;
  const user = api.currentUser as Record<string, unknown> | undefined;
  return {
    apiVersion: api.apiVersion,
    editorType: api.editorType,
    command: api.command,
    origin: api.origin,
    fileKey: api.fileKey,
    pluginId: api.pluginId,
    currentUser: user ? { id: user.id, name: user.name } : undefined,
    documentName: pixso.root?.name,
    pageCount: pixso.root?.children?.length,
    currentPageName: pixso.currentPage?.name,
    currentPageChildren: pixso.currentPage?.children?.length,
    selectionCount: Array.isArray(selection) ? selection.length : describe(selection),
    pixsoOn: describe(api['on'])
  };
}

function targetForId(id: string): { id: string; name: string; type: string } {
  try {
    const node = resolveNode(id) as Record<string, unknown> | undefined;
    if (node) return { id, name: String(node.name ?? ''), type: String(node.type ?? '') };
  } catch {
    /* fall through to an unresolved target */
  }
  return { id, name: '', type: '' };
}

export async function probeApi(input: ProbeApiInput = {}): Promise<Record<string, unknown>> {
  const nodeIds = Array.from(input.nodeIds ?? [])
    .filter(id => typeof id === 'string' && id.length > 0)
    .slice(0, 6);
  if (nodeIds.length > 0) {
    return {
      mode: 'nodes',
      context: probeContext(),
      nodes: nodeIds.map(id => probeNode(targetForId(id), true))
    };
  }

  const api = pixso as unknown as Record<string, unknown>;
  const surfaces = API_SURFACES.map(name => ({ name, kind: describe(api[name]) }));

  const reads: ReadProbe[] = [];
  for (const name of [
    'getLocalPaintStyles',
    'getLocalTextStyles',
    'getLocalEffectStyles',
    'getLocalGridStyles',
    'getLocalComponents',
    'getLibraryListAsync',
    'getLibraryComponentsInUse',
    'getLibraryStylesInUse',
    'listAvailableFontsAsync'
  ]) {
    reads.push(await readProbe(name, () => callApi(name)));
  }

  const target = pickTargetNode();

  return {
    mode: 'surfaces',
    context: probeContext(),
    surfaces,
    reads,
    node: target ? probeNode(target, false) : undefined
  };
}
