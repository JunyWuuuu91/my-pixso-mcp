import { randomUUID } from 'node:crypto';
export const REPLACED_PLUGIN_SESSION_CLOSE_REASON = 'Replacing active Pixso plugin session';
export const DUPLICATE_PLUGIN_SESSION_CLOSE_REASON = 'Another Pixso plugin session is already connected';
export const UNRESPONSIVE_PLUGIN_SESSION_CLOSE_REASON = 'Pixso plugin stopped responding; reload the plugin window';
export class PluginSession {
    config;
    socket;
    connectionId;
    connectedAt;
    lastSeenAt;
    pluginInfo;
    pending = new Map();
    lastFailure;
    constructor(config) {
        this.config = config;
    }
    attach(socket, pluginInfo) {
        if (this.socket) {
            this.rejectAll(new Error('Pixso plugin WebSocket was replaced by a new connection'));
        }
        this.closeActiveSocket();
        this.socket = socket;
        this.connectionId = randomUUID();
        this.connectedAt = new Date();
        this.lastSeenAt = new Date();
        this.pluginInfo = pluginInfo;
        this.lastFailure = undefined;
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
    updatePluginInfo(pluginInfo) {
        this.lastSeenAt = new Date();
        if (pluginInfo)
            this.pluginInfo = { ...(this.pluginInfo ?? {}), ...pluginInfo };
    }
    getStatus() {
        return {
            connected: Boolean(this.socket && this.socket.readyState === this.socket.OPEN),
            connectionId: this.connectionId,
            connectedAt: this.connectedAt?.toISOString(),
            lastSeenAt: this.lastSeenAt?.toISOString(),
            plugin: this.pluginInfo,
            pending: this.pendingStatus(),
            lastFailure: this.lastFailure
        };
    }
    hasActiveConnection() {
        return Boolean(this.socket && this.socket.readyState === this.socket.OPEN);
    }
    async call(command, input, timeoutMs = this.config.pluginTimeoutMs) {
        const socket = this.socket;
        if (!socket || socket.readyState !== socket.OPEN) {
            throw new Error('Pixso plugin is not connected. Open Pixso, run the local plugin, and wait until it connects to the WebSocket bridge.');
        }
        const activeCall = this.pending.values().next().value;
        if (activeCall) {
            throw new Error(`Pixso plugin is busy with ${activeCall.command} for ${Date.now() - activeCall.startedAt}ms. Wait for it to finish before sending another command.`);
        }
        const id = randomUUID();
        const startedAt = Date.now();
        const payload = JSON.stringify({ id, command, input });
        const promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                this.lastFailure = {
                    command,
                    reason: 'timeout',
                    occurredAt: new Date().toISOString()
                };
                reject(new Error(`Pixso plugin command timed out after ${timeoutMs}ms: ${command}`));
                if (this.socket === socket && socket.readyState === socket.OPEN) {
                    socket.close(1011, UNRESPONSIVE_PLUGIN_SESSION_CLOSE_REASON);
                }
            }, timeoutMs);
            this.pending.set(id, {
                command,
                startedAt,
                timeout,
                resolve: value => resolve(value),
                reject
            });
        });
        try {
            socket.send(payload);
        }
        catch (error) {
            const pending = this.pending.get(id);
            if (pending)
                clearTimeout(pending.timeout);
            this.pending.delete(id);
            throw error;
        }
        return promise;
    }
    handleResponse(response) {
        this.lastSeenAt = new Date();
        const pending = this.pending.get(response.id);
        if (!pending)
            return;
        clearTimeout(pending.timeout);
        this.pending.delete(response.id);
        if (response.ok) {
            pending.resolve(response.result);
            return;
        }
        const elapsed = Date.now() - pending.startedAt;
        pending.reject(new Error(response.error || `Pixso plugin command failed: ${pending.command} (${elapsed}ms)`));
    }
    close() {
        this.rejectAll(new Error('Pixso Advanced MCP server is shutting down'));
        this.closeActiveSocket();
    }
    closeActiveSocket() {
        if (this.socket && this.socket.readyState === this.socket.OPEN) {
            this.socket.close(1000, REPLACED_PLUGIN_SESSION_CLOSE_REASON);
        }
    }
    rejectAll(error) {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pending.clear();
    }
    pendingStatus() {
        if (!this.pending.size)
            return undefined;
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
//# sourceMappingURL=pluginSession.js.map