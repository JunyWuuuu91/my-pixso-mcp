#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_URL = 'http://127.0.0.1:3668/mcp';

function parseArgs(argv) {
  const frameIds = [];
  const flags = { url: DEFAULT_URL, maxResults: 8 };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url') {
      flags.url = argv[index + 1] || flags.url;
      index += 1;
    } else if (arg === '--max-results') {
      flags.maxResults = Number(argv[index + 1]) || flags.maxResults;
      index += 1;
    } else if (!arg.startsWith('--')) {
      frameIds.push(arg);
    }
  }

  return { ...flags, frameIds };
}

function structured(result) {
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find(item => item.type === 'text')?.text;
  return text ? JSON.parse(text) : {};
}

async function call(client, name, args) {
  return structured(await client.callTool({ name, arguments: args }));
}

function suspiciousSpacing(context) {
  const items = context.layout?.spacingAnalysis || [];
  return items
    .filter(item => item.measured?.gapReliability === 'overlap-detected')
    .slice(0, 8)
    .map(item => ({
      parentNodeId: item.parentNodeId,
      parentName: item.parentName,
      pattern: item.detectedPattern,
      negativeColumnGaps: item.measured?.negativeColumnGaps || [],
      negativeRowGaps: item.measured?.negativeRowGaps || []
    }));
}

function frameMetrics(context) {
  return {
    nodeId: context.screen?.id,
    name: context.screen?.name,
    version: context.version,
    elapsedMs: context.performance?.elapsedMs,
    partial: context.performance?.partial,
    disabledSections: (context.performance?.disabledSections || []).map(item => item.name),
    completeness: context.extractionQuality?.completeness,
    nodeCount: context.stats?.nodeCount,
    textNodeCount: context.stats?.textNodeCount,
    typographyVisited: context.typography?.coverage?.visitedNodes,
    typographyMissingDueToDepth: context.typography?.coverage?.missingDueToDepth,
    spacingAnalysisCount: context.stats?.spacingAnalysisCount,
    repeatedPatternCount: context.stats?.repeatedPatternCount,
    assetCandidateCount: context.stats?.assetCandidateCount,
    exportQueueCount: context.assets?.exportQueue?.length || 0,
    ignoredContainerCount: context.assets?.layoutContainersIgnored?.length || 0,
    warningCount: context.warnings?.length || 0,
    warnings: (context.warnings || []).slice(0, 6),
    suspiciousSpacing: suspiciousSpacing(context)
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = new Client({ name: 'pixso-quality-metrics', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(options.url));

  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const codingContextTool = tools.tools.find(tool => tool.name === 'get_coding_context');
    const health = await call(client, 'health', {});
    let frameIds = options.frameIds;

    if (!frameIds.length) {
      const fileInfo = await call(client, 'get_file_info', { includeSelection: true });
      frameIds = (fileInfo.selection || []).map(item => item.id).filter(Boolean);
    }

    const frames = [];
    for (const nodeId of frameIds) {
      const context = await call(client, 'get_coding_context', {
        nodeId,
        detail: 'balanced',
        performanceProfile: 'balanced',
        target: 'react',
        includeAssets: true,
        includeVariables: false,
        includeStyles: false,
        includeComponentHints: false,
        includeScreenshot: 'none',
        maxNodes: 300,
        maxTextChars: 4000,
        budgetMs: 10000
      });
      frames.push(frameMetrics(context));
    }

    const related = frameIds[0]
      ? await call(client, 'find_related_frames', {
          nodeId: frameIds[0],
          maxResults: options.maxResults,
          includeAllPages: false,
          strategies: ['sameName', 'nearbyFrames', 'sizes', 'states']
        })
      : undefined;

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      url: options.url,
      server: health.server,
      pluginConnected: health.plugin?.connected,
      toolCount: tools.tools.length,
      schemaDefaults: {
        includeComponentHints: codingContextTool?.inputSchema?.properties?.includeComponentHints?.default
      },
      frames,
      related: related ? {
        visited: related.searched?.visited,
        truncated: related.truncated,
        groups: related.groups,
        topCandidates: (related.candidates || []).slice(0, options.maxResults).map(item => ({
          id: item.id,
          name: item.name,
          score: item.score,
          category: item.category,
          confidence: item.confidence,
          reasons: item.reasons
        }))
      } : undefined
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
