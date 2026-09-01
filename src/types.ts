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

export interface SessionStatus {
  sessionId: string;
  connectedAt: string;
  lastSeenAt: string;
  plugin?: Record<string, unknown>;
  pending?: { command: string; elapsedMs: number };
  stuck?: { command: string; since: string };
}

export interface BridgeStatus {
  connected: boolean;
  sessions: SessionStatus[];
}
