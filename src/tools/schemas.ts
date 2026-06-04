import { z } from 'zod/v4';

export const emptySchema = {};

export const getFileInfoSchema = {
  includeSelection: z.boolean().default(true).describe('Include current Pixso selection summary.')
};

export const listFramesSchema = {
  pageId: z.string().optional().describe('Pixso page id. Defaults to current page.'),
  rootNodeId: z.string().optional().describe('Optional root node id. Useful for listing frames under a selected section/frame.'),
  depth: z.number().int().min(0).max(8).default(2).describe('Traversal depth for nested frames.'),
  includeHidden: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(2000).default(300),
  types: z.array(z.string()).optional().describe('Node types to include, e.g. FRAME, SECTION, COMPONENT, COMPONENT_SET, INSTANCE.')
};

export const searchNodesSchema = {
  query: z.string().min(1).describe('Case-insensitive search query for node names.'),
  pageId: z.string().optional().describe('Pixso page id. Defaults to current page.'),
  rootNodeId: z.string().optional().describe('Optional root node id to limit search scope.'),
  types: z.array(z.string()).optional(),
  includeHidden: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(500).default(50)
};

export const getNodeTreeSchema = {
  nodeId: z.string().optional().describe('Root node id. Defaults to the first selected node.'),
  depth: z.number().int().min(0).max(12).default(3),
  maxNodes: z.number().int().min(1).max(3000).default(250),
  maxTextChars: z.number().int().min(0).max(20000).default(1000),
  detail: z.enum(['metadata', 'summary', 'full']).default('summary'),
  includeHidden: z.boolean().default(false),
  includeText: z.boolean().default(true),
  includeVectors: z.boolean().default(false),
  includeImages: z.boolean().default(false),
  includeTextRanges: z.boolean().default(false)
};

export const inspectNodeSchema = {
  nodeId: z.string().optional().describe('Node id. Defaults to the first selected node.'),
  detail: z.enum(['metadata', 'summary', 'full']).default('full'),
  maxTextChars: z.number().int().min(0).max(50000).default(5000),
  includeTextRanges: z.boolean().default(false),
  includeVariables: z.boolean().default(true),
  includeComponentInfo: z.boolean().default(true)
};

export const getSelectionContextSchema = {
  depth: z.number().int().min(0).max(8).default(2),
  maxNodes: z.number().int().min(1).max(1500).default(200),
  detail: z.enum(['metadata', 'summary', 'full']).default('summary'),
  includeScreenshotHint: z.boolean().default(true)
};

export const getDesignTokensSchema = {
  scopeNodeId: z.string().optional().describe('Node id to limit used-token extraction. Defaults to the first selected node or current page.'),
  includeUnusedLocalVariables: z.boolean().default(false),
  resolveAliases: z.boolean().default(true),
  types: z.array(z.enum(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'])).optional()
};

export const getStylesSchema = {
  types: z.array(z.enum(['paint', 'text', 'effect', 'grid'])).optional().describe('Style categories to fetch. Defaults to all supported categories.')
};

export const getComponentsSchema = {
  pageId: z.string().optional(),
  scopeNodeId: z.string().optional(),
  includeInstances: z.boolean().default(true),
  includeComponents: z.boolean().default(true),
  maxResults: z.number().int().min(1).max(2000).default(500)
};

export const getScreenshotSchema = {
  nodeId: z.string().optional().describe('Node id. Defaults to the first selected node.'),
  scale: z.number().min(0.1).max(4).default(1),
  maxWidth: z.number().int().min(100).max(4000).optional(),
  maxPixels: z.number().int().min(10000).max(25000000).default(2500000).describe('Reject export before calling Pixso if estimated pixels exceed this budget.'),
  allowLargeExport: z.boolean().default(false).describe('Allow exports above maxPixels. Use only after get_export_preview.'),
  contentsOnly: z.boolean().default(true).describe('Export only visible node contents. Matches the Pixso exportAsync default and avoids expanding to absolute bounds.')
};

export const exportAssetSchema = {
  nodeId: z.string().optional().describe('Node id. Defaults to the first selected node.'),
  format: z.enum(['SVG', 'PNG', 'JPG']).default('SVG'),
  scale: z.number().min(0.1).max(4).default(1),
  maxPixels: z.number().int().min(10000).max(25000000).default(2500000).describe('Reject raster export before calling Pixso if estimated pixels exceed this budget.'),
  allowLargeExport: z.boolean().default(false).describe('Allow raster exports above maxPixels. Use only after get_export_preview.'),
  contentsOnly: z.boolean().default(true),
  useAbsoluteBounds: z.boolean().default(false)
};

export const getExportPreviewSchema = {
  nodeId: z.string().optional().describe('Node id. Defaults to the first selected node.'),
  format: z.enum(['SVG', 'PNG', 'JPG']).default('PNG'),
  scale: z.number().min(0.1).max(4).default(1),
  maxWidth: z.number().int().min(100).max(4000).optional(),
  maxPixels: z.number().int().min(10000).max(25000000).default(2500000)
};

export const getCodingContextSchema = {
  nodeId: z.string().optional().describe('Screen/frame node id. Defaults to the first selected node.'),
  profile: z.enum(['compact', 'balanced', 'deep', 'verbose']).default('compact').describe('Output profile. compact is the Codex default; balanced/deep/verbose are opt-in.'),
  detail: z.enum(['compact', 'balanced', 'deep', 'verbose']).optional().describe('Deprecated alias for profile. Kept for compatibility.'),
  performanceProfile: z.enum(['fast', 'balanced', 'deep']).optional().describe('Extraction budget preset. Defaults from profile.'),
  budgetMs: z.number().int().min(500).max(120000).optional().describe('Soft extraction budget. Optional sections are skipped when the budget is nearly exhausted.'),
  target: z.string().default('react'),
  includeAssets: z.boolean().default(true),
  includeTokens: z.boolean().default(true),
  includeVariables: z.boolean().optional().describe('Fetch Pixso variables. Defaults to includeTokens, but profiles may keep this off unless explicitly requested.'),
  includeStyles: z.boolean().optional().describe('Fetch Pixso local styles. Defaults to includeTokens, but profiles may keep this off unless explicitly requested.'),
  includeComponentHints: z.boolean().default(false),
  includeLayoutAnalysis: z.boolean().default(true),
  includeRepeatedPatterns: z.boolean().default(true),
  includeScreenshot: z.enum(['none', 'thumbnail', 'full']).default('none').describe('Optionally include a screenshot payload in get_coding_context. Default returns only a suggested get_screenshot call.'),
  maxScreenshotWidth: z.number().int().min(160).max(2000).default(640).describe('Width cap for includeScreenshot=thumbnail inside get_coding_context.'),
  includeCssSummary: z.boolean().default(true).describe('Include a small CSS drill-down summary and recommended get_css_context call.'),
  includeRawTree: z.boolean().default(false).describe('Opt-in diagnostic raw layout tree. Disabled by default for Codex context economy.'),
  includeFullPaths: z.boolean().default(false).describe('Include full Pixso paths in compact node index. Defaults to path tails only.'),
  includeGeometryDetails: z.boolean().default(false).describe('Include larger geometry/debug details. Defaults to compact bounds only.'),
  maxBytes: z.number().int().min(8000).max(1000000).optional().describe('Soft output budget in bytes. Compact defaults to about 40 KB.'),
  maxNodes: z.number().int().min(50).max(3000).default(500),
  maxTextChars: z.number().int().min(0).max(50000).default(8000),
  maxTypographyVisitedNodes: z.number().int().min(100).max(20000).optional(),
  maxComponentResults: z.number().int().min(1).max(2000).default(300)
};

export const getCssContextSchema = {
  nodeId: z.string().optional().describe('Screen/frame node id. Defaults to the first selected node.'),
  depth: z.number().int().min(0).max(8).default(3).describe('Traversal depth for CSS rule extraction.'),
  mode: z.enum(['compact', 'balanced', 'verbose']).default('compact').describe('Output detail level and rule budget. compact is the default secondary drill-down mode.'),
  scope: z.enum(['key', 'all']).default('key').describe('key returns only semantic/key nodes and grouped patterns; all returns broader per-node rules.'),
  includeChildren: z.boolean().default(true).describe('Return CSS rules for selected node children.'),
  includeText: z.boolean().default(true).describe('Include text CSS declarations for text nodes.'),
  includeEffects: z.boolean().default(true).describe('Include shadow/filter/backdrop-filter declarations where Pixso effects map safely to CSS.'),
  includeStyleResolution: z.boolean().default(true).describe('Resolve style ids via local style APIs and bounded getStyleById lookups.'),
  includeLowConfidence: z.boolean().default(false).describe('Include low-confidence inferred CSS such as freeform absolute-position hints.'),
  groupDuplicates: z.boolean().default(true).describe('Group duplicate declaration sets into reusable CSS rule groups.'),
  omitDefaults: z.boolean().default(true).describe('Omit noisy defaults such as padding:0, gap:0 and opacity:1 in compact/balanced output.'),
  guidanceProfile: z.enum(['faithful', 'agent']).default('faithful').describe('faithful preserves current CSS evidence; agent returns implementation-focused CSS with compact omitted-declaration summaries.'),
  selectorStrategy: z.enum(['alias', 'name', 'nodeId', 'path']).default('alias').describe('How selectors are generated for returned CSS rules.'),
  includePaths: z.enum(['none', 'tail', 'full']).default('tail').describe('How much Pixso path context to include in CSS rules.'),
  declarationMetadata: z.enum(['none', 'compact', 'full']).optional().describe('How much source/confidence metadata to include per declaration. Omit to use compact in faithful mode and none in agent mode.'),
  maxNodes: z.number().int().min(1).max(3000).optional().describe('Optional hard cap for traversed nodes. Defaults by mode.'),
  maxRules: z.number().int().min(1).max(1000).optional().describe('Optional CSS rule cap. Defaults by mode.'),
  maxDeclarations: z.number().int().min(1).max(5000).optional().describe('Optional declaration cap for compact output.'),
  maxBytes: z.number().int().min(5000).max(1000000).optional().describe('Soft output budget in bytes. Compact defaults to about 30 KB.')
};


export const findRelatedFramesSchema = {
  nodeId: z.string().optional().describe('Reference frame/node id. Defaults to the first selected node.'),
  strategies: z.array(z.enum(['sameName', 'nearbyFrames', 'sameComponent', 'variants', 'sizes', 'states'])).optional(),
  includeAllPages: z.boolean().default(false).describe('Search all file pages. Defaults to current page for performance.'),
  includeHidden: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(200).default(30)
};
