import { health } from './commands/health.js';
import { getDocument } from './commands/getDocument.js';
import { probeApi, type ProbeApiInput } from './commands/probeApi.js';
import { findDecorativeNodes, type FindDecorativeNodesInput } from './commands/findDecorativeNodes.js';
import { exportNodes, type ExportNodesInput } from './commands/exportNodes.js';
import { getSelection, type GetSelectionInput } from './commands/getSelection.js';

type CommandHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>;

const COMMANDS: Record<string, CommandHandler> = {
  health: () => health(),
  get_document: input => getDocument(input as Parameters<typeof getDocument>[0]),
  probe_api: input => probeApi(input as ProbeApiInput),
  find_decorative_nodes: input => findDecorativeNodes(input as FindDecorativeNodesInput),
  export_nodes_png: input => exportNodes(input as ExportNodesInput),
  export_nodes_smart: input => {
    const i = input as ExportNodesInput;
    return exportNodes({ ...i, prefer: i.prefer ?? 'auto' });
  },
  get_selection: input => getSelection(input as GetSelectionInput)
};

export function knownCommands(): string[] {
  return Object.keys(COMMANDS);
}

export async function dispatch(command: string, input: Record<string, unknown>): Promise<unknown> {
  const handler = COMMANDS[command];
  if (!handler) {
    throw new Error(`Unknown My Pixso MCP command: ${command}. Known commands: ${knownCommands().join(', ')}`);
  }
  return handler(input);
}
