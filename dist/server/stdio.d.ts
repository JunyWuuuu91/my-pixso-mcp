import type { BridgeServer } from '../bridge/wsServer.js';
import type { ServerConfig } from '../types.js';
import type { Logger } from '../logger.js';
export declare function runStdioServer(config: ServerConfig, bridge: BridgeServer, logger: Logger): Promise<void>;
