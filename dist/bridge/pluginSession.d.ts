import type { WebSocket } from 'ws';
import type { PluginCommandResponse, PluginStatus, ServerConfig } from '../types.js';
export declare class PluginSession {
    private readonly config;
    private socket?;
    private connectionId?;
    private connectedAt?;
    private lastSeenAt?;
    private pluginInfo?;
    private readonly pending;
    constructor(config: Pick<ServerConfig, 'pluginTimeoutMs'>);
    attach(socket: WebSocket, pluginInfo?: Record<string, unknown>): string;
    updatePluginInfo(pluginInfo?: Record<string, unknown>): void;
    getStatus(): PluginStatus;
    call<TResult = unknown>(command: string, input: unknown, timeoutMs?: number): Promise<TResult>;
    handleResponse(response: PluginCommandResponse): void;
    close(): void;
    private closeActiveSocket;
    private rejectAll;
    private pendingStatus;
}
