export type TransportKind = 'stdio' | 'http';
export interface ServerConfig {
    transport: TransportKind;
    host: string;
    mcpPort: number;
    wsPort: number;
    wsPath: string;
    sessionToken?: string;
    pluginTimeoutMs: number;
    version: string;
}
export interface PluginStatus {
    connected: boolean;
    connectionId?: string;
    connectedAt?: string;
    lastSeenAt?: string;
    plugin?: Record<string, unknown>;
    pending?: {
        count: number;
        commands: Array<{
            command: string;
            elapsedMs: number;
        }>;
    };
    lastFailure?: {
        command: string;
        reason: 'timeout';
        occurredAt: string;
    };
}
export interface PluginCommand<TInput = unknown> {
    command: string;
    input: TInput;
}
export interface PluginCommandEnvelope<TInput = unknown> extends PluginCommand<TInput> {
    id: string;
}
export interface PluginCommandResponse<TResult = unknown> {
    id: string;
    ok: boolean;
    result?: TResult;
    error?: string;
}
export interface ToolPayload {
    [key: string]: unknown;
}
