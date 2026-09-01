export const PLUGIN_NAME = 'My Pixso MCP';
export const PLUGIN_VERSION = '0.1.0';

export async function health(): Promise<Record<string, unknown>> {
  return {
    ok: true,
    plugin: {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      commands: ['health', 'get_document', 'probe_api']
    },
    document: {
      name: pixso.root?.name,
      currentPageId: pixso.currentPage?.id,
      currentPageName: pixso.currentPage?.name
    },
    timestamp: new Date().toISOString()
  };
}
