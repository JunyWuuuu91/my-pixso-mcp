import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { PluginCommandResponse, PluginStatus, ServerConfig } from '../types.js';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
  command: string;
  startedAt: number;
}

export class PluginSession {
  private socket?: WebSocket;
  private connectionId?: string;
  private connectedAt?: Date;
  private lastSeenAt?: Date;
  private pluginInfo?: Record<string, unknown>;
  private readonly pending = new Map<string, PendingCall>();

  constructor(private readonly config: Pick<ServerConfig, 'pluginTimeoutMs'>) {}

  attach(socket: WebSocket, pluginInfo?: Record<string, unknown>): string {
    if (this.socket) {
      this.rejectAll(new Error('Pixso plugin WebSocket was replaced by a new connection'));
    }
    this.closeActiveSocket();
    this.socket = socket;
    this.connectionId = randomUUID();
    this.connectedAt = new Date();
    this.lastSeenAt = new Date();
    this.pluginInfo = pluginInfo;

    socket.on('close', () => {
      if (this.socket === socket) {
        this.rejectAll(new Error('Pixso plugin WebSocket disconnected'));
        this.socket = undefined;
        this.connectionId = undefined;
        this.connectedAt = undefined;
        this.pluginInfo = undefined;
      }
    });

    return this.connectionId;
  }

  updatePluginInfo(pluginInfo?: Record<string, unknown>): void {
    this.lastSeenAt = new Date();
    if (pluginInfo) this.pluginInfo = { ...(this.pluginInfo ?? {}), ...pluginInfo };
  }

  getStatus(): PluginStatus {
    return {
      connected: Boolean(this.socket && this.socket.readyState === this.socket.OPEN),
      connectionId: this.connectionId,
      connectedAt: this.connectedAt?.toISOString(),
      lastSeenAt: this.lastSeenAt?.toISOString(),
      plugin: this.pluginInfo,
      pending: this.pendingStatus()
    };
  }

  async call<TResult = unknown>(command: string, input: unknown, timeoutMs = this.config.pluginTimeoutMs): Promise<TResult> {
    const socket = this.socket;
    if (!socket || socket.readyState !== socket.OPEN) {
      throw new Error('Pixso plugin is not connected. Open Pixso, run the local plugin, and wait until it connects to the WebSocket bridge.');
    }

    const id = randomUUID();
    const startedAt = Date.now();
    const payload = JSON.stringify({ id, command, input });

    const promise = new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Pixso plugin command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      this.pending.set(id, {
        command,
        startedAt,
        timeout,
        resolve: value => resolve(value as TResult),
        reject
      });
    });

    try {
      socket.send(payload);
    } catch (error) {
      const pending = this.pending.get(id);
      if (pending) clearTimeout(pending.timeout);
      this.pending.delete(id);
      throw error;
    }

    return promise;
  }

  handleResponse(response: PluginCommandResponse): void {
    this.lastSeenAt = new Date();
    const pending = this.pending.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(response.id);

    if (response.ok) {
      pending.resolve(response.result);
      return;
    }

    const elapsed = Date.now() - pending.startedAt;
    pending.reject(new Error(response.error || `Pixso plugin command failed: ${pending.command} (${elapsed}ms)`));
  }

  close(): void {
    this.rejectAll(new Error('Pixso Advanced MCP server is shutting down'));
    this.closeActiveSocket();
  }

  private closeActiveSocket(): void {
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.close(1000, 'Replacing active Pixso plugin session');
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private pendingStatus(): PluginStatus['pending'] {
    if (!this.pending.size) return undefined;
    const now = Date.now();
    return {
      count: this.pending.size,
      commands: Array.from(this.pending.values()).map(call => ({
        command: call.command,
        elapsedMs: now - call.startedAt
      }))
    };
  }
}
