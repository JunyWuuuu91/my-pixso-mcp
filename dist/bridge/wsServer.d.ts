import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
import { PluginSession } from './pluginSession.js';
export interface BridgeServer {
    session: PluginSession;
    close(): Promise<void>;
}
export declare function startBridgeServer(config: ServerConfig, logger: Logger): Promise<BridgeServer>;
