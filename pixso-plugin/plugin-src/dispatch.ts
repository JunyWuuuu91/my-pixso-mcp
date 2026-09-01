import { health } from './commands/health.js';
import { getDocument } from './commands/getDocument.js';
import { probeApi, type ProbeApiInput } from './commands/probeApi.js';

type CommandHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>;

const COMMANDS: Record<string, CommandHandler> = {
  health: () => health(),
  get_document: input => getDocument(input as Parameters<typeof getDocument>[0]),
  probe_api: input => probeApi(input as ProbeApiInput)
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
