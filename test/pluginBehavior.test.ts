import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const pluginMain = 'pixso-plugin/main.js';

function createNode(overrides) {
  const node = {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type,
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fills: [],
    strokes: [],
    effects: [],
    children: [],
    ...overrides
  };

  node.children = overrides.children || [];
  for (const child of node.children) child.parent = node;
  return node;
}

function createDesignFixture() {
  const exportCalls = [];
  const text = createNode({
    id: 'text-placeholder',
    type: 'TEXT',
    name: 'Search placeholder',
    characters: 'Поиск',
    width: 120,
    height: 20,
    fontName: { family: 'Test Sans', style: 'Regular' },
    fontSize: 16,
    lineHeight: { unit: 'PIXELS', value: 20 },
    letterSpacing: { unit: 'PERCENT', value: -1.999999955 },
    fills: [{ type: 'SOLID', color: { r: 0.031, g: 0.031, b: 0.031 }, opacity: 0.7 }]
  });

  let nestedTextBranch = text;
  for (let index = 5; index >= 1; index -= 1) {
    nestedTextBranch = createNode({
      id: `nested-${index}`,
      type: 'FRAME',
      name: `Nested ${index}`,
      width: 300,
      height: 60,
      children: [nestedTextBranch]
    });
  }

  const canvas = createNode({
    id: 'canvas',
    type: 'FRAME',
    name: 'Canvas',
    width: 1661,
    height: 1080,
    exportSettings: [{ format: 'SVG' }],
    async exportAsync(settings) {
      exportCalls.push({ nodeId: 'canvas', settings });
      return new Uint8Array([1, 2, 3]);
    },
    children: [
      createNode({ id: 'canvas-child-1', type: 'FRAME', name: 'Content A', width: 100, height: 100 }),
      createNode({ id: 'canvas-child-2', type: 'FRAME', name: 'Content B', width: 100, height: 100 })
    ]
  });

  const icon = createNode({
    id: 'search-icon',
    type: 'VECTOR',
    name: 'Search icon',
    width: 24,
    height: 24,
    exportSettings: [{ format: 'SVG' }],
    async exportAsync(settings) {
      exportCalls.push({ nodeId: 'search-icon', settings });
      return new Uint8Array([1, 2, 3]);
    }
  });

  const cssText = createNode({
    id: 'css-text',
    type: 'TEXT',
    name: 'Primary Label',
    characters: 'Hello CSS',
    x: 16,
    y: 16,
    width: 120,
    height: 20,
    fontName: { family: 'Test Sans', style: 'Semibold' },
    fontSize: 16,
    lineHeight: { unit: 'PIXELS', value: 20 },
    letterSpacing: { unit: 'PERCENT', value: -2 },
    textAlignHorizontal: 'CENTER',
    textAlignVertical: 'TOP',
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textStyleId: 'style-text',
    fillStyleId: 'style-text-fill',
    fills: [{ type: 'SOLID', color: { r: 0.02, g: 0.02, b: 0.02 }, opacity: 1 }]
  });
  const cssCard = createNode({
    id: 'css-card',
    type: 'FRAME',
    name: 'CSS Card',
    x: 20,
    y: 10,
    width: 200.3,
    height: 80,
    layoutMode: 'VERTICAL',
    layoutWrap: 'NO_WRAP',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    itemSpacing: 8,
    counterAxisSpacing: 0,
    layoutAlign: 'INHERIT',
    layoutGrow: 0,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
    fillStyleId: 'style-fill',
    strokes: [{ type: 'SOLID', color: { r: 0.8, g: 0.82, b: 0.86 }, opacity: 1 }],
    strokeStyleId: 'style-stroke',
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
    cornerRadius: 12,
    topLeftRadius: 12,
    topRightRadius: 12,
    bottomRightRadius: 12,
    bottomLeftRadius: 12,
    effects: [{
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.12 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true
    }],
    effectStyleId: 'style-shadow',
    children: [cssText]
  });
  const cssFractionalLeaf = createNode({
    id: 'css-fractional-leaf',
    type: 'RECTANGLE',
    name: 'Fractional Pill',
    x: 300,
    y: 10,
    width: 21.3,
    height: 10,
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.4 }, opacity: 1 }]
  });
  const cssFiller = createNode({
    id: 'css-filler',
    type: 'FRAME',
    name: 'CSS Filler',
    x: 232,
    y: 10,
    width: 68,
    height: 80,
    layoutAlign: 'STRETCH',
    layoutGrow: 1,
    fills: [{ type: 'SOLID', color: { r: 0.94, g: 0.96, b: 1 }, opacity: 1 }]
  });
  const cssFrame = createNode({
    id: 'css-frame',
    type: 'FRAME',
    name: 'CSS Frame',
    x: 0,
    y: 1200,
    width: 320,
    height: 120,
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'NO_WRAP',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 10,
    paddingBottom: 10,
    itemSpacing: 12,
    counterAxisSpacing: 0,
    children: [cssCard, cssFiller, cssFractionalLeaf]
  });
  const cssDefaultChild = createNode({
    id: 'css-default-child',
    type: 'RECTANGLE',
    name: 'Default Child',
    width: 20,
    height: 20
  });
  const cssDefaults = createNode({
    id: 'css-defaults',
    type: 'FRAME',
    name: 'CSS Defaults',
    x: 360,
    y: 1200,
    width: 120,
    height: 40,
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'NO_WRAP',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    itemSpacing: 0,
    counterAxisSpacing: 0,
    children: [cssDefaultChild]
  });
  const complexExportFrame = createNode({
    id: 'complex-export-frame',
    type: 'FRAME',
    name: 'Complex Export Frame',
    width: 360,
    height: 240,
    children: Array.from({ length: 140 }, (_, index) => createNode({
      id: `complex-export-child-${index}`,
      type: index % 5 === 0 ? 'TEXT' : 'RECTANGLE',
      name: `Complex Export Child ${index}`,
      x: (index % 20) * 16,
      y: Math.floor(index / 20) * 24,
      width: 12,
      height: 12,
      characters: index % 5 === 0 ? `Item ${index}` : undefined
    }))
  });

  const frame = createNode({
    id: 'screen',
    type: 'FRAME',
    name: 'Screen',
    width: 1920,
    height: 1080,
    children: [nestedTextBranch, canvas, icon]
  });
  const duplicateFrame = createNode({
    id: 'screen-duplicate',
    type: 'FRAME',
    name: 'Screen',
    x: 2000,
    y: 0,
    width: 1920,
    height: 1080,
    children: []
  });
  const page = createNode({ id: 'page', type: 'PAGE', name: 'Page', children: [frame, duplicateFrame, cssFrame, cssDefaults, complexExportFrame], selection: [frame] });
  const root = createNode({ id: 'root', type: 'DOCUMENT', name: 'Root', children: [page] });
  return { root, page, exportCalls };
}

function findNodeById(root, nodeId) {
  if (!root) return undefined;
  if (root.id === nodeId) return root;
  for (const child of root.children || []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

function createPluginHarness() {
  const source = readFileSync(pluginMain, 'utf8');
  const fixture = createDesignFixture();
  const messages = [];
  const pixso = {
    mixed: Symbol('mixed'),
    root: fixture.root,
    currentPage: fixture.page,
    ui: {
      onmessage: undefined,
      postMessage(message) {
        messages.push(message);
      }
    },
    showUI() {},
    getNodeById(nodeId) {
      return findNodeById(fixture.root, nodeId);
    },
    async getNodeByIdAsync(nodeId) {
      return findNodeById(fixture.root, nodeId);
    },
    getStyleById(styleId) {
      const styles = {
        'style-fill': { id: 'style-fill', type: 'PAINT', name: 'Surface/Card', paints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }] },
        'style-stroke': { id: 'style-stroke', type: 'PAINT', name: 'Border/Subtle', paints: [{ type: 'SOLID', color: { r: 0.8, g: 0.82, b: 0.86 }, opacity: 1 }] },
        'style-shadow': { id: 'style-shadow', type: 'EFFECT', name: 'Shadow/Card', effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.12 }, offset: { x: 0, y: 4 }, radius: 16, spread: 0, visible: true }] },
        'style-text': { id: 'style-text', type: 'TEXT', name: 'Body/Semibold', fontName: { family: 'Test Sans', style: 'Semibold' }, fontSize: 16, lineHeight: { unit: 'PIXELS', value: 20 }, letterSpacing: { unit: 'PERCENT', value: -2 } },
        'style-text-fill': { id: 'style-text-fill', type: 'PAINT', name: 'Text/Primary', paints: [{ type: 'SOLID', color: { r: 0.02, g: 0.02, b: 0.02 }, opacity: 1 }] }
      };
      return styles[styleId] || null;
    }
  };

  vm.runInNewContext(source, { pixso, __html__: '', console, Uint8Array, setTimeout, clearTimeout });

  async function callPlugin(command, input) {
    messages.length = 0;
    await pixso.ui.onmessage({ type: 'mcp-command', message: { id: 'test', command, input } });
    const response = messages[0] && messages[0].response;
    if (!response || !response.ok) throw new Error(response && response.error ? response.error : 'Plugin command failed');
    return response.result;
  }

  return { callPlugin, fixture, messages, pixso };
}

describe('Pixso plugin extraction behavior', () => {
  it('collects nested typography in balanced mode and preserves percent letter spacing precision', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      detail: 'balanced',
      includeAssets: false,
      includeTokens: false,
      includeComponentHints: false,
      maxNodes: 100,
      maxTextChars: 1000
    });

    expect(result.stats.layoutTextNodeCount).toBe(0);
    expect(result.typography.coverage.textNodesFound).toBe(1);
    expect(result.typography.coverage.layoutTreeMissedText).toBe(true);
    expect(result.typography.coverage.guidance.notes).toEqual(expect.arrayContaining([
      'Text was found by the dedicated typography pass but not in the bounded layout tree.'
    ]));
    expect(result.typography.textNodes[0].css.letterSpacing).toBe('-0.02em');
    expect(result.typography.textNodes[0].raw.letterSpacing.value).toBeCloseTo(-1.999999955);
  });

  it('marks overlapping child measurements so negative gaps are not used as CSS gaps', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      detail: 'balanced',
      includeAssets: false,
      includeTokens: false,
      includeComponentHints: false,
      maxNodes: 100
    });

    const canvasAnalysis = result.layout.spacingAnalysis.find(item => item.parentNodeId === 'canvas');
    expect(canvasAnalysis.measured.gapReliability).toBe('overlap-detected');
    expect(canvasAnalysis.measured.negativeColumnGaps).toEqual(expect.arrayContaining([-100]));
    expect(canvasAnalysis.cssSuggestion).not.toContain('gap:-');
    expect(result.layout.computedLayout.layoutWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'canvas', issue: expect.stringContaining('negative measured gaps') })
    ]));
  });

  it('keeps layout containers out of the export queue while preserving icon candidates', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      detail: 'balanced',
      includeAssets: true,
      includeTokens: false,
      includeComponentHints: false,
      maxNodes: 100
    });

    expect(result.assets.layoutContainersIgnored).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'canvas',
        kind: 'container',
        usageHint: 'layout-container',
        confidence: 'low',
        recommendedAction: 'ignore-container'
      })
    ]));
    expect(result.assets.exportQueue.some(item => item.nodeId === 'canvas')).toBe(false);
    expect(result.assets.iconCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'search-icon',
        kind: 'icon',
        usageHint: 'icon',
        confidence: 'high',
        recommendedAction: 'reuse-existing-icon'
      })
    ]));
  });


  it('returns compact primary coding context without raw tree and points CSS to secondary drill-down', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      profile: 'compact',
      includeAssets: true,
      includeTokens: false,
      includeComponentHints: false,
      maxNodes: 100
    });

    expect(result.version).toBe('0.4');
    expect(result.profile).toBe('compact');
    expect(result.layout.tree).toBeUndefined();
    expect(result.layout.rawTreeOmitted).toBe(true);
    expect(result.nodeIndex).toBeDefined();
    expect(result.regions.length).toBeGreaterThan(0);
    expect(result.cssSummary.recommendedCall.tool).toBe('get_css_context');
    expect(result.cssSummary.recommendedCall.args.guidanceProfile).toBe('agent');
    expect(result.nextRecommendedCalls[0]).toEqual(expect.objectContaining({ tool: 'get_css_context' }));
    expect(result.nextRecommendedCalls[0].args.guidanceProfile).toBe('agent');
  });

  it('returns compact CSS as key rules plus duplicate rule groups with alias selectors', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_css_context', {
      nodeId: 'css-frame',
      mode: 'compact',
      scope: 'key',
      groupDuplicates: true,
      omitDefaults: true,
      selectorStrategy: 'alias',
      includeStyleResolution: false
    });

    expect(result.version).toBe('0.4');
    expect(result.mode).toBe('compact');
    expect(result.scope).toBe('key');
    expect(result.keyRules.length).toBeGreaterThan(0);
    expect(result.keyRules[0].selector).toMatch(/^\.px-n/);
    expect(Array.isArray(result.ruleGroups || [])).toBe(true);
    expect(result.omitted).toEqual(expect.objectContaining({ nonKeyNodes: expect.any(Number) }));
  });

  it('classifies related frame candidates by usefulness', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('find_related_frames', {
      nodeId: 'screen',
      maxResults: 5,
      strategies: ['sameName', 'nearbyFrames', 'sizes']
    });

    expect(result.candidates[0]).toEqual(expect.objectContaining({
      id: 'screen-duplicate',
      category: 'same-screen-duplicate',
      confidence: 'high'
    }));
    expect(result.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'same-screen-duplicate', count: 1 })
    ]));
  });

  it('honors traversal result limits instead of collecting sibling nodes past the cap', async () => {
    const { callPlugin } = createPluginHarness();

    const frames = await callPlugin('list_frames', {
      rootNodeId: 'page',
      maxResults: 1,
      depth: 2
    });
    expect(frames.frames).toHaveLength(1);
    expect(frames.truncated).toBe(true);

    const search = await callPlugin('search_nodes', {
      rootNodeId: 'page',
      query: 'frame',
      maxResults: 1
    });
    expect(search.results).toHaveLength(1);
    expect(search.truncated).toBe(true);
  });

  it('uses performance budget to skip optional context sections instead of timing out', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      detail: 'balanced',
      performanceProfile: 'balanced',
      budgetMs: 500,
      includeAssets: false,
      includeVariables: true,
      includeStyles: true,
      includeComponentHints: true,
      maxNodes: 100
    });

    expect(result.performance.partial).toBe(true);
    expect(result.performance.skippedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'variables' }),
      expect.objectContaining({ name: 'styles' }),
      expect.objectContaining({ name: 'components' })
    ]));
    expect(result.extractionQuality.completeness).toBe('partial-budget');
  });

  it('keeps deep extraction safe by default and recommends safe follow-up calls', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      detail: 'deep',
      performanceProfile: 'deep',
      includeAssets: false,
      maxNodes: 100
    });

    expect(result.performance.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'variables', skipped: true, reason: 'disabled by options' }),
      expect.objectContaining({ name: 'styles', skipped: true, reason: 'disabled by options' }),
      expect.objectContaining({ name: 'components', skipped: true, reason: 'disabled by options' })
    ]));
    expect(result.performance.partial).toBe(false);
    expect(result.performance.skippedSections).toBeUndefined();
    expect(result.performance.disabledSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'variables', reason: 'disabled by options' }),
      expect.objectContaining({ name: 'styles', reason: 'disabled by options' }),
      expect.objectContaining({ name: 'components', reason: 'disabled by options' })
    ]));
    expect(result.extractionQuality.completeness).toBe('visible-state-good');
    expect(result.nextRecommendedCalls[0]).toEqual(expect.objectContaining({ tool: 'get_css_context' }));
    expect(result.nextRecommendedCalls[0].args.guidanceProfile).toBe('agent');
    expect(result.nextRecommendedCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: 'get_export_preview' })
    ]));
    expect(JSON.stringify(result.nextRecommendedCalls)).not.toContain('\"includeTokens\":true');
  });

  it('resolves design-system style refs in get_coding_context via getStyleById fallback', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_coding_context', {
      nodeId: 'css-card',
      detail: 'compact',
      includeAssets: false,
      includeVariables: false,
      includeStyles: true,
      includeComponentHints: false,
      includeScreenshot: 'none',
      maxNodes: 40
    });

    expect(result.designSystemRefs.usedStyles).toEqual(expect.arrayContaining([
      expect.objectContaining({ styleId: 'style-fill', styleName: 'Surface/Card', styleSource: 'getStyleById' }),
      expect.objectContaining({ styleId: 'style-text', styleName: 'Body/Semibold', styleSource: 'getStyleById' }),
      expect.objectContaining({ styleId: 'style-text-fill', styleName: 'Text/Primary', styleSource: 'getStyleById' })
    ]));
    expect(result.designSystemRefs.resolvedStyles).toEqual(expect.arrayContaining([
      expect.objectContaining({ styleId: 'style-fill', styleName: 'Surface/Card', source: 'getStyleById' }),
      expect.objectContaining({ styleId: 'style-text-fill', styleName: 'Text/Primary', source: 'getStyleById' })
    ]));
    expect(result.designSystemRefs.unresolvedStyleIds).toBeUndefined();
    expect(result.designSystemRefs.probableRemoteOrLibraryStyles).toBeUndefined();
  });

  it('returns structured CSS rules with source confidence and resolved style refs', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_css_context', {
      nodeId: 'css-frame',
      mode: 'balanced',
      depth: 2,
      includeStyleResolution: true,
      selectorStrategy: 'name'
    });

    expect(result.cssText).toContain('.css-frame {');
    expect(result.cssText).toContain('display: flex;');
    expect(result.cssText).toContain('gap: 12px;');
    expect(result.cssText).toContain('padding: 10px 20px;');
    expect(result.cssText).toContain('border-radius: 12px;');
    expect(result.cssText).toContain('box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.12);');
    expect(result.cssText).toContain('font-family: "Test Sans";');
    expect(result.cssText).not.toContain('margin');

    const rootRule = result.rules.find(rule => rule.nodeId === 'css-frame');
    expect(rootRule.layoutModel).toBe('auto-layout-flex');
    expect(rootRule.declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'gap', value: '12px', source: 'layout.itemSpacing', confidence: 'high' }),
      expect.objectContaining({ property: 'padding', value: '10px 20px', source: 'layout.padding*', confidence: 'high' })
    ]));

    const fillerRule = result.rules.find(rule => rule.nodeId === 'css-filler');
    expect(fillerRule.declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'flex', value: '1 1 0', source: 'layout.layoutGrow', confidence: 'high' }),
      expect.objectContaining({ property: 'align-self', value: 'stretch', source: 'layout.layoutAlign', confidence: 'high' })
    ]));
    expect(fillerRule.declarations.some(item => item.property === 'width')).toBe(false);
    expect(fillerRule.declarations.some(item => item.property === 'height')).toBe(false);

    expect(result.styleRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ styleId: 'style-fill', status: 'resolved', source: 'getStyleById', styleName: 'Surface/Card' }),
      expect.objectContaining({ styleId: 'style-text', status: 'resolved', styleName: 'Body/Semibold' })
    ]));
    expect(result.stats.highConfidenceCount).toBeGreaterThan(10);
  });

  it('returns agent CSS guidance with compact omitted reason codes', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_css_context', {
      nodeId: 'css-frame',
      mode: 'balanced',
      depth: 2,
      selectorStrategy: 'name',
      guidanceProfile: 'agent',
      declarationMetadata: 'compact',
      includeStyleResolution: true
    });

    expect(result.guidanceProfile).toBe('agent');
    expect(result.cssText).toBe(result.implementationCssText);
    expect(result.cssText).toContain('.css-frame {');
    expect(result.cssText).toContain('display: flex;');
    expect(result.cssText).not.toContain('width: 320px;');
    expect(result.omittedDeclarationSummary.byReason['root-size']).toBeGreaterThan(0);
    expect(result.omittedDeclarationSummary.byReason['fixed-container']).toBeGreaterThan(0);
    expect(result.reasonCatalog['root-size']).toBe('root frame measurement');
    expect(result.omittedDeclarationSamples.length).toBeLessThanOrEqual(40);
    expect(result.omittedDeclarationSamples[0]).toEqual(expect.objectContaining({
      property: expect.any(String),
      usage: expect.stringMatching(/adapt|evidence/),
      reason: expect.any(String)
    }));
    expect(result.omittedDeclarationSamples[0].omitReason).toBeUndefined();

    const fractionalRule = result.rules.find(rule => rule.nodeId === 'css-fractional-leaf');
    expect(fractionalRule.declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'width', value: '21.3px', usage: 'adapt', reason: 'fractional' })
    ]));
  });

  it('keeps default/no-op omissions compact in agent guidance', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_css_context', {
      nodeId: 'css-defaults',
      mode: 'compact',
      depth: 1,
      selectorStrategy: 'name',
      guidanceProfile: 'agent',
      includeStyleResolution: false
    });

    expect(result.cssText).not.toContain('gap: 0;');
    expect(result.cssText).not.toContain('padding: 0;');
    expect(result.omittedDeclarationSummary.byReason.default).toBeGreaterThan(0);
    expect(Object.keys(result.reasonCatalog)).toEqual(expect.arrayContaining(['default', 'root-size']));
    expect(result.omittedDeclarationSamples).toBeUndefined();
    expect(result.options.declarationMetadata).toBe('none');
    expect(result.rules[0].declarations[0].source).toBeUndefined();
    expect(result.rules[0].declarations[0].usage).toBeUndefined();
  });

  it('keeps agent omitted metadata aggregate-only when declaration metadata is disabled', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_css_context', {
      nodeId: 'css-frame',
      mode: 'balanced',
      depth: 2,
      guidanceProfile: 'agent',
      declarationMetadata: 'none',
      includeStyleResolution: false
    });

    expect(result.omittedDeclarationSummary.byReason['root-size']).toBeGreaterThan(0);
    expect(result.omittedDeclarationSamples).toBeUndefined();
    expect(result.rules[0].declarations[0]).toEqual(expect.objectContaining({
      property: expect.any(String),
      value: expect.any(String)
    }));
    expect(result.rules[0].declarations[0].source).toBeUndefined();
    expect(result.rules[0].declarations[0].usage).toBeUndefined();
  });

  it('does not translate overlapping measured gaps into high-confidence margin or gap', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_css_context', {
      nodeId: 'canvas',
      mode: 'balanced',
      depth: 1,
      includeLowConfidence: false,
      includeStyleResolution: false
    });

    expect(result.cssText).not.toContain('gap: -');
    expect(result.cssText).not.toContain('margin');
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('measured gaps were not converted to CSS gap or margin')
    ]));
  });

  it('previews large exports and rejects risky screenshots before exportAsync', async () => {
    const { callPlugin, fixture } = createPluginHarness();
    const preview = await callPlugin('get_export_preview', {
      nodeId: 'canvas',
      format: 'PNG',
      scale: 1,
      maxPixels: 10000
    });

    expect(preview.risk).toBe('high');
    expect(preview.wouldReject).toBe(true);
    expect(preview.recommendedCall.tool).toBe('get_screenshot');
    expect(preview.recommendedCall.arguments.format).toBeUndefined();
    expect(fixture.exportCalls).toEqual([]);

    await expect(callPlugin('get_screenshot', {
      nodeId: 'canvas',
      scale: 1,
      maxPixels: 10000
    })).rejects.toThrow('Pixso export rejected before exportAsync');
    expect(fixture.exportCalls).toEqual([]);
  });

  it('rejects complex container screenshots before native export even when maxWidth is small', async () => {
    const { callPlugin, fixture } = createPluginHarness();
    const preview = await callPlugin('get_export_preview', {
      nodeId: 'complex-export-frame',
      format: 'PNG',
      scale: 1,
      maxWidth: 160,
      maxPixels: 1000000
    });

    expect(preview.pixelRisk).toBe('low');
    expect(preview.complexityRisk).toBe('high');
    expect(preview.risk).toBe('high');
    expect(preview.wouldReject).toBe(true);
    expect(preview.rejectionReasons).toEqual(expect.arrayContaining([
      expect.stringContaining('raster export of')
    ]));

    await expect(callPlugin('get_screenshot', {
      nodeId: 'complex-export-frame',
      scale: 1,
      maxWidth: 160,
      maxPixels: 1000000
    })).rejects.toThrow('Pixso export rejected before exportAsync');
    expect(fixture.exportCalls).toEqual([]);
  });

  it('exports screenshots without depending on browser btoa', async () => {
    const { callPlugin } = createPluginHarness();
    const result = await callPlugin('get_screenshot', {
      nodeId: 'search-icon',
      scale: 1,
      maxPixels: 10000
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.dataBase64).toBe('AQID');
  });

  it('returns valid follow-up arguments from export previews', async () => {
    const { callPlugin } = createPluginHarness();
    const pngPreview = await callPlugin('get_export_preview', {
      nodeId: 'screen',
      format: 'PNG',
      scale: 1,
      maxWidth: 900,
      maxPixels: 2500000
    });
    expect(pngPreview.recommendedCall.tool).toBe('get_screenshot');
    expect(pngPreview.recommendedCall.arguments.format).toBeUndefined();
    expect(pngPreview.recommendedCall.arguments.maxWidth).toBe(900);
    expect(pngPreview.recommendedCall.arguments.scale).toBeCloseTo(0.469);

    const svgPreview = await callPlugin('get_export_preview', {
      nodeId: 'search-icon',
      format: 'SVG',
      maxWidth: 900
    });
    expect(svgPreview.recommendedCall.tool).toBe('export_asset');
    expect(svgPreview.recommendedCall.arguments.format).toBe('SVG');
    expect(svgPreview.recommendedCall.arguments.maxWidth).toBeUndefined();
  });

  it('does not let health clear the active heavy command lock', async () => {
    const { fixture, messages, pixso } = createPluginHarness();
    const canvas = findNodeById(fixture.root, 'canvas');
    let resolveExport;
    let exportStartedResolve;
    const exportStarted = new Promise(resolve => {
      exportStartedResolve = resolve;
    });

    canvas.exportAsync = async settings => {
      fixture.exportCalls.push({ nodeId: 'canvas', settings });
      exportStartedResolve();
      return new Promise(resolve => {
        resolveExport = () => resolve(new Uint8Array([1, 2, 3]));
      });
    };

    const screenshotPromise = pixso.ui.onmessage({
      type: 'mcp-command',
      message: { id: 'shot', command: 'get_screenshot', input: { nodeId: 'canvas', scale: 1 } }
    });
    await exportStarted;

    await pixso.ui.onmessage({
      type: 'mcp-command',
      message: { id: 'health', command: 'health', input: {} }
    });
    const healthResponse = messages.find(message => message.response.id === 'health').response;
    expect(healthResponse.ok).toBe(true);
    expect(healthResponse.result.plugin.busy).toBe(true);
    expect(healthResponse.result.plugin.currentCommand.command).toBe('get_screenshot');

    await pixso.ui.onmessage({
      type: 'mcp-command',
      message: { id: 'deep', command: 'get_coding_context', input: { detail: 'deep' } }
    });
    const deepResponse = messages.find(message => message.response.id === 'deep').response;
    expect(deepResponse.ok).toBe(false);
    expect(deepResponse.error).toContain('busy with get_screenshot');

    resolveExport();
    await screenshotPromise;
    const screenshotResponse = messages.find(message => message.response.id === 'shot').response;
    expect(screenshotResponse).toBeDefined();
    expect(screenshotResponse.ok).toBe(true);

    await pixso.ui.onmessage({
      type: 'mcp-command',
      message: { id: 'health-after-shot', command: 'health', input: {} }
    });
    const finalHealthResponse = messages.find(message => message.response.id === 'health-after-shot').response;
    expect(finalHealthResponse.result.plugin.busy).toBe(false);
  });

  it('times out stalled exports and clears the heavy command lock', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, messages, pixso } = createPluginHarness();
      const canvas = findNodeById(fixture.root, 'canvas');
      canvas.exportAsync = async () => new Promise(() => {});

      const screenshotPromise = pixso.ui.onmessage({
        type: 'mcp-command',
        message: { id: 'stalled-shot', command: 'get_screenshot', input: { nodeId: 'canvas', scale: 1 } }
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(15001);
      await screenshotPromise;

      const screenshotResponse = messages.find(message => message.response.id === 'stalled-shot').response;
      expect(screenshotResponse.ok).toBe(false);
      expect(screenshotResponse.error).toContain('Pixso exportAsync timed out');

      await pixso.ui.onmessage({
        type: 'mcp-command',
        message: { id: 'health-after-timeout', command: 'health', input: {} }
      });
      const healthResponse = messages.find(message => message.response.id === 'health-after-timeout').response;
      expect(healthResponse.result.plugin.busy).toBe(false);
      expect(healthResponse.result.plugin.nativeExport.healthy).toBe(false);
      expect(healthResponse.result.plugin.nativeExport.lastFailure.nodeId).toBe('canvas');

      const exportCallsBeforeCircuitCheck = fixture.exportCalls.length;
      await pixso.ui.onmessage({
        type: 'mcp-command',
        message: { id: 'export-after-timeout', command: 'export_asset', input: { nodeId: 'search-icon', format: 'SVG' } }
      });
      const exportAfterTimeout = messages.find(message => message.response.id === 'export-after-timeout').response;
      expect(exportAfterTimeout.ok).toBe(false);
      expect(exportAfterTimeout.error).toContain('native export circuit is open');
      expect(fixture.exportCalls).toHaveLength(exportCallsBeforeCircuitCheck);
    } finally {
      vi.useRealTimers();
    }
  });
});
