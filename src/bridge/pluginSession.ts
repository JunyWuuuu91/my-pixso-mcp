import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { BridgeStatus, PluginCommandResponse, ServerConfig, SessionStatus } from '../types.js';

interface PendingCall {
  id: string;
  command: string;
  startedAt: number;
  timeout: NodeJS.Timeout;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export const NO_PLUGIN_MESSAGE =
  'No Pixso plugin is connected. Open Pixso, run the My Pixso MCP plugin and keep its window open until it shows "Connected".';

export class PluginSession {
  readonly id = randomUUID();
  readonly connectedAt = new Date();
  lastSeenAt = new Date();
  pluginInfo?: Record<string, unknown>;

  private pending?: PendingCall;
  private stuck?: { command: string; since: Date; timedOutId: string };

  constructor(
    private readonly socket: WebSocket,
    private readonly config: Pick<ServerConfig, 'pluginTimeoutMs'>
  ) {}

  updatePluginInfo(pluginInfo?: Record<string, unknown>): void {
    this.lastSeenAt = new Date();
    if (pluginInfo) this.pluginInfo = { ...(this.pluginInfo ?? {}), ...pluginInfo };
  }

  isBusy(): boolean {
    return this.pending !== undefined || this.stuck !== undefined;
  }

  async call<TResult = unknown>(command: string, input: unknown, timeoutMs = this.config.pluginTimeoutMs): Promise<TResult> {
    if (this.pending) {
      throw new Error(`Plugin session is busy with ${this.pending.command}. Wait for it to finish.`);
    }
    if (this.stuck) {
      throw new Error(`Plugin session is stuck after ${this.stuck.command} timed out. Reload the plugin window in Pixso.`);
    }

    const id = randomUUID();
    const startedAt = Date.now();
    let record: PendingCall | undefined;

    const promise = new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const current = record;
        this.pending = undefined;
        this.stuck = { command, since: new Date(), timedOutId: id };
        if (current) clearTimeout(current.timeout);
        reject(new Error(`Pixso plugin command timed out after ${timeoutMs}ms: ${command}. The plugin window stays connected; the session is marked stuck until the plugin responds again or is reloaded.`));
      }, timeoutMs);

      record = { id, command, startedAt, timeout, resolve: value => resolve(value as TResult), reject };
      this.pending = record;
    });

    try {
      this.socket.send(JSON.stringify({ id, command, input }));
    } catch (error) {
      if (record) clearTimeout(record.timeout);
      this.pending = undefined;
      throw error;
    }

    return promise;
  }

  handleResponse(response: PluginCommandResponse): void {
    this.lastSeenAt = new Date();

    const pending = this.pending;
    if (pending && pending.id === response.id) {
      clearTimeout(pending.timeout);
      this.pending = undefined;
      if (response.ok) pending.resolve(response.result);
      else pending.reject(new Error(response.error || `Pixso plugin command failed: ${pending.command}`));
      return;
    }

    if (this.stuck && this.stuck.timedOutId === response.id) {
      this.stuck = undefined;
    }
  }

  getStatus(): SessionStatus {
    const now = Date.now();
    return {
      sessionId: this.id,
      connectedAt: this.connectedAt.toISOString(),
      lastSeenAt: this.lastSeenAt.toISOString(),
      plugin: this.pluginInfo,
      pending: this.pending ? { command: this.pending.command, elapsedMs: now - this.pending.startedAt } : undefined,
      stuck: this.stuck ? { command: this.stuck.command, since: this.stuck.since.toISOString() } : undefined
    };
  }

  close(reason: string): void {
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(new Error(reason));
      this.pending = undefined;
    }
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.close(1000, reason);
    }
  }
}

export class SessionRegistry {
  private readonly sessions = new Map<string, PluginSession>();

  constructor(private readonly config: Pick<ServerConfig, 'pluginTimeoutMs'>) {}

  register(socket: WebSocket, pluginInfo?: Record<string, unknown>): PluginSession {
    const session = new PluginSession(socket, this.config);
    if (pluginInfo) session.updatePluginInfo(pluginInfo);
    this.sessions.set(session.id, session);
    socket.on('close', () => {
      session.close('Pixso plugin WebSocket closed');
      this.sessions.delete(session.id);
    });
    return session;
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.sessions.size > 0,
      sessions: Array.from(this.sessions.values()).map(session => session.getStatus())
    };
  }

  async call<TResult = unknown>(command: string, input: unknown, timeoutMs?: number): Promise<TResult> {
    if (this.sessions.size === 0) {
      throw new Error(NO_PLUGIN_MESSAGE);
    }

    const idle = Array.from(this.sessions.values()).find(session => !session.isBusy());
    if (!idle) {
      const busyDescription = Array.from(this.sessions.values())
        .map(session => (session.getStatus().pending ? session.getStatus().pending?.command : 'recovering from timeout'))
        .join(', ');
      throw new Error(`All connected Pixso plugin sessions are busy (${busyDescription}). Wait and retry.`);
    }

    return idle.call<TResult>(command, input, timeoutMs);
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.close('My Pixso MCP server is shutting down');
    }
    this.sessions.clear();
  }
}
