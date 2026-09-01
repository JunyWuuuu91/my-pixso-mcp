import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { BridgeStatus, PluginCommandResponse, ServerConfig, SessionAvailability, SessionStatus } from '../types.js';

export interface PluginCallOptions {
  file?: string;
}

interface PendingCall {
  id: string;
  command: string;
  startedAt: number;
  timeout: NodeJS.Timeout;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export const NO_PLUGIN_MESSAGE =
  'No Pixso plugin is connected. Open Pixso, run the plugin "Pixso MCP 本地桥" and keep its window open until the badge shows 「已连接」.';

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

  stringInfo(key: string): string | undefined {
    const value = this.pluginInfo?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  /** Newer bundles publish their runtime environment; older or half-handshaked windows do not. */
  reportsEnvironment(): boolean {
    return this.stringInfo('version') !== undefined && this.stringInfo('editorType') !== undefined;
  }

  matchesFileExact(target: string): boolean {
    const needle = target.toLowerCase();
    return this.stringInfo('fileKey')?.toLowerCase() === needle
      || this.stringInfo('documentName')?.toLowerCase() === needle;
  }

  matchesFilePartial(target: string): boolean {
    return this.stringInfo('documentName')?.toLowerCase().includes(target.toLowerCase()) ?? false;
  }

  describeWindow(): string {
    const file = this.stringInfo('documentName') ?? 'unnamed file';
    const fileKey = this.stringInfo('fileKey') ?? 'no fileKey';
    const mode = this.stringInfo('editorType') ?? 'unknown mode';
    return `"${file}" (${fileKey}, ${mode})`;
  }

  availability(): { value: SessionAvailability; reason: string } {
    if (this.stuck) {
      return { value: 'stuck', reason: `Last ${this.stuck.command} timed out; the window never answered. Reload the plugin in Pixso.` };
    }
    if (this.pending) {
      return { value: 'busy', reason: `Running ${this.pending.command}.` };
    }
    if (!this.reportsEnvironment()) {
      return { value: 'unknown-build', reason: 'Session never reported its plugin environment (old bundle or window without a file). Used only as a last-resort target.' };
    }
    return { value: 'ready', reason: 'Environment reported; this window answers commands.' };
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

  getStatus(isNextPick = false): SessionStatus {
    const now = Date.now();
    const availability = this.availability();
    return {
      sessionId: this.id,
      connectedAt: this.connectedAt.toISOString(),
      lastSeenAt: this.lastSeenAt.toISOString(),
      plugin: this.pluginInfo,
      fileKey: this.stringInfo('fileKey'),
      documentName: this.stringInfo('documentName'),
      editorType: this.stringInfo('editorType'),
      availability: availability.value,
      reason: availability.reason,
      nextPick: isNextPick || undefined,
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
    const { session } = this.select();
    return {
      connected: this.sessions.size > 0,
      sessions: this.rank(Array.from(this.sessions.values())).map(entry => entry.getStatus(entry.id === session?.id))
    };
  }

  async call<TResult = unknown>(
    command: string,
    input: unknown,
    timeoutMs?: number,
    options: PluginCallOptions = {}
  ): Promise<TResult> {
    if (this.sessions.size === 0) {
      throw new Error(NO_PLUGIN_MESSAGE);
    }

    const target = options.file?.trim();
    const { session, candidates, unmatched } = this.select(options);

    if (unmatched) {
      const known = Array.from(this.sessions.values()).map(entry => entry.describeWindow()).join(', ');
      throw new Error(
        `No connected Pixso plugin window matches file "${target}". Connected windows: ${known}. Call the health tool to see each window's fileKey and documentName.`
      );
    }

    if (!session) {
      const scope = target ? ` matching "${target}"` : '';
      const busyDescription = candidates.map(entry => entry.availability().reason).join(' | ');
      throw new Error(
        `All connected Pixso plugin windows${scope} are busy or stuck (${busyDescription}). Wait and retry, or reload the plugin window in Pixso.`
      );
    }

    return session.call<TResult>(command, input, timeoutMs);
  }

  private select(options: PluginCallOptions = {}): {
    session?: PluginSession;
    candidates: PluginSession[];
    unmatched: boolean;
  } {
    const all = this.rank(Array.from(this.sessions.values()));
    const target = options.file?.trim();
    if (!target) {
      return { session: all.find(entry => !entry.isBusy()), candidates: all, unmatched: false };
    }

    const exact = all.filter(entry => entry.matchesFileExact(target));
    const candidates = exact.length ? exact : all.filter(entry => entry.matchesFilePartial(target));
    return {
      session: candidates.find(entry => !entry.isBusy()),
      candidates,
      unmatched: candidates.length === 0
    };
  }

  /**
   * Windows that announced their plugin environment first: an old bundle or a window
   * without an open file cannot be verified, so it only serves as a last-resort target.
   */
  private rank(sessions: PluginSession[]): PluginSession[] {
    return [...sessions].sort(
      (a, b) =>
        Number(b.reportsEnvironment()) - Number(a.reportsEnvironment()) ||
        b.lastSeenAt.getTime() - a.lastSeenAt.getTime()
    );
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.close('My Pixso MCP server is shutting down');
    }
    this.sessions.clear();
  }
}
