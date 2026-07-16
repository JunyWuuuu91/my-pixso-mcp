import type { WebSocket } from 'ws';
import type { PluginCommandResponse, PluginStatus, ServerConfig } from '../types.js';
export declare const REPLACED_PLUGIN_SESSION_CLOSE_REASON = "Replacing active Pixso plugin session";
export declare const DUPLICATE_PLUGIN_SESSION_CLOSE_REASON = "Another Pixso plugin session is already connected";
export declare const UNRESPONSIVE_PLUGIN_SESSION_CLOSE_REASON = "Pixso plugin stopped responding; reload the plugin window";
export declare class PluginSession {
    private readonly config;
    private socket?;
    private connectionId?;
    private connectedAt?;
    private lastSeenAt?;
    private pluginInfo?;
    private readonly pending;
    private lastFailure?;
    constructor(config: Pick<ServerConfig, 'pluginTimeoutMs'>);
    attach(socket: WebSocket, pluginInfo?: Record<string, unknown>): string;
    updatePluginInfo(pluginInfo?: Record<string, unknown>): void;
    getStatus(): PluginStatus;
    hasActiveConnection(): boolean;
    call<TResult = unknown>(command: string, input: unknown, timeoutMs?: number): Promise<TResult>;
    handleResponse(response: PluginCommandResponse): void;
    close(): void;
    private closeActiveSocket;
    private rejectAll;
    private pendingStatus;
}
