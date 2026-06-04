import { z } from 'zod/v4';
export declare const emptySchema: {};
export declare const getFileInfoSchema: {
    includeSelection: z.ZodDefault<z.ZodBoolean>;
};
export declare const listFramesSchema: {
    pageId: z.ZodOptional<z.ZodString>;
    rootNodeId: z.ZodOptional<z.ZodString>;
    depth: z.ZodDefault<z.ZodNumber>;
    includeHidden: z.ZodDefault<z.ZodBoolean>;
    maxResults: z.ZodDefault<z.ZodNumber>;
    types: z.ZodOptional<z.ZodArray<z.ZodString>>;
};
export declare const searchNodesSchema: {
    query: z.ZodString;
    pageId: z.ZodOptional<z.ZodString>;
    rootNodeId: z.ZodOptional<z.ZodString>;
    types: z.ZodOptional<z.ZodArray<z.ZodString>>;
    includeHidden: z.ZodDefault<z.ZodBoolean>;
    maxResults: z.ZodDefault<z.ZodNumber>;
};
export declare const getNodeTreeSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    depth: z.ZodDefault<z.ZodNumber>;
    maxNodes: z.ZodDefault<z.ZodNumber>;
    maxTextChars: z.ZodDefault<z.ZodNumber>;
    detail: z.ZodDefault<z.ZodEnum<{
        metadata: "metadata";
        summary: "summary";
        full: "full";
    }>>;
    includeHidden: z.ZodDefault<z.ZodBoolean>;
    includeText: z.ZodDefault<z.ZodBoolean>;
    includeVectors: z.ZodDefault<z.ZodBoolean>;
    includeImages: z.ZodDefault<z.ZodBoolean>;
    includeTextRanges: z.ZodDefault<z.ZodBoolean>;
};
export declare const inspectNodeSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    detail: z.ZodDefault<z.ZodEnum<{
        metadata: "metadata";
        summary: "summary";
        full: "full";
    }>>;
    maxTextChars: z.ZodDefault<z.ZodNumber>;
    includeTextRanges: z.ZodDefault<z.ZodBoolean>;
    includeVariables: z.ZodDefault<z.ZodBoolean>;
    includeComponentInfo: z.ZodDefault<z.ZodBoolean>;
};
export declare const getSelectionContextSchema: {
    depth: z.ZodDefault<z.ZodNumber>;
    maxNodes: z.ZodDefault<z.ZodNumber>;
    detail: z.ZodDefault<z.ZodEnum<{
        metadata: "metadata";
        summary: "summary";
        full: "full";
    }>>;
    includeScreenshotHint: z.ZodDefault<z.ZodBoolean>;
};
export declare const getDesignTokensSchema: {
    scopeNodeId: z.ZodOptional<z.ZodString>;
    includeUnusedLocalVariables: z.ZodDefault<z.ZodBoolean>;
    resolveAliases: z.ZodDefault<z.ZodBoolean>;
    types: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        COLOR: "COLOR";
        FLOAT: "FLOAT";
        STRING: "STRING";
        BOOLEAN: "BOOLEAN";
    }>>>;
};
export declare const getStylesSchema: {
    types: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        text: "text";
        paint: "paint";
        effect: "effect";
        grid: "grid";
    }>>>;
};
export declare const getComponentsSchema: {
    pageId: z.ZodOptional<z.ZodString>;
    scopeNodeId: z.ZodOptional<z.ZodString>;
    includeInstances: z.ZodDefault<z.ZodBoolean>;
    includeComponents: z.ZodDefault<z.ZodBoolean>;
    maxResults: z.ZodDefault<z.ZodNumber>;
};
export declare const getScreenshotSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    scale: z.ZodDefault<z.ZodNumber>;
    maxWidth: z.ZodOptional<z.ZodNumber>;
    maxPixels: z.ZodDefault<z.ZodNumber>;
    allowLargeExport: z.ZodDefault<z.ZodBoolean>;
    contentsOnly: z.ZodDefault<z.ZodBoolean>;
};
export declare const exportAssetSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodEnum<{
        SVG: "SVG";
        PNG: "PNG";
        JPG: "JPG";
    }>>;
    scale: z.ZodDefault<z.ZodNumber>;
    maxPixels: z.ZodDefault<z.ZodNumber>;
    allowLargeExport: z.ZodDefault<z.ZodBoolean>;
    contentsOnly: z.ZodDefault<z.ZodBoolean>;
    useAbsoluteBounds: z.ZodDefault<z.ZodBoolean>;
};
export declare const getExportPreviewSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodEnum<{
        SVG: "SVG";
        PNG: "PNG";
        JPG: "JPG";
    }>>;
    scale: z.ZodDefault<z.ZodNumber>;
    maxWidth: z.ZodOptional<z.ZodNumber>;
    maxPixels: z.ZodDefault<z.ZodNumber>;
};
export declare const getCodingContextSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    profile: z.ZodDefault<z.ZodEnum<{
        compact: "compact";
        balanced: "balanced";
        deep: "deep";
        verbose: "verbose";
    }>>;
    detail: z.ZodOptional<z.ZodEnum<{
        compact: "compact";
        balanced: "balanced";
        deep: "deep";
        verbose: "verbose";
    }>>;
    performanceProfile: z.ZodOptional<z.ZodEnum<{
        balanced: "balanced";
        deep: "deep";
        fast: "fast";
    }>>;
    budgetMs: z.ZodOptional<z.ZodNumber>;
    target: z.ZodDefault<z.ZodString>;
    includeAssets: z.ZodDefault<z.ZodBoolean>;
    includeTokens: z.ZodDefault<z.ZodBoolean>;
    includeVariables: z.ZodOptional<z.ZodBoolean>;
    includeStyles: z.ZodOptional<z.ZodBoolean>;
    includeComponentHints: z.ZodDefault<z.ZodBoolean>;
    includeLayoutAnalysis: z.ZodDefault<z.ZodBoolean>;
    includeRepeatedPatterns: z.ZodDefault<z.ZodBoolean>;
    includeScreenshot: z.ZodDefault<z.ZodEnum<{
        full: "full";
        none: "none";
        thumbnail: "thumbnail";
    }>>;
    maxScreenshotWidth: z.ZodDefault<z.ZodNumber>;
    includeCssSummary: z.ZodDefault<z.ZodBoolean>;
    includeRawTree: z.ZodDefault<z.ZodBoolean>;
    includeFullPaths: z.ZodDefault<z.ZodBoolean>;
    includeGeometryDetails: z.ZodDefault<z.ZodBoolean>;
    maxBytes: z.ZodOptional<z.ZodNumber>;
    maxNodes: z.ZodDefault<z.ZodNumber>;
    maxTextChars: z.ZodDefault<z.ZodNumber>;
    maxTypographyVisitedNodes: z.ZodOptional<z.ZodNumber>;
    maxComponentResults: z.ZodDefault<z.ZodNumber>;
};
export declare const getCssContextSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    depth: z.ZodDefault<z.ZodNumber>;
    mode: z.ZodDefault<z.ZodEnum<{
        compact: "compact";
        balanced: "balanced";
        verbose: "verbose";
    }>>;
    scope: z.ZodDefault<z.ZodEnum<{
        key: "key";
        all: "all";
    }>>;
    includeChildren: z.ZodDefault<z.ZodBoolean>;
    includeText: z.ZodDefault<z.ZodBoolean>;
    includeEffects: z.ZodDefault<z.ZodBoolean>;
    includeStyleResolution: z.ZodDefault<z.ZodBoolean>;
    includeLowConfidence: z.ZodDefault<z.ZodBoolean>;
    groupDuplicates: z.ZodDefault<z.ZodBoolean>;
    omitDefaults: z.ZodDefault<z.ZodBoolean>;
    guidanceProfile: z.ZodDefault<z.ZodEnum<{
        faithful: "faithful";
        agent: "agent";
    }>>;
    selectorStrategy: z.ZodDefault<z.ZodEnum<{
        alias: "alias";
        name: "name";
        nodeId: "nodeId";
        path: "path";
    }>>;
    includePaths: z.ZodDefault<z.ZodEnum<{
        full: "full";
        none: "none";
        tail: "tail";
    }>>;
    declarationMetadata: z.ZodOptional<z.ZodEnum<{
        full: "full";
        compact: "compact";
        none: "none";
    }>>;
    maxNodes: z.ZodOptional<z.ZodNumber>;
    maxRules: z.ZodOptional<z.ZodNumber>;
    maxDeclarations: z.ZodOptional<z.ZodNumber>;
    maxBytes: z.ZodOptional<z.ZodNumber>;
};
export declare const findRelatedFramesSchema: {
    nodeId: z.ZodOptional<z.ZodString>;
    strategies: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        sameName: "sameName";
        nearbyFrames: "nearbyFrames";
        sameComponent: "sameComponent";
        variants: "variants";
        sizes: "sizes";
        states: "states";
    }>>>;
    includeAllPages: z.ZodDefault<z.ZodBoolean>;
    includeHidden: z.ZodDefault<z.ZodBoolean>;
    maxResults: z.ZodDefault<z.ZodNumber>;
};
