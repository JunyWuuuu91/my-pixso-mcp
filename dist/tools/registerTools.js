import { imageToolResult, jsonToolResult } from '../utils/toolResult.js';
import { emptySchema, exportAssetSchema, findRelatedFramesSchema, getCodingContextSchema, getComponentsSchema, getDesignTokensSchema, getExportPreviewSchema, getCssContextSchema, getFileInfoSchema, getNodeTreeSchema, getScreenshotSchema, getSelectionContextSchema, getStylesSchema, inspectNodeSchema, listFramesSchema, searchNodesSchema } from './schemas.js';
function isBinaryResult(value) {
    return typeof value === 'object' && value !== null;
}
function imageFromPluginResult(result) {
    if (!isBinaryResult(result))
        return jsonToolResult(result);
    const data = typeof result.dataBase64 === 'string' ? result.dataBase64 : undefined;
    const mimeType = typeof result.mimeType === 'string' ? result.mimeType : 'image/png';
    if (!data)
        return jsonToolResult(result);
    const { dataBase64: _dataBase64, data: _data, ...meta } = result;
    return imageToolResult(meta, data, mimeType);
}
function svgOrJsonFromPluginResult(result) {
    if (!isBinaryResult(result))
        return jsonToolResult(result);
    if (typeof result.dataBase64 === 'string')
        return imageFromPluginResult(result);
    return jsonToolResult(result);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function normalizePluginInputForCommand(command, input) {
    if (command !== 'get_css_context' || !isRecord(input))
        return input;
    if (input.guidanceProfile !== 'agent')
        return input;
    if (Object.prototype.hasOwnProperty.call(input, 'declarationMetadata'))
        return input;
    return { ...input, declarationMetadata: 'none' };
}
async function callPlugin(session, command, input, timeoutMs) {
    const result = await session.call(command, normalizePluginInputForCommand(command, input), timeoutMs);
    return jsonToolResult(result);
}
function codingContextTimeoutMs(input) {
    const request = typeof input === 'object' && input !== null ? input : {};
    const profile = typeof request.profile === 'string' ? request.profile : (typeof request.performanceProfile === 'string' ? request.performanceProfile : request.detail);
    if (profile === 'deep' || profile === 'verbose' || request.detail === 'deep' || request.detail === 'verbose')
        return 120_000;
    return 60_000;
}
function cssContextTimeoutMs(input) {
    const request = typeof input === 'object' && input !== null ? input : {};
    if (request.mode === 'verbose')
        return 120_000;
    if (request.mode === 'balanced')
        return 90_000;
    return 60_000;
}
export function registerTools(server, session, config) {
    server.registerTool('health', {
        title: 'Pixso Advanced MCP health',
        description: 'Check local MCP server status and Pixso plugin connection. This tool never mutates the Pixso file.',
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async () => {
        const status = session.getStatus();
        let pluginProbe = null;
        if (status.connected && status.pending) {
            pluginProbe = {
                ok: false,
                busy: true,
                pending: status.pending,
                error: `Pixso plugin is busy with ${status.pending.commands[0]?.command ?? 'another command'}. Health probe was skipped to avoid overloading the plugin runtime.`
            };
        }
        else if (status.connected) {
            try {
                pluginProbe = await session.call('health', {}, 5000);
            }
            catch (error) {
                pluginProbe = { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        }
        return jsonToolResult({
            ok: status.connected,
            server: {
                name: 'pixso-advanced-mcp',
                version: config.version,
                transport: config.transport,
                mcpPort: config.transport === 'http' ? config.mcpPort : undefined,
                wsPort: config.wsPort,
                wsPath: config.wsPath
            },
            plugin: status,
            pluginProbe
        });
    });
    server.registerTool('get_file_info', {
        title: 'Get Pixso file info',
        description: 'Return active Pixso file/page metadata and current selection summary.',
        inputSchema: getFileInfoSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_file_info', input));
    server.registerTool('list_pages', {
        title: 'List Pixso pages',
        description: 'List pages in the active Pixso file with sparse metadata.',
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'list_pages', input));
    server.registerTool('list_frames', {
        title: 'List Pixso frames',
        description: 'List top-level and nested frames/sections/components under a page or root node. Use before deep inspection.',
        inputSchema: listFramesSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'list_frames', input));
    server.registerTool('search_nodes', {
        title: 'Search Pixso nodes',
        description: 'Search nodes by name/type under a page or root node. Returns sparse matches only.',
        inputSchema: searchNodesSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'search_nodes', input));
    server.registerTool('get_node_tree', {
        title: 'Get Pixso node tree',
        description: 'Return a bounded normalized tree for a node/frame. Defaults to selected node and summary detail.',
        inputSchema: getNodeTreeSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_node_tree', input));
    server.registerTool('inspect_node', {
        title: 'Inspect Pixso node',
        description: 'Return detailed normalized layout/style/text/component data for one node. Defaults to selected node.',
        inputSchema: inspectNodeSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'inspect_node', input));
    server.registerTool('get_selection_context', {
        title: 'Get Pixso selection context',
        description: 'Return current selection and a bounded tree for selected nodes. Best entry point when user preselects a frame.',
        inputSchema: getSelectionContextSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_selection_context', input));
    server.registerTool('get_design_tokens', {
        title: 'Get Pixso design tokens',
        description: 'Return local variables/tokens and token usage under a scope when Pixso exposes variables API.',
        inputSchema: getDesignTokensSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_design_tokens', input));
    server.registerTool('get_styles', {
        title: 'Get Pixso local styles',
        description: 'Return local paint/text/effect/grid styles when Pixso exposes style APIs.',
        inputSchema: getStylesSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_styles', input));
    server.registerTool('get_components', {
        title: 'Get Pixso components and instances',
        description: 'Return component/component-set/instance inventory under a page or selected scope.',
        inputSchema: getComponentsSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_components', input));
    server.registerTool('get_export_preview', {
        title: 'Preview Pixso export',
        description: 'Estimate screenshot/export size and risk before calling Pixso exportAsync. This never exports bytes.',
        inputSchema: getExportPreviewSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_export_preview', input));
    server.registerTool('get_screenshot', {
        title: 'Get Pixso node screenshot',
        description: 'Export the selected node or nodeId as PNG image content for visual reference.',
        inputSchema: getScreenshotSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => imageFromPluginResult(await session.call('get_screenshot', input, 120_000)));
    server.registerTool('export_asset', {
        title: 'Export Pixso asset',
        description: 'Export selected node or nodeId as SVG/PNG/JPG. Use only for real assets/icons/logos/images.',
        inputSchema: exportAssetSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => svgOrJsonFromPluginResult(await session.call('export_asset', input, 120_000)));
    server.registerTool('find_related_frames', {
        title: 'Find Pixso related frames',
        description: 'Find likely related frames/states/responsive variants for the selected Pixso frame without dumping the full file.',
        inputSchema: findRelatedFramesSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'find_related_frames', input));
    server.registerTool('get_coding_context', {
        title: 'Get Pixso coding context',
        description: 'Primary Pixso design-to-implementation scan. Use this first when the user asks to implement UI from a selected Pixso frame. Returns compact semantic regions, layout, spacing, typography, colors, repeated patterns, assets, criticalDimensions, fidelityChecklist/verificationTargets for browser DOM QA, quality warnings, and recommended next calls. Do not use get_css_context before this.',
        inputSchema: getCodingContextSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_coding_context', input, codingContextTimeoutMs(input)));
    server.registerTool('get_css_context', {
        title: 'Get Pixso CSS context',
        description: 'Secondary CSS-focused drill-down. Use only after get_coding_context, or when the user explicitly asks for CSS rules/declarations. Returns compact grouped CSS facts plus criticalDimensions/productionGuidance for key nodes/patterns, not full design understanding.',
        inputSchema: getCssContextSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, async (input) => callPlugin(session, 'get_css_context', input, cssContextTimeoutMs(input)));
}
//# sourceMappingURL=registerTools.js.map