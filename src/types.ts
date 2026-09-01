export interface ServerConfig {
  host: string;
  mcpPort: number;
  wsPort: number;
  wsPath: string;
  sessionToken?: string;
  pluginTimeoutMs: number;
  authTimeoutMs: number;
  version: string;
}

export type Transport = 'http' | 'stdio';

export interface PluginCommandResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type SessionAvailability = 'ready' | 'unknown-build' | 'busy' | 'stuck';

export interface SessionStatus {
  sessionId: string;
  connectedAt: string;
  lastSeenAt: string;
  plugin?: Record<string, unknown>;
  fileKey?: string;
  documentName?: string;
  editorType?: string;
  availability: SessionAvailability;
  reason: string;
  nextPick?: boolean;
  pending?: { command: string; elapsedMs: number };
  stuck?: { command: string; since: string };
}

export interface BridgeStatus {
  connected: boolean;
  sessions: SessionStatus[];
}
